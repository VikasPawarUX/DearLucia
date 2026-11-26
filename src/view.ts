import { paintTile } from './bevel';
import { EMPTY, neighbors } from './puzzle';

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function position(index: number): string {
  return `translate(${(index % 3) * 100}%, ${Math.floor(index / 3) * 100}%)`;
}

/** A tile part-way from its slot toward the gap: `progress` 0 is home, 1 is the gap. */
function between(index: number, toward: number, progress: number): string {
  const x = index % 3 + (toward % 3 - index % 3) * progress;
  const y = Math.floor(index / 3) + (Math.floor(toward / 3) - Math.floor(index / 3)) * progress;
  return `translate(${x * 100}%, ${y * 100}%)`;
}

export class PuzzleView {
  private readonly tiles: HTMLDivElement[];
  private tilePositions: number[] = [];
  /** The tile held back as the empty space for the current memory. */
  private gap = EMPTY;
  private readonly pulses = new Map<number, Animation>();

  constructor(private host: HTMLElement, private painting: HTMLElement, private shine: HTMLElement, backing: HTMLElement) {
    this.tiles = Array.from({ length: 9 }, (_, index) => {
      const slot = document.createElement('div');
      slot.className = 'backing-slot';
      slot.style.transform = position(index);
      backing.append(slot);

      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.style.setProperty('--source-x', String(index % 3));
      tile.style.setProperty('--source-y', String(Math.floor(index / 3)));
      const block = document.createElement('div');
      block.className = 'block';
      const art = document.createElement('div');
      art.className = 'art';
      block.append(art);
      tile.append(block);
      host.append(tile);
      return tile;
    });
  }

  load(artwork: string, layout: readonly number[], gap = EMPTY): Promise<void> {
    this.clearPulses();
    this.gap = gap;
    const image = `url("${artwork}")`;
    this.host.style.setProperty('--art', image);
    for (const tile of this.tiles) tile.querySelector('canvas')?.remove();
    const source = new Image();
    source.src = artwork;
    const artworkReady = source.decode().then(() => {
      if (this.host.style.getPropertyValue('--art') !== image) return;
      this.tiles.forEach((tile, index) => tile.querySelector('.block')!.append(paintTile(source, index)));
    }).catch(() => {});
    this.painting.style.setProperty('--art', image);
    this.painting.style.opacity = '0';
    this.host.style.opacity = '1';
    layout.forEach((tile, index) => {
      this.tilePositions[tile] = index;
      this.tiles[tile].style.transform = position(index);
      this.tiles[tile].hidden = tile === gap;
    });
    return artworkReady;
  }

  async entranceRipple(): Promise<void> {
    const pulses = this.tilePositions.map((slot, tile) => {
      const diagonal = slot % 3 + Math.floor(slot / 3);
      return this.pulse(tile, 1.06, diagonal * 90, 400)?.finished;
    });
    await Promise.allSettled(pulses);
  }

  correctPlacement(index: number, layout: readonly number[]): void {
    this.pulse(index, 1.045, 0, 360);
    for (const adjacent of neighbors(index)) {
      if (layout[adjacent] !== this.gap && layout[adjacent] === adjacent) {
        this.pulse(adjacent, 1.025, 70, 360);
      }
    }
  }

  clearPulses(): void {
    for (const tile of this.pulses.keys()) this.cancelPulse(tile);
  }

  private pulse(tile: number, peak: number, delay: number, duration: number): Animation | undefined {
    if (tile === this.gap || reducedMotion.matches) return;
    this.cancelPulse(tile);
    const piece = this.tiles[tile];
    const block = piece.querySelector('.block')!;
    piece.classList.add('is-pulsing');
    const animation = block.animate([
      { transform: 'scale(1)', easing: 'cubic-bezier(.3,.65,.3,1)' },
      { transform: `scale(${peak})`, offset: .44, easing: 'cubic-bezier(.35,0,.3,1)' },
      { transform: 'scale(1)' },
    ], { delay, duration });
    this.pulses.set(tile, animation);
    animation.onfinish = () => {
      if (this.pulses.get(tile) !== animation) return;
      this.pulses.delete(tile);
      piece.classList.remove('is-pulsing');
    };
    return animation;
  }

