import './style.css';
import { paintReveal } from './paint-reveal';
import { levels } from './levels';
import { EMPTY, SOLVED, neighbors, solutionMoves, shuffle, slide, solved } from './puzzle';
import { PuzzleView, delay, reducedMotion } from './view';
import { celebrate } from './confetti';
import { audio } from './audio';
import { poki } from './poki';
import { createAdPolicy } from './ads';
import { flag } from './flags';
import { currentLanguage, languages, memoryStory as storyText, memoryTitle as titleText, pickLanguage, savedLanguage, setLanguage, t, translatePage } from './i18n';

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
const closeSettingsButton = required<HTMLButtonElement>('close-settings');
const deleteProgressPanel = required('delete-progress-panel');
const deleteProgressButton = required('delete-progress');
const cancelDeleteProgress = required('cancel-delete-progress');
const deleteProgressError = required('delete-progress-error');
const musicToggle = required<HTMLButtonElement>('toggle-music');
const effectsToggle = required<HTMLButtonElement>('toggle-effects');
const tutorial = document.querySelector<SVGSVGElement>('#tutorial')!;
const hintKey = 'toy-slide-hints-v1';
const freeHints = 5;
let hintsRemaining = freeHints;
try {
  const saved = localStorage.getItem(hintKey);
  const count = saved === null ? freeHints : Number(saved);
  if (Number.isInteger(count) && count >= 0 && count <= freeHints) hintsRemaining = count;
} catch { /* Hints remain available for this session. */ }

const perfectSeal = required('perfect-seal');
// Poki ad breaks: every rule is in ads.ts. Memories 1–5 are ad-free; from Memory 6 a break is
// requested after a completed memory or every third restart. Poki decides whether an ad shows.
const adPolicy = createAdPolicy({
  firstMemory: 6,
  lastMemory: levels.length,
  restartsPerBreak: 3,
  showBreak: () => poki.commercialBreak(),
});

// A gentle nudge: after 15 s without a tile landing in its right spot, the hint bulb jiggles once.
// It waits while the game is busy, hidden or paused in Settings, skips Memory 1 (which has its own
// hand), and never points at a 🎬 ad.
const nudgeAfter = 15000;
let lastProgressAt = performance.now();
let nudged = false;
function noteProgress(): void {
  lastProgressAt = performance.now();
  nudged = false;
}
window.setInterval(() => {
  const now = performance.now();
  const ready = !busy && !document.hidden && !settingsDialog.open && levelIndex !== 0
    && hintButton.classList.contains('is-visible') && !hintButton.disabled && hintsRemaining > 0;
  if (!ready) {
    lastProgressAt = Math.max(lastProgressAt, now - nudgeAfter + 3000);
    return;
  }
  if (nudged || now - lastProgressAt < nudgeAfter) return;
  nudged = true;
  if (reducedMotion.matches) return;
  hintButton.animate([
    { rotate: '0deg' }, { rotate: '-14deg', offset: .15 }, { rotate: '12deg', offset: .32 },
    { rotate: '-8deg', offset: .5 }, { rotate: '5deg', offset: .68 }, { rotate: '0deg' },
  ], { duration: 750, easing: 'ease-in-out' });
}, 1000);

