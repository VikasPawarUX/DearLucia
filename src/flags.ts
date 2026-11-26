// Small built-in flag drawings for the language picker (no external images). Each is a square
// SVG that the round button crops to a circle. Flags mark languages, so Portuguese shows Brazil to
// match its Brazilian translation, and English shows the UK to match its British spelling.
import type { Language } from './i18n.ts';

const stripes = (direction: 'row' | 'column', colors: string[]) => colors.map((color, i) => {
  const size = 30 / colors.length;
  return direction === 'row'
    ? `<rect x="0" y="${i * size}" width="30" height="${size + .05}" fill="${color}"/>`
    : `<rect x="${i * size}" y="0" width="${size + .05}" height="30" fill="${color}"/>`;
}).join('');

const star = (cx: number, cy: number, r: number) => Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + i * Math.PI / 5;
  const radius = i % 2 ? r * .4 : r;
  return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
}).join(' ');

const art: Record<Language, string> = {
  // Union Jack, centred on the crossing.
  en: `<rect width="30" height="30" fill="#012169"/>
    <path d="M-15 0 45 30M45 0-15 30" stroke="#fff" stroke-width="6"/>
    <path d="M-15 0 45 30M45 0-15 30" stroke="#C8102E" stroke-width="2"/>
    <path d="M15 0v30M0 15h30" stroke="#fff" stroke-width="10"/>
    <path d="M15 0v30M0 15h30" stroke="#C8102E" stroke-width="6"/>`,
  fr: stripes('column', ['#002654', '#fff', '#CE1126']),
  de: stripes('row', ['#000', '#DD0000', '#FFCE00']),
  es: `<rect width="30" height="30" fill="#AA151B"/><rect y="7.5" width="30" height="15" fill="#F1BF00"/>`,
  it: stripes('column', ['#009246', '#fff', '#CE2B37']),
  pt: `<rect width="30" height="30" fill="#009C3B"/>
    <path d="M15 4.5 28 15 15 25.5 2 15Z" fill="#FFDF00"/>
    <circle cx="15" cy="15" r="5.6" fill="#002776"/>
    <path d="M9.6 13.9c3.4-1 7.4-.5 10.6 1.7" fill="none" stroke="#fff" stroke-width="1"/>`,
  tr: `<rect width="30" height="30" fill="#E30A17"/>
    <circle cx="12.5" cy="15" r="7.5" fill="#fff"/><circle cx="14.4" cy="15" r="6" fill="#E30A17"/>
    <polygon points="${star(20.2, 15, 3)}" fill="#fff" transform="rotate(-18 20.2 15)"/>`,
  pl: stripes('row', ['#fff', '#DC143C']),
  nl: stripes('row', ['#AE1C28', '#fff', '#21468B']),
};

/** An SVG of the language's flag, filling a square that a round button crops to a circle. */
export function flag(code: Language): string {
  return `<svg class="flag" viewBox="0 0 30 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art[code]}</svg>`;
}
