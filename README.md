# Toy Slide

Build the red toy car by tapping or swiping an adjacent tile into the open space. The final piece lands automatically when the other eight are in place.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Open the local URL printed by Vite. The production build is in `dist/`.

The level catalog lives in `src/levels.ts`. Each entry supplies a background, a shuffle length, and a factory for the complete Three.js model. The renderer slices each model along the grid at load time and releases the old tile geometry when the level changes. The current catalog contains Level 1.
