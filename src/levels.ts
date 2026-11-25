import sunflowers from './assets/sunflowers.jpg';

type Level = { name: string; artwork: string; shuffleMoves: number };

export const levels: readonly Level[] = [
  { name: 'Sunflowers in a vase', artwork: sunflowers, shuffleMoves: 2 },
];