function updateHintButton(disabled: boolean): void {
  // Once the free hints are used, Poki builds offer one more hint per rewarded video.
  const rewarded = hintsRemaining === 0 && poki.available;
  hintButton.disabled = disabled || (hintsRemaining === 0 && !rewarded);
  hintButton.classList.toggle('is-rewarded', rewarded);
  hintCount.textContent = rewarded ? '🎬' : String(hintsRemaining);
  hintButton.setAttribute('aria-label', rewarded ? t('hint.rewarded') : t('hint.label', { n: hintsRemaining }));
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
/** The current memory's missing piece: the empty space while playing, stamped back in at the end. */
let gap = EMPTY;
let initialLayout: number[] = [];
let moves = 0;
let initialSolution: number[] | undefined;
let hintMoves: number[] = [];
let counterPulse: Animation | undefined;
let busy = false;
type Drag = { id: number; index: number; x: number; y: number; at: number; toward?: number; progress: number; dragging: boolean };
let pointer: Drag | undefined;
let suppressClick = false;

/** A short buzz on phones that support it (Android); everywhere else this quietly does nothing.
 *  Browsers refuse vibration before the player's first real tap, and always inside another site's
 *  frame (as on Poki), logging an error each time, so it is skipped in both cases. */
const canBuzz = 'vibrate' in navigator && window.self === window.top;
function buzz(pattern: number | number[]): void {
  if (!canBuzz || !navigator.userActivation?.hasBeenActive) return;
  try { navigator.vibrate(pattern); } catch { /* Vibration is optional. */ }
}

function canMove(index: number): boolean {
  return neighbors(layout.indexOf(gap)).includes(index);
}

/** A tile that isn't next to the gap wiggles with a soft tap, so players learn the rule without text. */
function refuse(index: number): void {
  if (busy || layout[index] === gap) return;
  view.refuse(layout[index]);
  audio.play('tap', 0, .35);
}

const cells = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.addEventListener('click', event => {
    if (event.detail && suppressClick) return;
    audio.unlock();
    if (busy) return;
    if (!canMove(index)) {
      refuse(index);
      return;
    }
    audio.play('tap');
    void move(index);
  });
  controls.append(button);
  return button;
});

function updateCells(): void {
  settingsButton.disabled = restartButton.disabled = busy;
  // One hint at a time: the button stays off until both suggested moves are made or abandoned.
  updateHintButton(busy || !initialSolution?.length || hintMoves.length > 0);
  hintButton.classList.toggle('is-active', hintMoves.length > 0);
  const empty = layout.indexOf(gap);
  const movable = neighbors(empty);
  cells.forEach((cell, index) => {
    cell.dataset.movable = String(!busy && movable.includes(index));
    cell.tabIndex = !busy && movable.includes(index) ? 0 : -1;
    cell.setAttribute('aria-disabled', String(busy || !movable.includes(index)));
    cell.setAttribute('aria-label', index === empty ? t('board.empty') : t('board.tile', { row: Math.floor(index / 3) + 1, column: index % 3 + 1 }));
  });
}

function unlockFromPointer(): void { audio.unlock(); }
window.addEventListener('pointerdown', unlockFromPointer, { capture: true, passive: true });
window.addEventListener('pointerup', unlockFromPointer, { capture: true, passive: true });
function refreshAudioControls(): void {
  for (const [button, channel] of [[musicToggle, 'music'], [effectsToggle, 'effects']] as const) {
    const on = audio.isOn(channel);
    button.setAttribute('aria-pressed', String(on));
    button.title = channel === 'music'
      ? t(on ? 'settings.musicOn' : 'settings.musicOff')
      : t(on ? 'settings.effectsOn' : 'settings.effectsOff');
  }
}

// The Settings dialog shows one panel at a time: the main buttons, the language flags, or the
// delete confirmation.
type Panel = 'settings' | 'language' | 'delete';
const languagePanel = required('language-panel');
const panels: Record<Panel, HTMLElement> = { settings: settingsControls, language: languagePanel, delete: deleteProgressPanel };
const panelTitles: Record<Panel, string> = { settings: 'settings-title', language: 'language-title', delete: 'delete-progress-title' };
let shownPanel: Panel = 'settings';

