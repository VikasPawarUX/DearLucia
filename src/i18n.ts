// Translations. English is built in and fills any gap; every other language is its own file in
// src/locales/ and is downloaded only when chosen.
import en, { type Key, type Translation } from './locales/en.ts';

export type { Key };

/** Supported languages, each shown in its own name in Settings. */
export const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ru', name: 'Русский' },
  { code: 'th', name: 'ไทย' },
  { code: 'ar', name: 'العربية' },
] as const;
export type Language = typeof languages[number]['code'];

const loaders: Record<Language, () => Promise<{ default: Translation }>> = {
  en: () => Promise.resolve({ default: en }),
  fr: () => import('./locales/fr.ts'),
  de: () => import('./locales/de.ts'),
  es: () => import('./locales/es.ts'),
  it: () => import('./locales/it.ts'),
  pt: () => import('./locales/pt.ts'),
  tr: () => import('./locales/tr.ts'),
  pl: () => import('./locales/pl.ts'),
  nl: () => import('./locales/nl.ts'),
  vi: () => import('./locales/vi.ts'),
  ru: () => import('./locales/ru.ts'),
  th: () => import('./locales/th.ts'),
  ar: () => import('./locales/ar.ts'),
};

/**
 * The extra font faces a language needs (see the font roles in style.css), with a sample of its
 * script. They are fetched before the language is shown, so no text flashes in a fallback font.
 * The original nine languages use the fonts the game already loads.
 */
const languageFonts: Partial<Record<Language, string[]>> = {
  vi: ['600 1em "Cormorant Garamond"|Kỷ niệm'],
  ru: ['600 1em "Cormorant Garamond"|Воспоминание'],
  th: ['400 1em "Noto Serif Thai"|ความทรงจำ', '600 1em "Noto Serif Thai"|ความทรงจำ', '700 1em "Noto Serif Thai"|ความทรงจำ'],
  ar: ['700 1em "Aref Ruqaa"|ذكرى', '400 1em Amiri|ذكرى', '700 1em Amiri|ذكرى'],
};

async function loadFonts(code: Language): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const faces = (languageFonts[code] ?? []).map(entry => {
    const [font, sample] = entry.split('|');
    return document.fonts.load(font, sample).catch(() => []);
  });
  // A slow or failed font download never blocks the switch for more than a moment.
  await Promise.race([Promise.all(faces), new Promise(resolve => setTimeout(resolve, 2500))]);
}

const storageKey = 'dear-lucia-language-v1';
let strings: Translation = en;
let current: Language = 'en';

export function isLanguage(code: unknown): code is Language {
  return typeof code === 'string' && languages.some(language => language.code === code);
}

/** The base language of a code like "pt-BR" or "TR", if the game supports it. */
function supported(code: string | undefined | null): Language | undefined {
  const base = code?.toLowerCase().split(/[-_]/)[0];
  return isLanguage(base) ? base : undefined;
}

/**
 * The language to start in: the player's saved choice, then Poki's detected language
 * (PokiSDK.getLanguage()), then the browser's preferences, then English.
 */
export function pickLanguage(saved: string | null, poki: string | undefined, browser: readonly string[]): Language {
  return supported(saved) ?? supported(poki) ?? browser.map(supported).find(Boolean) ?? 'en';
}

export function savedLanguage(): string | null {
  try { return localStorage.getItem(storageKey); } catch { return null; }
}

/** The text for `key` in the current language (English if missing), with {placeholders} filled in. */
export function t(key: Key, values?: Record<string, string | number>): string {
  const text = strings[key] ?? en[key];
  return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name]) : match) : text;
}

export function memoryTitle(id: number): string { return t(`memory.${id}.title` as Key); }
export function memoryStory(id: number): string { return t(`memory.${id}.story` as Key); }

export function currentLanguage(): Language { return current; }

/** Load and switch to a language. With `remember`, the choice is saved for next time. */
export async function setLanguage(code: Language, remember = false): Promise<void> {
  try {
    const [loaded] = await Promise.all([loaders[code](), loadFonts(code)]);
    strings = loaded.default;
    current = code;
  } catch {
    strings = en; // A language file that fails to load falls back to English.
    current = 'en';
  }
  document.documentElement.lang = current;
  if (remember) {
    try { localStorage.setItem(storageKey, current); } catch { /* The choice lasts for this visit. */ }
  }
}

/** Fill in every element marked with data-i18n (text), data-i18n-aria (aria-label) or data-i18n-title. */
export function translatePage(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n as Key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria as Key));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle as Key);
  });
}
