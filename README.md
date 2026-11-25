# Toy Slide

Restore a family portrait by tapping or swiping an adjacent tile into the empty space. The final piece stamps into place and the seams fade to reveal the complete painting.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Open the URL printed by Vite. The production build is in `dist/`.

Add paintings in `src/levels.ts` with a title, square artwork URL, and shuffle length. Every level uses the same 2D wooden frame and tile effects. The catalog contains ten paintings. Completing a puzzle unlocks the next one, and refreshing resumes the most recently unlocked painting. The final painting stays on screen once restored.

The sunflower asset was generated with built-in ImageGen using the supplied puzzle image as a composition and brushwork reference. The prompt requested a continuous, full-bleed square oil painting with three sunflowers, olive leaves, a cream vase with a blue stripe, a sky-blue background, and a low ochre tabletop, with all framing and puzzle effects omitted.

Levels 2–10 were also created with built-in ImageGen. The prompts requested full-bleed square gouache paintings with visible brushwork and distinct compositions, using the supplied illustrated collection as visual direction. Subjects were a sailboat, lighthouse, countryside cottage, hot air balloon, cherry blossom tree, mountain lake, windmill and tulips, ocean sunset, and snowy cabin. All artwork is in `src/assets/`.

Level 1 uses a family portrait reconstructed with built-in ImageGen from the supplied reference. The prompt preserved the composition, palette, and brushwork, reconstructed the missing patch, and requested a continuous square painting without the frame or bevels.
