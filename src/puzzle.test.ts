import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY, SOLVED, neighbors, shuffle, slide, solved } from './puzzle.ts';

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