function showPanel(panel: Panel): void {
  shownPanel = panel;
  for (const [name, element] of Object.entries(panels)) element.hidden = name !== panel;
  // The confirmation has its own round ✕, so the corner ✕ steps aside to avoid two crosses.
  closeSettingsButton.hidden = panel === 'delete';
  deleteProgressError.hidden = true;
  settingsDialog.setAttribute('aria-labelledby', panelTitles[panel]);
  if (panel === 'delete') settingsDialog.setAttribute('aria-describedby', 'delete-progress-description');
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

async function switchPanel(panel: Panel, focus: HTMLElement): Promise<void> {
  if (settingsTransition || panel === shownPanel) return;
  settingsTransition = true;
  await animateSettings(panels[shownPanel], false);
  showPanel(panel);
  focus.focus();
  await animateSettings(panels[panel], true);
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
  poki.gameplayStop();
  refreshAudioControls();
  showPanel('settings');
  settingsTransition = true;
  settingsDialog.showModal();
  // Start focus on the dialog itself, so no button opens with a focus ring; Tab still reaches them.
  settingsDialog.focus();
  await animateSettings(settingsDialog, true);
  settingsTransition = false;
});
closeSettingsButton.addEventListener('click', () => {
  if (!settingsTransition) void closeSettings();
});
settingsDialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (!settingsTransition) void closeSettings();
});
deleteProgressButton.addEventListener('click', () => {
  audio.play('tap');
  void switchPanel('delete', cancelDeleteProgress);
});
cancelDeleteProgress.addEventListener('click', () => {
  void switchPanel('settings', deleteProgressButton);
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
function lockBoard(): void {
  busy = true;
  showCornerButtons(false);
  updateCells();
}

restartButton.addEventListener('click', async () => {
  audio.unlock();
  audio.play('tap');
  lockBoard();
  // Every third restart (from Memory 6) may bring an ad, shown before the puzzle resets.
  await adPolicy.beforeRestart(levels[levelIndex].id);
  void startLevel(true);
});
hintButton.addEventListener('click', async () => {
  if (hintButton.disabled) return;
  audio.unlock();
  audio.play('tap');
  if (hintsRemaining > 0) {
    hintsRemaining--;
    try { localStorage.setItem(hintKey, String(hintsRemaining)); }
    catch { /* The count remains available for this session. */ }
    audio.play('sparkle', 0, .5);
    giveHint();
    return;
  }
  lockBoard();
  const rewarded = await poki.rewardedBreak();
  busy = false;
  showCornerButtons(true);
  if (rewarded) {
    audio.play('sparkle');
    giveHint();
  } else updateCells();
});

/** Guide the next two moves of a shortest path from the board as it is now, keeping all progress. */
function giveHint(): void {
  noteProgress();
  hintMoves = solutionMoves(layout, gap)?.slice(0, 2) ?? [];
  updateCells();
  showTutorial();
}
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

// Long words in some languages (German "Weihnachtsmorgen", Polish "Bożonarodzeniowy") are wider
// than the title's space on small screens. Rather than split a word, the title shrinks just enough
// for its longest word to fit on one line; other titles keep their normal size.
let measureContext: CanvasRenderingContext2D | null = null;
async function fitTitle(): Promise<void> {
  memoryTitle.style.fontSize = '';
  const text = memoryTitle.textContent ?? '';
  const style = getComputedStyle(memoryTitle);
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  await document.fonts.load(font, text).catch(() => {});
  const width = memoryTitle.parentElement ? memoryTitle.clientWidth : 0;
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!width || !measureContext) return;
  measureContext.font = font;
  measureContext.direction = style.direction === 'rtl' ? 'rtl' : 'ltr';
  const longest = Math.max(...words(text).map(word => measureContext!.measureText(word).width));
  if (longest > width) memoryTitle.style.fontSize = `${parseFloat(style.fontSize) * width / longest * .97}px`;
}
/** The words of a title. Thai is written without spaces, so its words come from the browser's word breaker. */
function words(text: string): string[] {
  if (currentLanguage() === 'th' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), part => part.segment.trim()).filter(Boolean);
  }
  return text.split(/\s+/);
}
let refitTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(refitTimer);
  refitTimer = window.setTimeout(() => { void fitTitle(); }, 120);
});

