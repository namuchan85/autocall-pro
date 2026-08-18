import {
  AutoCallMachine,
  type AutoCallCustomer,
  type AutoCallDependencies,
} from './auto-call-machine';

function eligible(id: string, overrides: Partial<AutoCallCustomer> = {}): AutoCallCustomer {
  return {
    id,
    status: 'ACTIVE',
    doNotCall: false,
    deletedAt: null,
    phoneNumber: '+821012345678',
    ...overrides,
  };
}

describe('AutoCallMachine', () => {
  let now = 0;
  let connected = true;
  let companionReady = true;
  let customers: AutoCallCustomer[];
  let placed: string[];
  let hangups: number;
  let callState: AutoCallDependencies['readCallState'] extends () => Promise<infer T> ? T : never;
  let machine: AutoCallMachine;
  let failPlace: Set<string>;

  beforeEach(() => {
    now = 1_000;
    connected = true;
    companionReady = true;
    customers = [eligible('a'), eligible('b'), eligible('c')];
    placed = [];
    hangups = 0;
    callState = 'DIALING';
    failPlace = new Set();
    machine = new AutoCallMachine({
      now: () => now,
      getDeviceConnected: () => Promise.resolve(connected),
      isCompanionReady: () => Promise.resolve(companionReady),
      listEligible: () =>
        Promise.resolve(
          customers.filter(
            (item) => !item.doNotCall && item.status === 'ACTIVE' && !item.deletedAt,
          ),
        ),
      placeCall: (customerId) => {
        if (failPlace.has(customerId)) {
          return Promise.reject(new Error('place failed'));
        }
        placed.push(customerId);
        return Promise.resolve({ id: `call-${customerId}-${placed.length}`, status: 'DIALING' });
      },
      hangup: () => {
        hangups += 1;
        callState = 'DISCONNECTED';
        return Promise.resolve();
      },
      readCallState: () => Promise.resolve(callState),
    });
  });

  it('dials eligible customers sequentially', async () => {
    await machine.start({
      waitBetweenCallsMs: 3_000,
      ringTimeoutMs: 10_000,
      maxCallDurationMs: 5_000,
    });
    expect(placed).toEqual(['a']);
    callState = 'ACTIVE';
    await machine.tick();
    expect(machine.snapshot().phase).toBe('ACTIVE');
    callState = 'DISCONNECTED';
    await machine.tick();
    expect(machine.snapshot().phase).toBe('WAITING');
    now += 3_000;
    await machine.tick();
    expect(placed).toEqual(['a', 'b']);
  });

  it('skips doNotCall, INACTIVE, BLOCKED, and deleted customers', async () => {
    customers = [
      eligible('dnc', { doNotCall: true }),
      eligible('inactive', { status: 'INACTIVE' }),
      eligible('blocked', { status: 'BLOCKED' }),
      eligible('deleted', { deletedAt: new Date() }),
      eligible('ok'),
    ];
    await machine.start();
    expect(placed).toEqual(['ok']);
  });

  it('does not start without an explicit start() call', () => {
    expect(machine.snapshot()).toMatchObject({ phase: 'IDLE', running: false });
    expect(placed).toEqual([]);
  });

  it('stops immediately and can hang up the current call', async () => {
    await machine.start();
    await machine.stop(true);
    expect(hangups).toBe(1);
    expect(machine.snapshot().phase).toBe('STOPPED');
    now += 10_000;
    await machine.tick();
    expect(placed).toEqual(['a']);
  });

  it('pauses new dials while keeping the current call', async () => {
    await machine.start();
    machine.pause();
    callState = 'ACTIVE';
    await machine.tick();
    callState = 'DISCONNECTED';
    await machine.tick();
    expect(machine.snapshot().phase).toBe('PAUSED');
    now += 20_000;
    await machine.tick();
    expect(placed).toEqual(['a']);
    await machine.resume();
    expect(placed).toEqual(['a', 'b']);
  });

  it('retries a failed dial up to maxRetries', async () => {
    failPlace.add('a');
    await machine.start({ retryOnFailure: true, maxRetries: 1, waitBetweenCallsMs: 3_000 });
    expect(placed).toEqual([]);
    expect(machine.snapshot().phase).toBe('WAITING');
    failPlace.delete('a');
    now += 3_000;
    await machine.tick();
    expect(placed).toEqual(['a']);
  });

  it('hangs up when ringing exceeds the timeout and does not store NO_ANSWER', async () => {
    await machine.start({ ringTimeoutMs: 10_000, waitBetweenCallsMs: 3_000 });
    callState = 'RINGING';
    now += 10_000;
    await machine.tick();
    expect(hangups).toBe(1);
    expect(machine.snapshot().phase).toBe('WAITING');
    expect(machine.snapshot().message ?? '').not.toMatch(/NO_ANSWER/);
  });

  it('hangs up when the connected call exceeds max duration', async () => {
    await machine.start({ maxCallDurationMs: 5_000 });
    callState = 'ACTIVE';
    await machine.tick();
    now += 5_000;
    await machine.tick();
    expect(hangups).toBe(1);
  });

  it('stops when Galaxy disconnects', async () => {
    await machine.start();
    connected = false;
    await machine.tick();
    expect(machine.snapshot().phase).toBe('STOPPED');
    expect(machine.snapshot().lastError).toBe('Galaxy disconnected');
  });

  it('stops when Companion becomes unavailable', async () => {
    await machine.start();
    companionReady = false;
    await machine.tick();
    expect(machine.snapshot().phase).toBe('STOPPED');
    expect(machine.snapshot().lastError).toBe('Companion unavailable');
  });

  it('refuses to start when Companion is not ready', async () => {
    companionReady = false;
    await expect(machine.start()).rejects.toThrow('Companion is not ready for auto-call');
    expect(placed).toEqual([]);
  });

  it('does not auto-resume after stop', async () => {
    await machine.start();
    await machine.stop(false);
    expect(machine.snapshot().running).toBe(false);
    now += 60_000;
    await machine.tick();
    expect(placed).toEqual(['a']);
  });
});
