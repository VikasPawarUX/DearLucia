type Memory = {
  id: number;
  artwork: string;
  minimumMoves: number;
  /** The piece held back as the empty space and stamped in last (0–8, row by row). Defaults to 8. */
  gap?: number;
  startingBoard?: readonly number[];
};

export const levels: readonly Memory[] = [
  {
    id: 1,
    artwork: new URL('./assets/family-portrait.webp', import.meta.url).href,
    minimumMoves: 2,
    gap: 7,
  },
  {
    id: 2,
    artwork: new URL('./assets/memory-02-paris.webp', import.meta.url).href,
    minimumMoves: 3,
    gap: 1,
    startingBoard: [0, 4, 2, 3, 7, 5, 1, 6, 8],
  },
  {
    id: 3,
    artwork: new URL('./assets/memory-03-croissant.webp', import.meta.url).href,
    minimumMoves: 3,
    gap: 4,
    startingBoard: [0, 1, 2, 3, 7, 4, 6, 8, 5],
  },
  {
    id: 4,
    artwork: new URL('./assets/memory-04-red-balloon.webp', import.meta.url).href,
    minimumMoves: 4,
    gap: 2,
    startingBoard: [2, 0, 5, 3, 1, 4, 6, 7, 8],
  },
  {
    id: 5,
    artwork: new URL('./assets/memory-05-floating-balloon.webp', import.meta.url).href,
    minimumMoves: 4,
    gap: 2,
    startingBoard: [2, 4, 1, 0, 3, 5, 6, 7, 8],
  },
  {
    id: 6,
    artwork: new URL('./assets/memory-06-ice-cream.webp', import.meta.url).href,
    minimumMoves: 5,
    gap: 2,
    startingBoard: [0, 2, 4, 3, 5, 1, 6, 7, 8],
  },
  {
    id: 7,
    artwork: new URL('./assets/memory-07-sailboat.webp', import.meta.url).href,
    minimumMoves: 6,
    gap: 4,
    startingBoard: [0, 1, 2, 7, 6, 5, 4, 3, 8],
  },
  {
    id: 8,
    artwork: new URL('./assets/memory-08-lighthouse.webp', import.meta.url).href,
    minimumMoves: 5,
    gap: 1,
    startingBoard: [0, 4, 2, 7, 1, 5, 3, 6, 8],
  },
  {
    id: 9,
    artwork: new URL('./assets/memory-09-train.webp', import.meta.url).href,
    minimumMoves: 7,
    gap: 5,
    startingBoard: [3, 0, 1, 4, 7, 2, 5, 6, 8],
  },
  {
    id: 10,
    artwork: new URL('./assets/memory-10-birthday-cake.webp', import.meta.url).href,
    minimumMoves: 5,
    gap: 1,
    startingBoard: [0, 4, 1, 3, 7, 2, 6, 8, 5],
  },
  {
    id: 11,
    artwork: new URL('./assets/memory-11-oliver.webp', import.meta.url).href,
    minimumMoves: 7,
    gap: 4,
    startingBoard: [0, 4, 2, 6, 1, 3, 7, 8, 5],
  },
  {
    id: 12,
    artwork: new URL('./assets/memory-12-bicycle.webp', import.meta.url).href,
    minimumMoves: 6,
    gap: 2,
    startingBoard: [0, 4, 1, 7, 2, 5, 3, 6, 8],
  },
  {
    id: 13,
    artwork: new URL('./assets/memory-13-umbrella.webp', import.meta.url).href,
    minimumMoves: 8,
    gap: 1,
    startingBoard: [0, 2, 5, 7, 4, 1, 3, 6, 8],
  },
  {
    id: 14,
    artwork: new URL('./assets/memory-14-grandma-letters.webp', import.meta.url).href,
    minimumMoves: 6,
    gap: 2,
    startingBoard: [2, 1, 5, 0, 7, 4, 3, 6, 8],
  },
  {
    id: 15,
    artwork: new URL('./assets/memory-15-sunflower.webp', import.meta.url).href,
    minimumMoves: 8,
    gap: 4,
    startingBoard: [4, 7, 2, 1, 0, 5, 3, 6, 8],
  },
  {
    id: 16,
    artwork: new URL('./assets/memory-16-kitten.webp', import.meta.url).href,
    minimumMoves: 7,
    gap: 1,
    startingBoard: [2, 3, 5, 0, 1, 4, 6, 7, 8],
  },
  {
    id: 17,
    artwork: new URL('./assets/memory-17-snowman.webp', import.meta.url).href,
    minimumMoves: 8,
    gap: 4,
    startingBoard: [0, 2, 5, 3, 8, 7, 6, 1, 4],
  },
  {
    id: 18,
    artwork: new URL('./assets/memory-18-christmas.webp', import.meta.url).href,
    minimumMoves: 8,
    gap: 1,
    startingBoard: [3, 0, 2, 1, 4, 8, 6, 5, 7],
  },
  {
    id: 19,
    artwork: new URL('./assets/memory-19-camera.webp', import.meta.url).href,
    minimumMoves: 8,
    gap: 5,
    startingBoard: [0, 5, 1, 6, 4, 2, 7, 3, 8],
  },
  {
    id: 20,
    artwork: new URL('./assets/memory-20-childhood-album.webp', import.meta.url).href,
    minimumMoves: 8,
    gap: 4,
    startingBoard: [3, 0, 2, 7, 6, 5, 4, 1, 8],
  },
  {
    id: 21,
    artwork: new URL('./assets/memory-21-thank-you.webp', import.meta.url).href,
    minimumMoves: 7,
    gap: 4,
    startingBoard: [7, 0, 2, 4, 1, 5, 3, 6, 8],
  },
];
