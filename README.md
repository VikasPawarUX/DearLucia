# Dear Lucia

Restore Lucia’s painted memories by tapping or swiping an adjacent tile into the empty space. Each memory opens with an animated title, painting, and narration. The final tile clicks into place and the seams fade to reveal the painting.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Open the URL printed by Vite. The production build is in `dist/`. Use `?level=1` to revisit the family portrait while preserving unlocked memories.

The catalog in `src/levels.ts` defines each memory’s ID, square painting, minimum solution length, missing piece (`gap`), and starting board; titles and stories live in the locale files. The missing piece is the empty space during play and is stamped back in last, so each memory ends on its focal point: Lucia’s face, the top of the Eiffel Tower, the balloon, the birthday candles, and so on. The family portrait retains its two-move shuffle. The other memories use fixed solvable starting boards, and a breadth-first search checks every shortest path in the test suite. All 20 memories in Chapter 1 — The Little Things share the same frame, tiles, effects, and transitions. Memory 21 is a seven-move postcard epilogue. The restored postcard and farewell stay on screen and are restored when the game opens after completion. Return Home revisits Memory 1 while retaining saved completion.

## Languages

English, Français, Deutsch, Español, Italiano, Português (Brazil), Türkçe, Polski and Nederlands. Each language is one file in [`src/locales/`](src/locales/); English (`en.ts`) is the source and the fallback for any missing string, and the other files load only when chosen. [`src/i18n.ts`](src/i18n.ts) holds the language list, lookup (`t()`), detection and switching.

The game starts in the player's saved choice, then Poki's `PokiSDK.getLanguage()`, then the browser's languages, then English. In Settings, a round button shows the current language's flag and opens a grid of round flags (drawn in [`src/flags.ts`](src/flags.ts); Portuguese shows Brazil to match its Brazilian translation, English the UK). Each flag keeps its language's name for screen readers and as a tooltip. A change applies at once without losing progress and is saved locally. Page text is marked with `data-i18n` (text), `data-i18n-aria` and `data-i18n-title` attributes. To add a language, copy a locale file, translate it, and add it to `languages` and `loaders` in `i18n.ts`; the locale tests check that every key and `{placeholder}` is present.

The three fonts cover every letter these languages need. Long titles shrink just enough that their longest word fits on one line rather than being split.

## Website deploy

```sh
pnpm deploy:site
```

This builds the website for https://www.vikaspawar.online/dearlucia/ into `dist-site/dearlucia/` and publishes it to the `dear-lucia` Cloudflare Worker described in `wrangler.jsonc`. It uploads a new version and sends all traffic to it, so the routes on vikaspawar.online are never changed and the previous version stays available for rollback under Workers → dear-lucia → Deployments in the Cloudflare dashboard. The first run asks you to sign in with `pnpm exec wrangler login`. Use `pnpm build:site && node scripts/deploy-site.mjs --dry-run` to check a build without publishing it.

## Poki build

```sh
pnpm build:poki
```

This writes the Poki upload to `dist-poki/`: relative asset paths and the Poki SDK script in `<head>`. Drag that folder (or a zip of it) into the Poki Inspector. `pnpm dev:poki` runs the same mode locally, where the SDK shows test ads. The regular `pnpm build` is unchanged and never loads the SDK.

[`src/poki.ts`](src/poki.ts) wraps the SDK, ignores repeated start/stop calls, and does nothing if the SDK is blocked, so the game stays playable with an ad blocker. Events:

| Moment | Events |
| --- | --- |
| Splash finished | `gameLoadingFinished()` |
| First tile move in a memory | `gameplayStart()` |
| Memory restored, settings opened | `gameplayStop()` |
| Memory 6 onwards: after a memory's celebration, before the next one loads (never after Memory 21) | `gameplayStop()` → `commercialBreak()` |
| Memory 6 onwards: every third Restart (counted across memories), before the puzzle resets | `gameplayStop()` → `commercialBreak()` |
| Memories 1–5, free hints, Settings, Return Home | no ad break |
| Hint with no free hints left (🎬 badge) | `gameplayStop()` → `rewardedBreak()`; the hint is granted only if the video played |

Poki playtest videos record the largest `<canvas>` by default; this game is drawn in HTML, so after `init()` it calls `PokiSDK.playtestCaptureHtmlForce()` to record the page itself (without it, recordings are black). All ad rules live in [`src/ads.ts`](src/ads.ts); the restart count resets after every break request. Following Poki's requirements there is no internal ad timer or cooldown: Poki decides whether each requested break shows an ad. Audio is silenced and keyboard input ignored while an ad plays. In the Poki build, arrow keys, space and the mouse wheel do not scroll the host page.

