import './style.css';
import { paintReveal } from './paint-reveal';
import { levels } from './levels';
import { EMPTY, SOLVED, neighbors, solutionMoves, shuffle, slide, solved } from './puzzle';
import { PuzzleView, delay, reducedMotion } from './view';
import { celebrate } from './confetti';
import { audio } from './audio';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element ${id}`);
  return element as T;
}
const controls = required('controls');
const status = required('status');
const particles = required<HTMLCanvasElement>('particles');
const memoryLabel = required('memory-label');
const memoryNumber = required('memory-number');
const memoryTitle = required('memory-title');
const titleDivider = required('title-divider');
const flourishes = document.querySelectorAll<SVGSVGElement>('.flourish');
const flourishPen = document.querySelector<SVGPathElement>('#flourish-pen')!;
const dividerLines = titleDivider.querySelectorAll('.divider-stroke');
const dividerDiamond = titleDivider.querySelector('.divider-diamond')!;
const board = required('board');
const caption = required('memory-caption');
const moveCount = required('move-count');
const story = required('story');
const storyViewport = required('story-viewport');
const narration = required('narration');
const epilogue = required('epilogue');
const returnHome = required('return-home');
const settingsButton = required<HTMLButtonElement>('settings-button');
const hintButton = required<HTMLButtonElement>('hint-button');
const hintCount = required('hint-count');
const restartButton = required<HTMLButtonElement>('restart-button');
const cornerButtons = [settingsButton, hintButton, restartButton];

function showCornerButtons(visible: boolean): void {
  for (const button of cornerButtons) button.classList.toggle('is-visible', visible);
}

const settingsDialog = required<HTMLDialogElement>('settings-dialog');
const settingsControls = required('settings-controls');
const deleteProgressPanel = required('delete-progress-panel');
const deleteProgressButton = required('delete-progress');
const cancelDeleteProgress = required('cancel-delete-progress');
const deleteProgressError = required('delete-progress-error');
const musicVolume = required<HTMLInputElement>('music-volume');
const effectsVolume = required<HTMLInputElement>('effects-volume');
const muteAudio = required<HTMLInputElement>('mute-audio');
const tutorial = document.querySelector<SVGSVGElement>('#tutorial')!;
const hintKey = 'toy-slide-hints-v1';
const freeHints = 5;
let hintsRemaining = freeHints;
try {
  const saved = localStorage.getItem(hintKey);
  const count = saved === null ? freeHints : Number(saved);
  if (Number.isInteger(count) && count >= 0 && count <= freeHints) hintsRemaining = count;
} catch { /* Hints remain available for this session. */ }

function updateHintButton(disabled: boolean): void {
  hintButton.disabled = disabled || hintsRemaining === 0;
  hintCount.textContent = String(hintsRemaining);
  hintButton.setAttribute('aria-label', `Hint (${hintsRemaining} remaining)`);
}

const progressKey = 'toy-slide-paintings-unlocked-v1';

function restore(): number {
  try {
    const saved = Number(localStorage.getItem(progressKey));
    return Number.isInteger(saved) && saved >= 0 && saved <= levels.length ? saved : 0;
  } catch { return 0; }
}

function save(progress: number): void {
  try { localStorage.setItem(progressKey, String(Math.max(progress, restore()))); }
  catch { /* Play remains available when storage is blocked. */ }
}

const requestedLevel = Number(new URLSearchParams(window.location.search).get('level'));
let hasRequestedLevel = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= levels.length;
const savedProgress = restore();
let levelIndex = hasRequestedLevel ? requestedLevel - 1 : Math.min(savedProgress, levels.length - 1);
let layout: number[] = [];
let initialLayout: number[] = [];
let moves = 0;
let initialSolution: number[] | undefined;
let hintMoves: number[] = [];
let counterPulse: Animation | undefined;
let busy = false;
let pointer: { id: number; index: number; x: number; y: number } | undefined;
let suppressClick = false;

const cells = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.addEventListener('click', event => {
    if (event.detail && suppressClick) return;
    audio.unlock();
    if (!busy) audio.play('tap');
    void move(index);
  });
  controls.append(button);
  return button;
});

function updateCells(): void {
  settingsButton.disabled = restartButton.disabled = busy;
  updateHintButton(busy || !initialSolution?.length);
  const empty = layout.indexOf(EMPTY);
  const movable = neighbors(empty);
  cells.forEach((cell, index) => {
    cell.dataset.movable = String(!busy && movable.includes(index));
    cell.tabIndex = !busy && movable.includes(index) ? 0 : -1;
    cell.setAttribute('aria-disabled', String(busy || !movable.includes(index)));
    cell.setAttribute('aria-label', index === empty ? 'Empty space' : `Tile, row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}`);
  });
}

function unlockFromPointer(): void { audio.unlock(); }
window.addEventListener('pointerdown', unlockFromPointer, { capture: true, passive: true });
window.addEventListener('pointerup', unlockFromPointer, { capture: true, passive: true });
function refreshAudioControls(): void {
  const settings = audio.settings;
  musicVolume.value = String(Math.round(settings.music * 100));
  effectsVolume.value = String(Math.round(settings.effects * 100));
  muteAudio.checked = settings.muted;
}

function showDeleteConfirmation(show: boolean): void {
  settingsControls.hidden = show;
  deleteProgressPanel.hidden = !show;
  deleteProgressError.hidden = true;
  settingsDialog.setAttribute('aria-labelledby', show ? 'delete-progress-title' : 'settings-title');
  if (show) settingsDialog.setAttribute('aria-describedby', 'delete-progress-description');
  else settingsDialog.removeAttribute('aria-describedby');
}

let settingsTransition = false;

async function animateSettings(element: HTMLElement, opening: boolean): Promise<void> {
  if (reducedMotion.matches) return;
  const tucked = { opacity: 0, transform: 'translateY(5px) scale(.96)' };
  const settled = { opacity: 1, transform: 'none' };
  await element.animate(opening ? [tucked, settled] : [settled, tucked], {
    duration: 200,
    easing: opening ? 'cubic-bezier(.2,.7,.3,1)' : 'cubic-bezier(.7,0,.8,.3)',
  }).finished;
}

async function switchSettingsPanel(confirming: boolean): Promise<void> {
  if (settingsTransition) return;
  settingsTransition = true;
  await animateSettings(confirming ? settingsControls : deleteProgressPanel, false);
  showDeleteConfirmation(confirming);
  (confirming ? cancelDeleteProgress : deleteProgressButton).focus();
  await animateSettings(confirming ? deleteProgressPanel : settingsControls, true);
  settingsTransition = false;
}

async function closeSettings(): Promise<void> {
  settingsTransition = true;
  await animateSettings(settingsDialog, false);
  settingsDialog.close();
  settingsTransition = false;
}

settingsButton.addEventListener('click', async () => {
  audio.unlock();
  audio.play('tap');
  refreshAudioControls();
  showDeleteConfirmation(false);
  settingsTransition = true;
  settingsDialog.showModal();
  await animateSettings(settingsDialog, true);
  settingsTransition = false;
});
required('close-settings').addEventListener('click', () => {
  if (!settingsTransition) void closeSettings();
});
settingsDialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (!settingsTransition) void closeSettings();
});
deleteProgressButton.addEventListener('click', () => {
  audio.play('tap');
  void switchSettingsPanel(true);
});
cancelDeleteProgress.addEventListener('click', () => {
  void switchSettingsPanel(false);
});
required('confirm-delete-progress').addEventListener('click', async () => {
  if (settingsTransition) return;
  try {
    localStorage.removeItem(progressKey);
  } catch {
    deleteProgressError.hidden = false;
    return;
  }
  await closeSettings();
  const url = new URL(window.location.href);
  url.searchParams.delete('level');
  window.history.replaceState(null, '', url);
  hasRequestedLevel = false;
  levelIndex = 0;
  void startLevel();
});
restartButton.addEventListener('click', () => {
  audio.unlock();
  audio.play('tap');
  void startLevel(true);
});
hintButton.addEventListener('click', () => {
  if (hintButton.disabled) return;
  hintsRemaining--;
  try { localStorage.setItem(hintKey, String(hintsRemaining)); }
  catch { /* The count remains available for this session. */ }
  audio.unlock();
  audio.play('tap');
  void startLevel(true, true);
});
returnHome.addEventListener('click', async () => {
  returnHome.setAttribute('disabled', '');
  audio.unlock();
  audio.play('tap');
  await fade(story, 1, 0);
  const url = new URL(window.location.href);
  url.searchParams.set('level', '1');
  window.history.replaceState(null, '', url);
  hasRequestedLevel = true;
  levelIndex = 0;
  await startLevel();
});

musicVolume.addEventListener('input', () => audio.setMusicVolume(musicVolume.valueAsNumber / 100));
effectsVolume.addEventListener('input', () => audio.setEffectsVolume(effectsVolume.valueAsNumber / 100));
muteAudio.addEventListener('change', () => audio.setMuted(muteAudio.checked));

window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.toLowerCase() === 'm') {
    audio.toggleMute();
  } else if (event.code === 'BracketLeft' || event.code === 'BracketRight') {
    const delta = event.code === 'BracketLeft' ? -.05 : .05;
    if (event.shiftKey) audio.adjustEffects(delta);
    else audio.adjustMusic(delta);
  }
  if (settingsDialog.open) refreshAudioControls();
  audio.unlock();
});

const view = new PuzzleView(required('tiles'), required('painting'), required('shine'), required('backing'));
void startGame();

async function startGame(): Promise<void> {
  audio.preloadOpening();
  const splash = required('splash');
  const title = required('splash-title');
  const artwork = required<HTMLImageElement>('splash-artwork');
  const minimumDisplay = delay(2000);
  if (reducedMotion.matches) {
    await artwork.decode().catch(() => {});
    title.classList.remove('is-painting');
  } else {
    await paintReveal(title, 0, 1050, artwork).catch(() => {});
  }
  await minimumDisplay;
  audio.unlock();
  await Promise.all([
    fade(splash, 1, 0).then(() => { splash.hidden = true; }),
    startLevel(false, false, !hasRequestedLevel && savedProgress === levels.length),
  ]);
}

async function fade(element: HTMLElement, from: number, to: number): Promise<void> {
  element.style.opacity = String(to);
  if (!reducedMotion.matches) {
    await element.animate([{ opacity: from }, { opacity: to }], {
      duration: 440, easing: 'cubic-bezier(.4,0,.3,1)',
    }).finished;
  }
}

async function enterMemory(): Promise<{ narrationFinished?: Promise<Animation> }> {
  audio.play('number');
  if (reducedMotion.matches) return {};
  const animate = (element: Element, delay: number, duration: number, transform = 'none') =>
    element.animate([{ opacity: 0, transform }, { opacity: 1, transform: 'none' }], {
      delay, duration, easing: 'cubic-bezier(.22,.65,.3,1)', fill: 'backwards',
    }).finished;

  void animate(memoryLabel, 0, 300, 'translateY(6px)');
  // Hold the later stages while the local font loads, then run them on one timeline.
  const pending = [titleDivider, board, moveCount, caption, ...Array.from(flourishes)];
  pending.forEach(element => { (element as HTMLElement | SVGElement).style.opacity = '0'; });
  const painted = paintReveal(memoryTitle, 170, 1050);
  const style = getComputedStyle(memoryTitle);
  await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, memoryTitle.textContent ?? '').catch(() => {});
  pending.forEach(element => { (element as HTMLElement | SVGElement).style.opacity = ''; });
  audio.play('paint', .17);
  audio.play('ornament', 1);
  audio.play('frame', 1.69);

  const draw = (path: Element, delay: number, duration: number) => {
    path.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], {
      delay, duration, easing: 'cubic-bezier(.35,.12,.25,1)', fill: 'backwards',
    });
  };
  flourishes.forEach(flourish => { void animate(flourish, 1000, 110); });
  draw(flourishPen, 1000, 530);
  dividerLines.forEach(line => draw(line, 1060, 490));
  void animate(dividerDiamond, 1060, 220);
  void animate(moveCount, 1440, 350, 'translateY(3px)');
  const narrationFinished = animate(caption, 1580, 410, 'translateY(4px)');
  await Promise.all([painted.catch(() => {}), animate(board, 1300, 470, 'scale(.975)')]);
  return { narrationFinished };
}

function resetTutorialMotion(): void {
  tutorial.setCurrentTime(0);
  if (reducedMotion.matches) tutorial.pauseAnimations();
  else tutorial.unpauseAnimations();
}

reducedMotion.addEventListener('change', resetTutorialMotion);

function showTutorial(): void {
  const from = hintMoves[0] ?? (levelIndex === 0 ? solutionMoves(layout)?.[0] : undefined);
  if (from === undefined) {
    tutorial.setAttribute('hidden', '');
    return;
  }
  const x = from % 3;
  const y = Math.floor(from / 3);
  tutorial.style.left = `${(x + .5) * 100 / 3}%`;
  tutorial.style.top = `${(y + .5) * 100 / 3}%`;
  if (tutorial.hasAttribute('hidden')) {
    tutorial.removeAttribute('hidden');
    resetTutorialMotion();
  }
}

async function startLevel(restart = false, guided = false, restoreEnding = false): Promise<void> {
  const level = levels[levelIndex];
  showCornerButtons(false);
  busy = true;
  if (!restart) {
    initialLayout = level.startingBoard ? [...level.startingBoard] : shuffle(level.minimumMoves);
    initialSolution = solutionMoves(initialLayout);
  }
  layout = restoreEnding ? [...SOLVED] : [...initialLayout];
  story.classList.remove('is-epilogue');
  epilogue.hidden = true;
  returnHome.classList.remove('is-visible');
  returnHome.removeAttribute('disabled');
  for (const element of [moveCount, caption]) {
    element.hidden = false;
    element.style.opacity = '';
  }
  hintMoves = guided ? initialSolution?.slice(0, 2) ?? [] : [];
  tutorial.setAttribute('hidden', '');
  moves = 0;
  renderMoves();
  const artworkReady = view.load(level.artwork, layout);
  memoryNumber.textContent = `Memory ${level.id}`;
  memoryTitle.textContent = level.name;
  narration.textContent = level.narration;
  updateCells();
  story.style.opacity = '1';
  story.hidden = false;
  storyViewport.scrollTop = 0;
  if (restoreEnding) {
    await artworkReady;
    await view.reveal(false);
    await showEpilogue(false);
    return;
  }
  const { narrationFinished } = await enterMemory();
  const tilesFinished = view.entranceRipple();
  if (!reducedMotion.matches) audio.play('entrance');
  busy = false;
  updateCells();
  showTutorial();
  status.textContent = `Memory ${levels[levelIndex].id}`;
  const enteredLayout = layout;
  await Promise.all([artworkReady, narrationFinished, tilesFinished]);
  if (layout === enteredLayout && !solved(layout)) showCornerButtons(true);
}

function renderMoves(pulse = false): void {
  moveCount.textContent = `Moves: ${moves}/${initialSolution?.length ?? -1}`;
  counterPulse?.cancel();
  if (pulse && !reducedMotion.matches) {
    counterPulse = moveCount.animate([
      { scale: 1 },
      { scale: 1.065, offset: .42 },
      { scale: 1 },
    ], { duration: 300, easing: 'ease-in-out' });
  }
}

async function showEpilogue(animate: boolean): Promise<void> {
  if (animate) {
    hintButton.classList.remove('is-visible');
    restartButton.classList.remove('is-visible');
    await Promise.all([fade(moveCount, 1, 0), fade(caption, 1, 0)]);
    audio.play('sparkle', 0, .45);
  }
  moveCount.hidden = true;
  caption.hidden = true;
  story.classList.add('is-epilogue');
  epilogue.classList.toggle('is-revealing', animate);
  epilogue.hidden = false;
  status.textContent = 'Chapter 1 complete';
  if (animate) await delay(3000);
  settingsButton.disabled = false;
  settingsButton.classList.add('is-visible');
  returnHome.classList.add('is-visible');
}

async function move(index: number): Promise<void> {
  if (busy) return;
  const tile = layout[index];
  const destination = slide(layout, index);
  if (destination === undefined) return;
  busy = true;
  if (hintMoves[0] === index) hintMoves.shift();
  else hintMoves = [];
  const completed = solved(layout);
  if (completed || (levelIndex !== 0 && !hintMoves.length)) tutorial.setAttribute('hidden', '');
  updateCells();
  audio.play('slide');
  await view.move(tile, destination);
  moves++;
  renderMoves(true);
  audio.play('settle');
  if (!completed) {
    if (tile === destination) {
      view.correctPlacement(destination, layout);
      audio.play('correct');
      if (neighbors(destination).some(index => index !== EMPTY && layout[index] === index)) {
        audio.play('neighbors', .07);
      }
    }
    busy = false;
    updateCells();
    showTutorial();
    if (document.activeElement === cells[index]) cells[destination].focus({ preventScroll: true });
    return;
  }
  view.clearPulses();
  const nextLevel = levels[levelIndex + 1];
  if (nextLevel) showCornerButtons(false);
  const nextArtwork = nextLevel ? new Image() : undefined;
  if (nextArtwork && nextLevel) nextArtwork.src = nextLevel.artwork;

  await delay(reducedMotion.matches ? 100 : 230);
  await view.stamp();
  audio.play('stamp');
  if (nextLevel) audio.play('sparkle');
  const confetti = celebrate(particles);
  await view.celebrate();
  status.textContent = `${levels[levelIndex].name} restored`;
  audio.play('painting', 0, nextLevel ? 1 : .55);
  await view.reveal();
  const frameCelebration = reducedMotion.matches ? undefined : board.animate([
    { transform: 'none' },
    { transform: 'translateY(-1.5px) rotate(-.55deg)', offset: .22 },
    { transform: 'translateY(-.5px) rotate(.38deg)', offset: .47 },
    { transform: 'rotate(-.16deg)', offset: .71 },
    { transform: 'none' },
  ], { duration: 540, easing: 'ease-in-out' }).finished;
  if (nextArtwork) {
    save(levelIndex + 1);
    await Promise.all([delay(2000), confetti, frameCelebration, nextArtwork.decode().catch(() => {})]);
    audio.play('page');
    await fade(story, 1, 0);
    story.hidden = true;
    levelIndex++;
    if (hasRequestedLevel) {
      const url = new URL(window.location.href);
      url.searchParams.set('level', String(levelIndex + 1));
      window.history.replaceState(null, '', url);
    }
    await startLevel();
  } else {
    save(levels.length);
    const url = new URL(window.location.href);
    url.searchParams.delete('level');
    window.history.replaceState(null, '', url);
    hasRequestedLevel = false;
    await Promise.all([showEpilogue(true), confetti, frameCelebration]);
  }
}

controls.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  const index = cells.indexOf(event.target as HTMLButtonElement);
  if (index < 0 || busy) return;
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
