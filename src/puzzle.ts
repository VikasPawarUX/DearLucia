export const EMPTY = 8;
export const SOLVED = Array.from({ length: 9 }, (_, i) => i);

export function neighbors(index: number): number[] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return [
    ...(col > 0 ? [index - 1] : []),
    ...(row > 0 ? [index - 3] : []),
    ...(col < 2 ? [index + 1] : []),
    ...(row < 2 ? [index + 3] : []),
  ];
}

export function solved(board: readonly number[]): boolean {
  return SOLVED.every((tile, index) => tile === board[index]);
}

export function slide(board: number[], index: number): number | undefined {
  const empty = board.indexOf(EMPTY);
  if (!neighbors(empty).includes(index)) return;
  [board[empty], board[index]] = [board[index], board[empty]];
  return empty;
}

function distance(board: readonly number[]): number {
  return board.reduce((sum, tile, index) => tile === EMPTY ? sum : sum
    + Math.abs(tile % 3 - index % 3)
    + Math.abs(Math.floor(tile / 3) - Math.floor(index / 3)), 0);
}

export function shuffle(moves: number, random = Math.random): number[] {
  if (!Number.isInteger(moves) || moves < 1) throw new RangeError('Expected positive shuffle moves.');
  let best = [...SOLVED];
  for (let attempt = 0; attempt < 128; attempt++) {
    const board = [...SOLVED];
    let previous = -1;
    for (let step = 0; step < moves; step++) {
      const empty = board.indexOf(EMPTY);
      const options = neighbors(empty).filter(index => index !== previous);
      const index = options[Math.floor(random() * options.length)];
      slide(board, index);
      previous = empty;
    }
    if (distance(board) > distance(best)) best = board;
    if (distance(board) >= Math.min(18, Math.ceil(moves * .6))) return board;
  }
  if (!solved(best)) return best;
  throw new Error('Could not generate a playable shuffle.');
}
