import { paintTile } from './bevel';
import { EMPTY } from './puzzle';

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function position(index: number): string {
  return `translate(${(index % 3) * 100}%, ${Math.floor(index / 3) * 100}%)`;
}

export class PuzzleView {
  private readonly tiles: HTMLDivElement[];
  private tilePositions: number[] = [];

  constructor(private host: HTMLElement, private painting: HTMLElement) {
    this.tiles = Array.from({ length: 9 }, (_, index) => {
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

  load(artwork: string, layout: readonly number[]): void {
    const image = `url("${artwork}")`;
    this.host.style.setProperty('--art', image);
    for (const tile of this.tiles) tile.querySelector('canvas')?.remove();
    const source = new Image();
    source.src = artwork;
    void source.decode().then(() => {
      if (this.host.style.getPropertyValue('--art') !== image) return;
      this.tiles.forEach((tile, index) => tile.querySelector('.block')!.append(paintTile(source, index)));
    }).catch(() => {});
    this.painting.style.setProperty('--art', image);
    this.painting.style.opacity = '0';
    this.host.style.opacity = '1';
    this.host.style.setProperty('--empty-slot', position(layout.indexOf(EMPTY)));
    layout.forEach((tile, index) => {
      this.tilePositions[tile] = index;
      this.tiles[tile].style.transform = position(index);
      this.tiles[tile].hidden = tile === EMPTY;
    });
  }

  async move(tile: number, index: number): Promise<void> {
    const piece = this.tiles[tile];
    const from = position(this.tilePositions[tile]);
    this.host.style.setProperty('--empty-slot', from);
    const to = position(index);
    this.tilePositions[tile] = index;
    piece.style.transform = to;
    if (!reducedMotion.matches) {
      await piece.animate([{ transform: from }, { transform: to }], {
        duration: 185, easing: 'cubic-bezier(.25,.75,.23,1)',
      }).finished;
    }
  }

  async stamp(): Promise<void> {
    const tile = this.tiles[EMPTY];
    const landed = position(EMPTY);
    tile.hidden = false;
    tile.style.transform = landed;
    if (!reducedMotion.matches) {
      tile.style.zIndex = '1';
      await tile.animate([
        { transform: `${landed} translateY(-23%) scale(1.14)`, opacity: 0, filter: 'drop-shadow(0 16px 12px #3a210c60)' },
        { transform: `${landed} translateY(-23%) scale(1.14)`, opacity: 1, filter: 'drop-shadow(0 16px 12px #3a210c60)', offset: .2 },
        { transform: landed, opacity: 1, filter: 'drop-shadow(0 0 0 transparent)' },
      ], { duration: 490, easing: 'cubic-bezier(.68,.1,.84,.49)' }).finished;
      tile.style.zIndex = '';
    }
  }

  async reveal(): Promise<void> {
    this.painting.style.opacity = '1';
    if (!reducedMotion.matches) {
      await this.painting.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 620, easing: 'ease-in-out',
      }).finished;
    }
    this.host.style.opacity = '0';
  }
}
