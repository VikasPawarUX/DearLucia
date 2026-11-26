import { defineConfig } from 'vite';

// `vite build --mode poki` produces the Poki upload in dist-poki/, with the Poki SDK loaded in <head>.
export default defineConfig(({ mode }) => ({
  // Relative URLs so the Poki upload works from any folder on Poki's CDN.
  base: mode === 'poki' ? './' : '/',
  build: { outDir: mode === 'poki' ? 'dist-poki' : 'dist' },
  plugins: mode === 'poki' ? [{
    name: 'poki-sdk',
    transformIndexHtml: () => [{
      tag: 'script',
      attrs: { src: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js' },
      injectTo: 'head-prepend' as const,
    }],
  }] : [],
}));
