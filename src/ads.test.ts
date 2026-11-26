import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdPolicy } from './ads.ts';

function setup(showBreak?: () => Promise<void>) {
  let shown = 0;
  const policy = createAdPolicy({
    firstMemory: 6,
    lastMemory: 21,
    restartsPerBreak: 3,
    showBreak: showBreak ?? (() => { shown++; return Promise.resolve(); }),
  });
  return { policy, shown: () => shown };
}

test('Memories 1–5 never request a break, and their restarts are not counted', async () => {
  const { policy, shown } = setup();
  for (let memory = 1; memory <= 5; memory++) {
    assert.equal(await policy.afterMemory(memory), false);
    for (let i = 0; i < 5; i++) assert.equal(await policy.beforeRestart(memory), false);
  }
  assert.equal(shown(), 0);
  assert.equal(policy.snapshot().restarts, 0);
});

test('from Memory 6, completing any memory except the last requests a break', async () => {
  const { policy, shown } = setup();
  for (let memory = 6; memory <= 20; memory++) assert.equal(await policy.afterMemory(memory), true);
  assert.equal(await policy.afterMemory(21), false, 'never after the last memory');
  assert.equal(shown(), 15);
});

test('every third manual restart requests a break, counted across memories', async () => {
  const { policy, shown } = setup();
  assert.equal(await policy.beforeRestart(6), false);
  assert.equal(await policy.beforeRestart(7), false);
  assert.equal(await policy.beforeRestart(7), true, 'third restart, across Memories 6 and 7');
  assert.equal(policy.snapshot().restarts, 0, 'count reset after the break');
  assert.equal(await policy.beforeRestart(7), false);
  assert.equal(shown(), 1);
});

test('a completion break also resets the restart count', async () => {
  const { policy } = setup();
  await policy.beforeRestart(6);
  await policy.beforeRestart(6);
  assert.equal(await policy.afterMemory(6), true);
  assert.equal(policy.snapshot().restarts, 0);
  assert.equal(await policy.beforeRestart(7), false);
});

test('a second request while an ad is playing is ignored', async () => {
  let finish!: () => void;
  let shown = 0;
  const { policy } = setup(() => { shown++; return new Promise<void>(resolve => { finish = resolve; }); });
  const first = policy.afterMemory(6);
  assert.equal(await policy.afterMemory(7), false);
  assert.equal(await policy.beforeRestart(7), false);
  finish();
  assert.equal(await first, true);
  assert.equal(shown, 1);
  assert.equal(policy.snapshot().requesting, false);
});

test('an unavailable ad (the SDK throws) is handled and still resets the count', async () => {
  const { policy } = setup(() => Promise.reject(new Error('no ad')));
  await policy.beforeRestart(6);
  await policy.beforeRestart(6);
  assert.equal(await policy.beforeRestart(6), true);
  assert.deepEqual(policy.snapshot(), { restarts: 0, requesting: false });
});