## Painting prompts

Memories 2–10 were generated with built-in ImageGen using the family portrait as the master style reference and the supplied memory images as composition references. The shared prompt requested full-bleed square oil paintings, matte impasto, distinct brushstrokes, warm colors and simple shapes, with recognizable clues across the nine regions and no frame, tile divisions, text, or UI.

| Memory | Subject prompt |
| --- | --- |
| 2 | Eiffel Tower with wide feet, recognizable upper lattice, and a warm Paris sky |
| 3 | Oversized golden croissant with distinct pastry folds |
| 4 | Lucia in her red bow and yellow dress holding a vermilion balloon on a red string |
| 5 | The same red balloon in blue sky with a trailing red string, using Memory 4’s painting as the object reference |
| 6 | A large pink strawberry scoop in a waffle cone |
| 7 | A small sailboat at the coast, with cream sails and painted teal waves |
| 8 | A red and cream lighthouse with a rocky footing |
| 9 | A vintage steam train with a warm red buffer beam |
| 10 | A chocolate birthday cake with eight lit candles |

Memories 11–20 were generated individually with built-in ImageGen. Each prompt used the family portrait as the primary reference and a contact sheet of Memories 1–10 as the secondary reference. The shared prompt called for one square, edge-to-edge oil painting with visible impasto, directional bristle marks, soft edges, warm colours, and recognisable connections across all nine puzzle areas. It excluded frames, grids, margins, text, and unrelated objects.

| Memory | Subject prompt |
| --- | --- |
| 11 | A small late-1970s vintage brown teddy bear with a simple muted red neck ribbon, seated with spread plush feet, off-center against warm golden cream. Rounded ears and feet fill the diagonals. |
| 12 | A late-1970s red children’s bicycle with cream tyres in side view, running diagonally across the square, front wheel and handlebars higher on right, saddle and rear wheel left, on a muted teal backdrop. |
| 13 | An open butter yellow umbrella tilted across the canvas, visible ribs and curved wooden handle, light slanting rain on a muted blue-gray backdrop. Canopy spans the upper two thirds; handle and puddled light sweep through lower thirds. |
| 14 | A vintage warm ivory envelope with pronounced folded seams, tipped diagonally across a muted sage tabletop, with a small pressed mauve flower and delicate stem across the envelope. Paper corners and shadows define the whole square. No writing or stamp. |
| 15 | A single large sunflower, glowing golden head slightly above and right of center, deep umber seed head, large green leaves spreading to both sides in the lower half. Warm pale ochre painted backdrop. |
| 16 | A small ginger kitten with soft stripes sitting peacefully in a garden, curled tail crossing the bottom right and paws visible, little tufts of foliage at lower edges, muted verdant backdrop. Fill canvas with kitten silhouette and few garden marks. |
| 17 | A charming handmade snowman with a red knit scarf draping diagonally, tiny carrot nose and coal eyes, soft muted winter blue, snowdrift shadows and sparse flecks of snow. Snowman fills most of canvas. |
| 18 | A late-1970s Christmas tree with warm tiny lights, simple colourful ornaments and a golden star, full branches across the lower width, warm dusky interior color, subdued shadow beneath, no presents or clutter. |
| 19 | A late-1970s film camera, black leatherette and gently warm silver housing, large round lens, broad three-quarter close view, restrained dark brown strap crossing foreground, muted ochre warm tabletop. No logos, letters or digits. |
| 20 | Old family photo album partially open diagonally across a honey cream tabletop, covers the whole middle and spreads into the corners, with just three small painted photographs showing the exact family from primary reference (Lucia with brown bob and red bow, Dad blue shirt, Mum dark hair and red top), red balloon in blue sky and birthday cake with candles. Treat photos as warm simple painted miniatures, no writing, no extra objects. |

Memory 21 was generated with built-in ImageGen using the family portrait, the envelope painting, and a contact sheet of all 20 memories as style references. The prompt requested a square oil painting of a vintage cream postcard with legible brown handwritten “Thank You” lettering, a small red ribbon, and delicate flowers, with distinct tile clues and no frame, grid, or other text.

The playable painting assets are in `src/assets/`. The family portrait and earlier painting files remain in the project.

## Audio

Music begins on the first interaction: one calm track loops through every memory, each pass easing in as the last one fades. Settings has round buttons to switch music and sound effects on or off, and to delete saved progress. On a keyboard, **M** toggles mute, **[** and **]** adjust music, and **Shift + [** and **Shift + ]** adjust effects. Settings are saved locally. See [audio credits](assets/audio/CREDITS.md) for track sources and licenses.
