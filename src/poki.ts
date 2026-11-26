import { audio } from './audio';

type PokiSDK = {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(beforeAd?: () => void): Promise<void>;
  rewardedBreak(beforeAd?: () => void): Promise<boolean>;
  getLanguage?(): string;
  playtestCaptureHtmlForce?(): void;
};

/** True for `vite build --mode poki`. The SDK script tag is injected only in that build. */
const enabled = import.meta.env.MODE === 'poki';
// An ad blocker can stop the SDK from loading; the game must stay fully playable without it.
const sdk = enabled ? (window as Window & { PokiSDK?: PokiSDK }).PokiSDK : undefined;

let playing = false;
let adPlaying = false;

const ready: Promise<void> = sdk
  ? sdk.init().catch(() => {}).then(recordHtmlInPlaytests)
  : Promise.resolve();

/**
 * Poki playtest videos record the largest <canvas> on the page by default. This game is drawn with
 * HTML, and its only canvases are small decorative ones (tile bevels, confetti), so recordings came
 * out black. This SDK call makes playtests capture the page's HTML instead. It only takes effect
 * during a Poki playtest, and is skipped if this SDK version doesn't have it.
 */
function recordHtmlInPlaytests(): void {
  try { sdk?.playtestCaptureHtmlForce?.(); } catch { /* Recording is optional. */ }
}

function setAdPlaying(value: boolean): void {
  adPlaying = value;
  audio.setAdPlaying(value);
}

async function runBreak<T>(show: (sdk: PokiSDK) => Promise<T>, fallback: T): Promise<T> {
  gameplayStop();
  if (!sdk || adPlaying) return fallback;
  await ready;
  setAdPlaying(true);
  try {
    return await show(sdk);
  } catch {
    return fallback;
  } finally {
    setAdPlaying(false);
  }
}

/** Fire once the player makes their first input in a level. Repeated calls are ignored. */
function gameplayStart(): void {
  if (playing || adPlaying) return;
  playing = true;
  sdk?.gameplayStart();
}

/** Fire on any interruption: level complete, pause/settings, restart. Repeated calls are ignored. */
function gameplayStop(): void {
  if (!playing || adPlaying) return;
  playing = false;
  sdk?.gameplayStop();
}

export const poki = {
  enabled,
  /** The SDK loaded, so ads (and the rewarded hint) can be offered. */
  get available(): boolean { return !!sdk; },
  get adPlaying(): boolean { return adPlaying; },
  ready,
  loadingFinished(): void { sdk?.gameLoadingFinished(); },
  /** The player's language as Poki detects it: a lowercase base code such as "en" or "pt". */
  language(): string | undefined {
    try { return sdk?.getLanguage?.(); } catch { return undefined; }
  },
  gameplayStart,
  gameplayStop,
  /** Natural break before heading back into gameplay. Poki decides whether an ad actually shows. */
  commercialBreak: (): Promise<void> => runBreak(s => s.commercialBreak(), undefined),
  /** Resolves true only when the rewarded video was shown, so the reward may be granted. */
  rewardedBreak: (): Promise<boolean> => runBreak(s => s.rewardedBreak(), false),
};
