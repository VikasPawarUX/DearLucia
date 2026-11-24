import './style.css';
import { levels } from './levels';
import { EMPTY, SOLVED, neighbors, shuffle, slide, solved } from './puzzle';
import { PuzzleView, delay, reducedMotion } from './view';
import { sound, unlockAudio } from './audio';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element ${id}`);
  return element as T;
}
const board = required('board');
const controls = required('controls');
const status = required('status');
const restart = required<HTMLButtonElement>('restart');
const home = required<HTMLButtonElement>('home');
const hand = document.querySelector<SVGElement>('#hand')!;
const menu = required<HTMLDialogElement>('menu');
const menuTitle = required('menu-title');
const play = required<HTMLButtonElement>('play');
const heading = document.querySelector('h1')!;
const particles = required('particles');
const progressKey = 'toy-slide-unlocked-v1';

function restore(): number {
  try {
    const saved = Number(localStorage.getItem(progressKey));
    return Number.isInteger(saved) && saved >= 0 && saved <= levels.length ? saved : 0;
  } catch { return 0; }
}

function save(progress: number): void {
  try { localStorage.setItem(progressKey, String(progress)); }
  catch { /* Play remains available when storage is blocked. */ }
}

const savedProgress = restore();
let levelIndex = Math.min(savedProgress, levels.length - 1);
let complete = savedProgress === levels.length;
let layout: number[] = [];
let startingLayout: number[] = [];
let busy = false;
let tutorialSeen = false;
let pointer: { id: number; index: number; x: number; y: number } | undefined;
let suppressClick = false;

const cells = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.addEventListener('click', event => {
    if (event.detail && suppressClick) return;
    unlockAudio();
    void move(index);
  });
  controls.append(button);
  return button;
});

function updateCells(): void {
  const empty = layout.indexOf(EMPTY);
  const movable = neighbors(empty);
  cells.forEach((cell, index) => {
    cell.dataset.movable = String(!busy && movable.includes(index));
    cell.tabIndex = !busy && movable.includes(index) ? 0 : -1;
    cell.setAttribute('aria-disabled', String(busy || !movable.includes(index)));
    cell.setAttribute('aria-label', index === empty ? 'Empty space' : `Tile, row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}`);
  });
}

function tutorial(): void {
  if (levelIndex !== 0 || tutorialSeen || complete) {
    hand.style.display = 'none';
    return;
  }
  const empty = layout.indexOf(EMPTY);
  const correct = neighbors(empty).find(i => layout[i] === empty);
  if (correct === undefined) {
    hand.style.display = 'none';
    return;
  }
  hand.style.display = '';
  hand.style.left = `${(correct % 3 + .46) * 100 / 3 - 4.2}%`;
  hand.style.top = `${(Math.floor(correct / 3) + .50) * 100 / 3 - 2.2}%`;
  hand.style.setProperty('--hand-x', `${(empty % 3 - correct % 3) * 256}%`);
  hand.style.setProperty('--hand-y', `${(Math.floor(empty / 3) - Math.floor(correct / 3)) * 230}%`);
}

function celebration(): void {
  if (reducedMotion.matches) return;
  const colors = ['#f65d7d', '#fff083', '#6ed8d4', '#a391ec', '#fff3e5', '#ffae64'];
  const bounds = cells[EMPTY].getBoundingClientRect();
  for (let i = 0; i < 44; i++) {
    const particle = document.createElement('i');
    const angle = -Math.PI * (Math.random() * .90 + .05);
    const radius = 80 + Math.random() * 270;
    const properties = {
      x: `${bounds.x + bounds.width / 2}px`,
      y: `${bounds.y + bounds.height / 2}px`,
      dx: `${Math.cos(angle) * radius}px`,
      dy: `${Math.sin(angle) * radius + 50}px`,
      spin: `${Math.random() * 720 - 360}deg`,
      size: `${5 + Math.random() * 8}px`,
      color: colors[i % colors.length],
      time: `${620 + Math.random() * 510}ms`,
    };
    for (const [key, value] of Object.entries(properties)) particle.style.setProperty(`--${key}`, value);
    particles.append(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}

let view: PuzzleView;
try {
  view = new PuzzleView(required('scene'));
  startLevel();
} catch (error) {
  console.error(error);
  menuTitle.textContent = '3D rendering is unavailable';
  play.hidden = true;
  menu.showModal();
  throw error;
}

function startLevel(): void {
  const level = levels[levelIndex];
  heading.textContent = `Level ${levelIndex + 1}`;
  document.body.style.backgroundColor = level.background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', level.background);
  startingLayout = shuffle(level.shuffleMoves);
  layout = complete ? [...SOLVED] : [...startingLayout];
  view.load(level.createModel(), layout, complete);
  busy = false;
  restart.disabled = false;
  home.disabled = false;
  updateCells();
  tutorial();
  status.textContent = level.name;
  if (!reducedMotion.matches) {
    board.animate([{ opacity: 0, scale: .97 }, { opacity: 1, scale: 1 }], { duration: 360, easing: 'ease-out' });
  }
  if (complete) showMenu();
}

function showMenu(): void {
  menuTitle.textContent = complete ? 'Puzzle complete!' : 'Toy Slide';
  play.textContent = complete ? 'Play again' : 'Continue';
  if (!menu.open) menu.showModal();
}

async function move(index: number): Promise<void> {
  if (busy || complete || menu.open) return;
  const tile = layout[index];
  const destination = slide(layout, index);
  if (destination === undefined) return;
  busy = true;
  if (tile === destination) tutorialSeen = true;
  tutorial();
  updateCells();
  restart.disabled = true;
  home.disabled = true;
  sound.slide();
  await view.move(tile, destination);
  sound.settle();
  if (!solved(layout)) {
    busy = false;
    restart.disabled = false;
    home.disabled = false;
    updateCells();
    if (document.activeElement === cells[index]) cells[destination].focus({ preventScroll: true });
    return;
  }
  save(levelIndex + 1);
  await delay(reducedMotion.matches ? 100 : 330);
  await view.stamp();
  sound.stamp();
  if (!reducedMotion.matches) {
    board.animate([
      { translate: '0 0', scale: '1' },
      { translate: '0 6px', scale: '.985' },
      { translate: '0 -2px', scale: '1.003' },
      { translate: '0 0', scale: '1' },
    ], { duration: 370, easing: 'ease-out' });
  }
  celebration();
  setTimeout(sound.celebrate, 130);
  status.textContent = `${levels[levelIndex].name} complete`;
  await delay(1650);
  if (levelIndex + 1 < levels.length) {
    levelIndex++;
    startLevel();
  } else {
    complete = true;
    showMenu();
  }
}

controls.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  const index = cells.indexOf(event.target as HTMLButtonElement);
  if (index < 0 || busy || complete) return;
  unlockAudio();
  pointer = { id: event.pointerId, index, x: event.clientX, y: event.clientY };
  cells[index].setPointerCapture(event.pointerId);
});

controls.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const { index, x, y } = pointer;
  pointer = undefined;
  const dx = event.clientX - x;
  const dy = event.clientY - y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
  suppressClick = true;
  if (Math.min(Math.abs(dx), Math.abs(dy)) > Math.max(Math.abs(dx), Math.abs(dy)) * .78) return;
  const direction = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 3 * Math.sign(dy);
  if (index + direction === layout.indexOf(EMPTY)) void move(index);
});

controls.addEventListener('pointercancel', event => {
  if (pointer?.id === event.pointerId) pointer = undefined;
});

restart.addEventListener('click', () => {
  if (busy || complete) return;
  unlockAudio();
  layout = [...startingLayout];
  view.reset(layout);
  updateCells();
  tutorial();
});
home.addEventListener('click', () => {
  if (busy) return;
  unlockAudio();
  showMenu();
});
menu.addEventListener('cancel', event => {
  if (complete) event.preventDefault();
});
play.addEventListener('click', () => {
  unlockAudio();
  if (!complete) return;
  complete = false;
  levelIndex = 0;
  save(0);
  startLevel();
});