// Language: a round flag button in Settings opens a grid of round flags. A choice applies at once,
// keeps all progress, and is remembered. Each flag still carries its language's name for screen
// readers and as a hover tooltip.
const languageButton = required<HTMLButtonElement>('language-button');
const languageGrid = required('language-grid');
const flagButtons = languages.map(({ code, name }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'round-button flag-button';
  button.lang = code;
  button.title = name;
  button.setAttribute('aria-label', name);
  button.innerHTML = flag(code);
  button.addEventListener('click', async () => {
    if (settingsTransition) return;
    audio.play('tap');
    if (code !== currentLanguage()) {
      await setLanguage(code, true);
      applyLanguage();
    }
    void switchPanel('settings', languageButton);
  });
  languageGrid.append(button);
  return button;
});
languageButton.addEventListener('click', () => {
  audio.play('tap');
  void switchPanel('language', flagButtons.find(button => button.lang === currentLanguage()) ?? flagButtons[0]);
});

/** Show the current language everywhere, without restarting the memory or losing any progress. */
function applyLanguage(): void {
  translatePage();
  const current = languages.find(language => language.code === currentLanguage())!;
  languageButton.querySelector('.language-flag')!.innerHTML = flag(current.code);
  const languageName = languageButton.querySelector<HTMLElement>('.language-name')!;
  languageName.textContent = current.name;
  languageName.lang = current.code;
  languageButton.title = current.name;
  languageButton.setAttribute('aria-label', `${t('language.label')}: ${current.name}`);
  for (const button of flagButtons) button.setAttribute('aria-pressed', String(button.lang === current.code));
  const level = levels[levelIndex];
  if (!story.hidden) {
    memoryNumber.textContent = t('memory.label', { n: level.id, total: levels.length });
    memoryTitle.textContent = titleText(level.id);
    narration.textContent = storyText(level.id);
    renderMoves();
    void fitTitle();
  }
  updateCells();
  refreshAudioControls();
}

musicToggle.addEventListener('click', () => {
  audio.setOn('music', !audio.isOn('music'));
  audio.play('tap');
  refreshAudioControls();
});
effectsToggle.addEventListener('click', () => {
  audio.setOn('effects', !audio.isOn('effects'));
  // Plays only when effects just came on, so switching them on is heard and off is silent.
  audio.play('tap');
  refreshAudioControls();
});

