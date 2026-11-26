import assert from 'node:assert/strict';
import test from 'node:test';
import en from './locales/en.ts';
import { languages, pickLanguage } from './i18n.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

for (const { code, name } of languages.filter(language => language.code !== 'en')) {
  test(`${name} (${code}) translates every string and keeps its placeholders`, async () => {
    const strings = (await import(`./locales/${code}.ts`)).default as Record<string, string>;
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const text = strings[key];
      assert.ok(typeof text === 'string' && text.trim(), `${code}: missing "${key}"`);
      assert.deepEqual(placeholders(text), placeholders(en[key]), `${code}: placeholders differ in "${key}"`);
    }
    for (const key of Object.keys(strings)) assert.ok(key in en, `${code}: unknown key "${key}"`);
  });
}

test('thirteen languages, each named in its own language', () => {
  assert.equal(languages.length, 13);
  assert.deepEqual(languages.slice(-4).map(language => language.name), ['Tiếng Việt', 'Русский', 'ไทย', 'العربية']);
});

test('every memory has a title and a story in English', () => {
  for (let id = 1; id <= 21; id++) {
    assert.ok(en[`memory.${id}.title` as keyof typeof en]);
    assert.ok(en[`memory.${id}.story` as keyof typeof en]);
  }
});

test('the starting language: saved choice, then Poki, then the browser, then English', () => {
  assert.equal(pickLanguage('de', 'fr', ['es-ES']), 'de');
  assert.equal(pickLanguage(null, 'fr', ['es-ES']), 'fr');
  assert.equal(pickLanguage(null, 'pt', []), 'pt', 'Poki returns pt for pt-BR');
  assert.equal(pickLanguage(null, undefined, ['ja-JP', 'TR']), 'tr', 'first supported browser language');
  assert.equal(pickLanguage(null, 'ja', ['zh-CN']), 'en', 'unsupported everywhere falls back to English');
  assert.equal(pickLanguage('xx', 'ko', []), 'en', 'an invalid saved value is ignored');
  assert.equal(pickLanguage(null, 'ar', []), 'ar');
  assert.equal(pickLanguage(null, undefined, ['th-TH']), 'th');
  assert.equal(pickLanguage(null, undefined, ['vi-VN', 'en']), 'vi');
  assert.equal(pickLanguage(null, 'ru', ['en-US']), 'ru');
});
