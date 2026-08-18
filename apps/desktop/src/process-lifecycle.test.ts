import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { startBackendThenFrontend, stopProcessTree, type ManagedChild } from './process-lifecycle';

class FakeChild extends EventEmitter implements ManagedChild {
  pid?: number;
  killed = false;

  constructor(pid?: number) {
    super();
    this.pid = pid;
  }

  kill(): boolean {
    this.killed = true;
    this.emit('exit', 1);
    return true;
  }
}

describe('process lifecycle', () => {
  it('does not start frontend when backend readiness fails', async () => {
    let frontendStarted = false;
    let backendStopped = false;
    const backend = new FakeChild(11);

    await assert.rejects(
      () =>
        startBackendThenFrontend({
          startBackend: () => backend,
          startFrontend: () => {
            frontendStarted = true;
            return new FakeChild(12);
          },
          waitUntilReady: async (name) => {
            if (name === 'backend') {
              throw new Error('backend start fail');
            }
          },
          stop: async (child) => {
            if (child === backend) {
              backendStopped = true;
            }
          },
        }),
      /backend start fail/,
    );

    assert.equal(frontendStarted, false);
    assert.equal(backendStopped, true);
  });

  it('stops backend when frontend readiness fails', async () => {
    const stopped: number[] = [];
    const backend = new FakeChild(21);
    const frontend = new FakeChild(22);

    await assert.rejects(
      () =>
        startBackendThenFrontend({
          startBackend: () => backend,
          startFrontend: () => frontend,
          waitUntilReady: async (name) => {
            if (name === 'frontend') {
              throw new Error('frontend start fail');
            }
          },
          stop: async (child) => {
            if (child && child.pid) {
              stopped.push(child.pid);
            }
          },
        }),
      /frontend start fail/,
    );

    assert.deepEqual(stopped, [22, 21]);
  });

  it('awaits process tree stop and logs taskkill failure', async () => {
    const logs: string[] = [];
    const child = new FakeChild(33);

    await stopProcessTree(child, {
      platform: 'win32',
      log: (message) => logs.push(message),
      taskkill: async () => 9,
      timeoutMs: 50,
    });

    assert.equal(
      logs.some((item) => item.includes('taskkill pid 33 exited with code 9')),
      true,
    );
  });

  it('cleans up after a successful stop', async () => {
    const child = new FakeChild(44);
    const logs: string[] = [];

    await stopProcessTree(child, {
      platform: 'win32',
      log: (message) => logs.push(message),
      taskkill: async () => {
        child.emit('exit', 0);
        return 0;
      },
      timeoutMs: 50,
    });

    assert.deepEqual(logs, []);
  });
});
