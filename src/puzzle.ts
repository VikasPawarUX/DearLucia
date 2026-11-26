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

export function shortestSolution(initial: readonly number[]): number {
  return solutionMoves(initial)?.length ?? -1;
}

/** Tap order for a shortest solution from any reachable board, or undefined if it can't be solved. */
export function solutionMoves(initial: readonly number[]): number[] | undefined {
  if (!solvable(initial)) return undefined;
  // A* with the Manhattan distance: consistent, so the first solved board popped is a shortest path.
  // It visits a few thousand boards where breadth-first search could visit 181,440.
  type Node = { board: number[]; empty: number; g: number; f: number; move: number; parent?: Node };
  const start: Node = { board: [...initial], empty: initial.indexOf(EMPTY), g: 0, f: distance(initial), move: -1 };
  const heap = new MinHeap<Node>((a, b) => a.f - b.f || b.g - a.g);
  const cost = new Map([[start.board.join(','), 0]]);
  heap.push(start);
  for (let node = heap.pop(); node; node = heap.pop()) {
    if (node.f === node.g) {
      const moves: number[] = [];
      for (let step: Node | undefined = node; step?.parent; step = step.parent) moves.push(step.move);
      return moves.reverse();
    }
    if (node.g > cost.get(node.board.join(','))!) continue;
    for (const index of neighbors(node.empty)) {
      if (index === node.parent?.empty) continue;
      const board = [...node.board];
      [board[node.empty], board[index]] = [board[index], board[node.empty]];
      const key = board.join(',');
      const g = node.g + 1;
      if ((cost.get(key) ?? Infinity) <= g) continue;
      cost.set(key, g);
      heap.push({ board, empty: index, g, f: g + distance(board), move: index, parent: node });
    }
  }
}

/** A 3×3 board is solvable exactly when its tiles (ignoring the gap) have an even inversion count. */
export function solvable(board: readonly number[]): boolean {
  const tiles = board.filter(tile => tile !== EMPTY);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inversions++;
  }
  return inversions % 2 === 0;
}

class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly before: (a: T, b: T) => number;
  constructor(before: (a: T, b: T) => number) { this.before = before; }

  push(item: T): void {
    const items = this.items;
    let i = items.push(item) - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.before(items[i], items[parent]) >= 0) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last !== undefined) {
      items[0] = last;
      for (let i = 0; ;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && this.before(items[left], items[smallest]) < 0) smallest = left;
        if (right < items.length && this.before(items[right], items[smallest]) < 0) smallest = right;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
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