  private cancelPulse(tile: number): void {
    this.pulses.get(tile)?.cancel();
    this.pulses.delete(tile);
    this.tiles[tile].classList.remove('is-pulsing');
  }

  /** Slide a tile into the gap. `dragged` (0–1) continues from where the player's finger left it. */
  async move(tile: number, index: number, dragged = 0): Promise<void> {
    this.cancelPulse(tile);
    const piece = this.tiles[tile];
    const from = between(this.tilePositions[tile], index, dragged);
    const to = position(index);
    this.tilePositions[tile] = index;
    piece.style.transform = to;
    if (!reducedMotion.matches) {
      const duration = Math.max(110, 280 * (1 - dragged));
      if (!dragged) {
        piece.querySelector('.block')!.animate([
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(.95)', filter: 'brightness(.93)', offset: .28 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ], { duration: 280, easing: 'ease-in-out' });
      }
      await piece.animate([{ transform: from }, { transform: to }], {
        duration, easing: 'cubic-bezier(.3,.65,.3,1)',
      }).finished;
    }
  }

  /** Hold a tile part-way toward the gap while the player drags it. */
  drag(tile: number, toward: number, progress: number): void {
    this.cancelPulse(tile);
    this.tiles[tile].style.transform = between(this.tilePositions[tile], toward, progress);
  }

  /** Return a dragged tile to its slot when the drag was too short to count. */
  async snapBack(tile: number, toward: number, progress: number): Promise<void> {
    const piece = this.tiles[tile];
    const home = position(this.tilePositions[tile]);
    piece.style.transform = home;
    if (reducedMotion.matches || !progress) return;
    await piece.animate([{ transform: between(this.tilePositions[tile], toward, progress) }, { transform: home }], {
      duration: 90 + 160 * progress, easing: 'cubic-bezier(.3,.65,.3,1)',
    }).finished.catch(() => {});
  }

  /** A small sideways wiggle for a tile that can't move: it isn't next to the gap. */
  refuse(tile: number): void {
    if (reducedMotion.matches || tile === this.gap) return;
    this.tiles[tile].querySelector('.block')!.animate([
      { translate: '0' }, { translate: '-4.5% 0' }, { translate: '4% 0' }, { translate: '-2.5% 0' }, { translate: '0' },
    ], { duration: 320, easing: 'ease-in-out' });
  }

  async stamp(): Promise<void> {
    const tile = this.tiles[this.gap];
    const landed = position(this.gap);
    tile.hidden = false;
    tile.style.transform = landed;
    if (!reducedMotion.matches) {
      tile.style.zIndex = '1';
      await tile.animate([
        { transform: `${landed} scale(0)`, easing: 'cubic-bezier(.2,.8,.25,1)' },
        { transform: `${landed} scale(1.075)`, offset: .66, easing: 'cubic-bezier(.25,.7,.25,1)' },
        { transform: `${landed} scale(1)` },
      ], { duration: 490 }).finished;
      tile.style.zIndex = '';
    }
  }

  async celebrate(): Promise<void> {
    if (reducedMotion.matches) return;
    const wave = this.tiles.map((tile, index) => {
      const resting = position(index);
      const diagonal = index % 3 + Math.floor(index / 3);
      return tile.animate([
        { transform: resting, easing: 'cubic-bezier(.2,.72,.4,1)' },
        { transform: `${resting} scale(1.028)`, offset: .48, easing: 'ease-in-out' },
        { transform: resting },
      ], { duration: 410, delay: diagonal * 68 }).finished;
    });
    const glint = this.shine.animate([
      { opacity: 0, backgroundPosition: '100% 100%' },
      { opacity: .68, backgroundPosition: '80% 80%', offset: .2 },
      { opacity: .68, backgroundPosition: '20% 20%', offset: .8 },
      { opacity: 0, backgroundPosition: '0% 0%' },
    ], { duration: 630, delay: 175, easing: 'ease-in-out' }).finished;
    await Promise.all([...wave, glint]);
  }

  async reveal(animate = true): Promise<void> {
    this.painting.style.opacity = '1';
    if (animate && !reducedMotion.matches) {
      await this.painting.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 460, easing: 'ease-in-out',
      }).finished;
    }
    this.host.style.opacity = '0';
  }
}
