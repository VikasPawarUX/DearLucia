# Toy Slide

Restore a sunflower painting by tapping or swiping an adjacent tile into the empty space. The final piece stamps into place and the seams fade to reveal the complete painting.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Open the URL printed by Vite. The production build is in `dist/`.

Add paintings in `src/levels.ts` with a title, square artwork URL, and shuffle length. Every level uses the same 2D wooden frame and tile effects. The current catalog contains the sunflower prototype.

The sunflower asset was generated with built-in ImageGen using the supplied puzzle image as a composition and brushwork reference. The prompt requested a continuous, full-bleed square oil painting with three sunflowers, olive leaves, a cream vase with a blue stripe, a sky-blue background, and a low ochre tabletop, with all framing and puzzle effects omitted.
