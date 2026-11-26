import assert from 'node:assert/strict';
import test from 'node:test';
import { levels } from './levels.ts';
import { EMPTY, SOLVED, shortestSolution, shuffle, slide, solutionMoves } from './puzzle.ts';

const targetMoves = [2, 3, 3, 4, 4, 5, 6, 5, 7, 5, 7, 6, 8, 6, 9, 7, 10, 8, 10, 10, 7];
assert.equal(levels.length, targetMoves.length);
for (const [index, memory] of levels.entries()) {
  test(`Memory ${memory.id} — ${memory.name} has the required shortest solution`, () => {
    assert.equal(memory.id, index + 1);
    assert.equal(memory.minimumMoves, targetMoves[index]);
    const gap = memory.gap ?? EMPTY;
    assert.ok(Number.isInteger(gap) && gap >= 0 && gap <= 8);
    const boards = memory.startingBoard ? [memory.startingBoard] : [];
    if (!memory.startingBoard) {
      assert.equal(memory.id, 1);
      // Sample every first step and both ends of the second, so the random shuffle stays varied.
      for (const first of [.1, .5, .9]) {
        for (const second of [.1, .9]) {
          const rolls = [first, second];
          boards.push(shuffle(memory.minimumMoves, () => rolls.shift()!, gap));
        }
      }
      assert.ok(new Set(boards.map(board => board.join(','))).size >= 4);
    }
    for (const board of boards) {
      assert.deepEqual([...board].sort(), SOLVED);
      assert.equal(shortestSolution(board, gap), targetMoves[index]);
      // The final piece's spot shouldn't already be the hole when the memory opens.
      if (memory.startingBoard) assert.notEqual(board.indexOf(gap), gap);
      const solution = solutionMoves(board, gap);
      assert.ok(solution);
      const replay = [...board];
      for (const index of solution) assert.notEqual(slide(replay, index, gap), undefined);
      assert.deepEqual(replay, SOLVED);
    }
  });
}

test('every memory after the first starts from a different board', () => {
  const boards = levels.filter(memory => memory.startingBoard).map(memory => memory.startingBoard!.join(','));
  assert.equal(new Set(boards).size, boards.length);
});
