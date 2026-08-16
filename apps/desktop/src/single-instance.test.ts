import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { focusExistingWindow, shouldQuitForSecondInstance } from './single-instance';

describe('single instance', () => {
  it('quits when the lock is not acquired', () => {
    assert.equal(shouldQuitForSecondInstance(false), true);
    assert.equal(shouldQuitForSecondInstance(true), false);
  });

  it('restores and focuses the existing window', () => {
    const calls: string[] = [];
    focusExistingWindow({
      isMinimized: () => true,
      restore: () => calls.push('restore'),
      show: () => calls.push('show'),
      focus: () => calls.push('focus'),
    });
    assert.deepEqual(calls, ['restore', 'show', 'focus']);
  });
});