window.addEventListener('keydown', event => {
  if (poki.adPlaying || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
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

if (poki.enabled) {
  // On Poki the game sits in an iframe on a scrolling page: keep keys and the wheel from scrolling it.
  window.addEventListener('keydown', event => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, dialog')) return;
    if (['ArrowDown', 'ArrowUp', ' '].includes(event.key)) event.preventDefault();
  });
  window.addEventListener('wheel', event => {
    const target = event.target as Node | null;
    const scrollable = storyViewport.scrollHeight > storyViewport.clientHeight;
    if (!scrollable || !target || !storyViewport.contains(target)) event.preventDefault();
  }, { passive: false });
}

const view = new PuzzleView(required('tiles'), required('painting'), required('shine'), required('backing'));
void startGame();

async function startGame(): Promise<void> {
  audio.preloadOpening();
  const languageReady = poki.ready
    .then(() => setLanguage(pickLanguage(savedLanguage(), poki.language(), navigator.languages)))
    .then(applyLanguage);
  const splash = required('splash');
  const title = required('splash-title');
  const artwork = required<HTMLImageElement>('splash-artwork');
  // On the website the title holds for at least 2 seconds. On Poki it stays only while loading:
  // the SDK, and the first memory's painting, so the game never appears without its artwork.
  const firstArtwork = new Image();
  firstArtwork.src = levels[levelIndex].artwork;
  const minimumDisplay = poki.enabled
    ? Promise.all([poki.ready, firstArtwork.decode().catch(() => {})])
    : Promise.all([delay(2000), poki.ready]);
  if (reducedMotion.matches) {
    await artwork.decode().catch(() => {});
    title.classList.remove('is-painting');
  } else {
    await paintReveal(title, 0, 1050, artwork).catch(() => {});
  }
  await Promise.all([minimumDisplay, languageReady]);
  poki.loadingFinished();
  audio.unlock();
  await Promise.all([
    fade(splash, 1, 0).then(() => { splash.hidden = true; }),
    startLevel(false, !hasRequestedLevel && savedProgress === levels.length),
  ]);
}

async function fade(element: HTMLElement, from: number, to: number, duration = 440): Promise<void> {
  element.style.opacity = String(to);
  if (!reducedMotion.matches) {
    await element.animate([{ opacity: from }, { opacity: to }], {
      duration, easing: 'cubic-bezier(.4,0,.3,1)',
    }).finished;
  }
}

/** Wait `ms`, or less if the player taps, clicks or presses a key first. */
function waitOrTap(ms: number): Promise<void> {
  return new Promise(resolve => {
    const stop = new AbortController();
    const done = () => {
      stop.abort();
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    window.addEventListener('pointerdown', done, { capture: true, signal: stop.signal });
    window.addEventListener('keydown', done, { capture: true, signal: stop.signal });
  });
}

async function enterMemory(): Promise<{ narrationFinished?: Promise<Animation> }> {
  audio.play('number');
  if (reducedMotion.matches) return {};
  const animate = (element: Element, delay: number, duration: number, transform = 'none') =>
    element.animate([{ opacity: 0, transform }, { opacity: 1, transform: 'none' }], {
      delay, duration, easing: 'cubic-bezier(.22,.65,.3,1)', fill: 'backwards',
    }).finished;

  // The same choreography as before, about 1.6x faster, so players reach the board sooner.
  void animate(memoryLabel, 0, 240, 'translateY(6px)');
  // Hold the later stages while the local font loads, then run them on one timeline.
  const pending = [titleDivider, board, moveCount, caption, ...Array.from(flourishes)];
  pending.forEach(element => { (element as HTMLElement | SVGElement).style.opacity = '0'; });
  const painted = paintReveal(memoryTitle, 110, 700);
  const style = getComputedStyle(memoryTitle);
  await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, memoryTitle.textContent ?? '').catch(() => {});
  pending.forEach(element => { (element as HTMLElement | SVGElement).style.opacity = ''; });
  audio.play('paint', .11);
  audio.play('ornament', .62);
  audio.play('frame', 1.05);

  const draw = (path: Element, delay: number, duration: number) => {
    path.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], {
      delay, duration, easing: 'cubic-bezier(.35,.12,.25,1)', fill: 'backwards',
    });
  };
  flourishes.forEach(flourish => { void animate(flourish, 620, 110); });
  draw(flourishPen, 620, 400);
  dividerLines.forEach(line => draw(line, 660, 380));
  void animate(dividerDiamond, 660, 200);
  void animate(moveCount, 860, 300, 'translateY(3px)');
  const narrationFinished = animate(caption, 940, 340, 'translateY(4px)');
  await Promise.all([painted.catch(() => {}), animate(board, 760, 380, 'scale(.975)')]);
  return { narrationFinished };
}

function resetTutorialMotion(): void {
  tutorial.setCurrentTime(0);
  if (reducedMotion.matches) tutorial.pauseAnimations();
  else tutorial.unpauseAnimations();
}

reducedMotion.addEventListener('change', resetTutorialMotion);

let tutorialFade: Animation | undefined;

/** While a hint is active, the tile to move next glows (the Memory 1 tutorial hand alone does not). */
function markHintedCell(index?: number): void {
  cells.forEach((cell, i) => cell.classList.toggle('is-hinted', i === index));
}

function showTutorial(): void {
  const from = hintMoves[0] ?? (levelIndex === 0 ? solutionMoves(layout, gap)?.[0] : undefined);
  if (from === undefined) {
    hideTutorial();
    return;
  }
  markHintedCell(hintMoves.length ? from : undefined);
  tutorialFade?.cancel();
  tutorialFade = undefined;
  const x = from % 3;
  const y = Math.floor(from / 3);
  tutorial.style.left = `${(x + .5) * 100 / 3}%`;
  tutorial.style.top = `${(y + .5) * 100 / 3}%`;
  if (tutorial.hasAttribute('hidden')) {
    tutorial.removeAttribute('hidden');
    resetTutorialMotion();
    if (!reducedMotion.matches) {
      tutorial.animate([{ opacity: 0, scale: .85 }, { opacity: 1, scale: 1 }], {
        duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)',
      });
    }
  }
}

