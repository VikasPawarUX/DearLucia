import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY, SOLVED, neighbors, shuffle, slide, solutionMoves, solved } from './puzzle.ts';

test('only orthogonally adjacent tiles can move, without wrapping around rows', () => {
  const board = [...SOLVED];
  assert.equal(slide(board, 4), undefined);
  assert.equal(slide(board, 7), 8);
  assert.equal(slide(board, 6), 7);
  assert.equal(slide(board, 5), undefined);
});

test('two-move tutorial has exactly two legal moves back to solved', () => {
  for (const random of [() => .1, () => .9]) {
    const board = shuffle(2, random);
    assert.equal(solved(board), false);
    for (let remaining = 2; remaining > 0; remaining--) {
      const empty = board.indexOf(EMPTY);
      const correct = neighbors(empty).find(i => board[i] === empty);
      assert.notEqual(correct, undefined);
      slide(board, correct!);
      assert.equal(solved(board), remaining === 1);
    }
  }
});

test('configured shuffle lengths produce reachable, unsolved permutations', () => {
  for (const moves of [2, 4, 6, 8, 10, 12, 16, 20, 25, 30]) {
    for (let i = 0; i < 40; i++) {
      const board = shuffle(moves);
      assert.deepEqual([...board].sort(), SOLVED);
      assert.equal(solved(board), false);
      const tiles = board.filter(tile => tile !== EMPTY);
      const inversions = tiles.reduce((n, tile, i) => n + tiles.slice(i + 1).filter(next => next < tile).length, 0);
      assert.equal(inversions % 2, 0);
    }
  }
});

function breadthFirstLength(initial: readonly number[]): number {
  let frontier = [[...initial]];
  const seen = new Set([initial.join(',')]);
  for (let depth = 0; frontier.length; depth++) {
    const next: number[][] = [];
    for (const board of frontier) {
      if (solved(board)) return depth;
      for (const index of neighbors(board.indexOf(EMPTY))) {
        const child = [...board];
        slide(child, index);
        const key = child.join(',');
        if (!seen.has(key)) { seen.add(key); next.push(child); }
      }
    }
    frontier = next;
  }
  return -1;
}

test('hints from any mid-puzzle board follow a shortest legal path to solved', () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) {
    const board = shuffle(4 + (i % 27), random);
    const moves = solutionMoves(board);
    assert.ok(moves);
    assert.equal(moves.length, breadthFirstLength(board));
    for (const index of moves) assert.notEqual(slide(board, index), undefined);
    assert.equal(solved(board), true);
  }
});

test('hardest 8-puzzle board still solves optimally, and unsolvable boards return undefined', () => {
  assert.equal(solutionMoves([7, 5, 6, 1, 4, 3, 2, 8, 0])?.length, 31);
  assert.deepEqual(solutionMoves(SOLVED), []);
  assert.equal(solutionMoves([1, 0, 2, 3, 4, 5, 6, 7, 8]), undefined);
});
