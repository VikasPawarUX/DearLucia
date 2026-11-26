import assert from 'node:assert/strict';
import test from 'node:test';
import { levels } from './levels.ts';
import { SOLVED, shortestSolution, shuffle, slide, solutionMoves } from './puzzle.ts';

const targetMoves = [2, 3, 2, 4, 3, 5, 6, 5, 7, 5, 7, 6, 8, 6, 9, 7, 10, 8, 10, 10, 7];
assert.equal(levels.length, targetMoves.length);
for (const [index, memory] of levels.entries()) {
  test(`Memory ${memory.id} — ${memory.name} has the required shortest solution`, () => {
    assert.equal(memory.id, index + 1);
    assert.equal(memory.minimumMoves, targetMoves[index]);
    const boards = memory.startingBoard ? [memory.startingBoard] : [];
    if (!memory.startingBoard) {
      assert.equal(memory.id, 1);
      for (const first of [.1, .9]) {
        for (const second of [.1, .9]) {
          const rolls = [first, second];
          boards.push(shuffle(memory.minimumMoves, () => rolls.shift()!));
        }
      }
      assert.equal(new Set(boards.map(board => board.join(','))).size, 4);
    }
    for (const board of boards) {
      assert.deepEqual([...board].sort(), SOLVED);
      assert.equal(shortestSolution(board), targetMoves[index]);
      const solution = solutionMoves(board);
      assert.ok(solution);
      const replay = [...board];
      for (const index of solution) assert.notEqual(slide(replay, index), undefined);
      assert.deepEqual(replay, SOLVED);
    }
  });
}
