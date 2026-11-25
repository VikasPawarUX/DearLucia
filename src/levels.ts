import sunflowers from './assets/sunflowers.jpg';
import sailboat from './assets/sailboat.jpg';
import lighthouse from './assets/lighthouse.jpg';
import cottage from './assets/cottage.jpg';
import balloon from './assets/balloon.jpg';
import blossoms from './assets/cherry-blossoms.jpg';
import mountains from './assets/mountain-lake.jpg';
import windmill from './assets/windmill.jpg';
import sunset from './assets/ocean-sunset.jpg';
import cabin from './assets/snow-cabin.jpg';

type Level = { name: string; artwork: string; shuffleMoves: number };

export const levels: readonly Level[] = [
  { name: 'Sunflowers in a vase', artwork: sunflowers, shuffleMoves: 2 },
  { name: 'Sailboat on a blue ocean', artwork: sailboat, shuffleMoves: 4 },
  { name: 'Red and white lighthouse', artwork: lighthouse, shuffleMoves: 6 },
  { name: 'Countryside cottage', artwork: cottage, shuffleMoves: 8 },
  { name: 'Colourful hot air balloon', artwork: balloon, shuffleMoves: 10 },
  { name: 'Cherry blossom tree', artwork: blossoms, shuffleMoves: 12 },
  { name: 'Snow-covered mountains and a lake', artwork: mountains, shuffleMoves: 16 },
  { name: 'Windmill surrounded by tulips', artwork: windmill, shuffleMoves: 20 },
  { name: 'Sunset over the ocean', artwork: sunset, shuffleMoves: 25 },
  { name: 'Wooden cabin surrounded by snow', artwork: cabin, shuffleMoves: 30 },
];