function hideTutorial(immediate = false): void {
  markHintedCell();
  if (tutorial.hasAttribute('hidden') || tutorialFade) return;
  if (immediate || reducedMotion.matches) {
    tutorial.setAttribute('hidden', '');
    return;
  }
  const fade = tutorialFade = tutorial.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' });
  fade.finished.then(() => {
    if (tutorialFade !== fade) return;
    tutorialFade = undefined;
    tutorial.setAttribute('hidden', '');
  }).catch(() => {});
}

async function startLevel(restart = false, restoreEnding = false): Promise<void> {
  const level = levels[levelIndex];
  gap = level.gap ?? EMPTY;
  showCornerButtons(false);
  busy = true;
  if (!restart) {
    initialLayout = level.startingBoard ? [...level.startingBoard] : shuffle(level.minimumMoves, Math.random, level.gap);
    initialSolution = solutionMoves(initialLayout, level.gap);
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
  hintMoves = [];
  tutorialFade?.cancel();
  tutorialFade = undefined;
  tutorial.setAttribute('hidden', '');
  markHintedCell();
  moves = 0;
  renderMoves();
  const artworkReady = view.load(level.artwork, layout, gap);
  memoryNumber.textContent = t('memory.label', { n: level.id, total: levels.length });
  perfectSeal.hidden = true;
  memoryTitle.textContent = titleText(level.id);
  narration.textContent = storyText(level.id);
  updateCells();
  story.hidden = false;
  await fitTitle();
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
  // The narration is already fading in by now, so the buttons arrive with it rather than
  // waiting for the tile ripple and every other entrance animation to settle.
  showCornerButtons(true);
  status.textContent = t('memory.label', { n: levels[levelIndex].id, total: levels.length });
  noteProgress();
  await Promise.all([artworkReady, narrationFinished, tilesFinished]);
}

function renderMoves(pulse = false): void {
  const target = initialSolution?.length ?? -1;
  const count = document.createElement('span');
  count.textContent = String(moves);
  // Past the best possible solution: the count turns red so players know they've gone over.
  count.classList.toggle('is-over', target >= 0 && moves > target);
  // The template keeps {count} as a marker, so the number can be its own (red when over) element.
  const [before, after = ''] = t('memory.moves', { target }).split('{count}');
  moveCount.replaceChildren(before, count, after);
  counterPulse?.cancel();
  if (pulse && !reducedMotion.matches) {
    counterPulse = moveCount.animate([
      { scale: 1 },
      { scale: 1.065, offset: .42 },
      { scale: 1 },
    ], { duration: 300, easing: 'ease-in-out' });
  }
}

async function stampPerfectSeal(): Promise<void> {
  perfectSeal.hidden = false;
  audio.play('stamp', .05, .8);
  audio.play('sparkle', .22, .5);
  if (reducedMotion.matches) return;
  await perfectSeal.animate([
    { opacity: 0, scale: 1.9, rotate: '4deg', easing: 'cubic-bezier(.5,0,.75,0)' },
    { opacity: 1, scale: .92, rotate: '14deg', offset: .62, easing: 'cubic-bezier(.2,.8,.3,1)' },
    { opacity: 1, scale: 1, rotate: '12deg' },
  ], { duration: 460 }).finished.catch(() => {});
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
  status.textContent = t('memory.chapterComplete');
  if (animate) await delay(3000);
  settingsButton.disabled = false;
  settingsButton.classList.add('is-visible');
  returnHome.classList.add('is-visible');
}

async function move(index: number, dragged = 0): Promise<void> {
  if (busy) return;
  const tile = layout[index];
  const destination = slide(layout, index, gap);
  if (destination === undefined) return;
  poki.gameplayStart();
  busy = true;
  // Following the hint advances it; any other move ends it and the player carries on alone.
  if (hintMoves[0] === index) hintMoves.shift();
  else hintMoves = [];
  const completed = solved(layout);
  // Fade the hand out while the tile slides; showTutorial() brings it back at the next hinted tile.
  hideTutorial();
  updateCells();
  audio.play('slide');
  await view.move(tile, destination, dragged);
  moves++;
  renderMoves(true);
  audio.play('settle');
  if (!completed) {
    if (tile === destination) {
      view.correctPlacement(destination, layout);
      audio.play('correct');
      buzz(12);
      noteProgress();
      if (neighbors(destination).some(index => layout[index] !== gap && layout[index] === index)) {
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
  poki.gameplayStop();
  // Solved in the fewest possible moves: a gold seal is stamped onto the frame.
  const perfect = moves === initialSolution?.length;
  const nextLevel = levels[levelIndex + 1];
  if (nextLevel) showCornerButtons(false);
  const nextArtwork = nextLevel ? new Image() : undefined;
  if (nextArtwork && nextLevel) nextArtwork.src = nextLevel.artwork;

  await delay(reducedMotion.matches ? 100 : 200);
  await view.stamp();
  audio.play('stamp');
  if (nextLevel) audio.play('sparkle');
  buzz(perfect ? [20, 70, 20, 70, 45] : [25, 60, 35]);
  const confetti = celebrate(particles);
  await view.celebrate();
  if (perfect) void stampPerfectSeal();
  status.textContent = t(perfect ? 'memory.perfect' : 'memory.restored', { title: titleText(levels[levelIndex].id) });
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
    // Time to enjoy the finished painting and the confetti. Players who are ready can tap to move on.
    await Promise.all([waitOrTap(1800), frameCelebration, nextArtwork.decode().catch(() => {})]);
    audio.play('page');
    await fade(story, 1, 0, 380);
    story.hidden = true;
    // After the celebration and before the next memory loads (see ads.ts for when).
    await adPolicy.afterMemory(levels[levelIndex].id);
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

// Dragging: a tile next to the gap follows the finger along its one free direction. Releasing past
// a third of the way, or a quick flick, completes the slide; anything less slides it back.
controls.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  const index = cells.indexOf(event.target as HTMLButtonElement);
  if (index < 0 || busy) return;
  const toward = canMove(index) ? layout.indexOf(gap) : undefined;
  pointer = { id: event.pointerId, index, x: event.clientX, y: event.clientY, at: event.timeStamp, toward, progress: 0, dragging: false };
  cells[index].setPointerCapture(event.pointerId);
});

controls.addEventListener('pointermove', event => {
  if (!pointer || pointer.id !== event.pointerId || busy) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.dragging && Math.hypot(dx, dy) < 12) return;
  pointer.dragging = true;
  if (pointer.toward === undefined) return;
  const cell = controls.clientWidth / 3;
  const stepX = pointer.toward % 3 - pointer.index % 3;
  const stepY = Math.floor(pointer.toward / 3) - Math.floor(pointer.index / 3);
  pointer.progress = Math.max(0, Math.min(1, (dx * stepX + dy * stepY) / cell));
  view.drag(layout[pointer.index], pointer.toward, pointer.progress);
});

controls.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const { index, toward, progress, dragging, at } = pointer;
  pointer = undefined;
  if (!dragging) return; // A tap: the click handler takes it.
  suppressClick = true;
  if (toward === undefined) {
    refuse(index);
    return;
  }
  if (busy) {
    void view.snapBack(layout[index], toward, progress);
    return;
  }
  const flick = progress > .1 && event.timeStamp - at < 250;
  if (progress >= .33 || flick) void move(index, progress);
  else void view.snapBack(layout[index], toward, progress);
});

controls.addEventListener('pointercancel', event => {
  if (pointer?.id !== event.pointerId) return;
  const { index, toward, progress } = pointer;
  pointer = undefined;
  if (toward !== undefined) void view.snapBack(layout[index], toward, progress);
});
