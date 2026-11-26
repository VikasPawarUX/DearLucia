import { defineConfig } from 'vite';

// `vite build --mode poki` produces the Poki upload in dist-poki/, with the Poki SDK loaded in <head>.
export default defineConfig(({ mode }) => {
  const poki = mode === 'poki';
  return {
    // Relative URLs so the Poki upload works from any folder on Poki's CDN.
    base: poki ? './' : '/',
    // Poki shows its own thumbnails, so the website's favicon, app icons and manifest stay out of its build.
    publicDir: poki ? false : 'public',
    build: { outDir: poki ? 'dist-poki' : 'dist' },
    plugins: poki ? [{
      name: 'poki-sdk',
      transformIndexHtml: (html: string) => ({
        html: html
          .replace(/^\s*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\n/gm, '')
          .replace(/^\s*<meta property="og:[^>]*>\n/gm, ''),
        tags: [{
          tag: 'script',
          attrs: { src: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js' },
          injectTo: 'head-prepend' as const,
        }],
      }),
    }] : [],
  };
});
