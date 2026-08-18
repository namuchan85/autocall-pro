export const AUTO_CALL_PHASES = [
  'IDLE',
  'READY',
  'DIALING',
  'ACTIVE',
  'WAITING',
  'PAUSED',
  'COMPLETED',
  'STOPPED',
] as const;
export type AutoCallPhase = (typeof AUTO_CALL_PHASES)[number];

export interface AutoCallSettings {
  waitBetweenCallsMs: number;
  ringTimeoutMs: number;
  maxCallDurationMs: number;
  retryOnFailure: boolean;
  maxRetries: number;
  hangupOnStop: boolean;
}

export const DEFAULT_AUTO_CALL_SETTINGS: AutoCallSettings = {
  waitBetweenCallsMs: 5_000,
  ringTimeoutMs: 30_000,
  maxCallDurationMs: 60_000,
  retryOnFailure: false,
  maxRetries: 1,
  hangupOnStop: true,
};

export interface AutoCallSnapshot {
  phase: AutoCallPhase;
  running: boolean;
  paused: boolean;
  currentCustomerId: string | null;
  currentCallId: string | null;
  attempt: number;
  remaining: number;
  lastError: string | null;
  message: string | null;
  settings: AutoCallSettings | null;
}

export interface AutoCallCustomer {
  id: string;
  status: string;
  doNotCall: boolean;
  deletedAt: Date | null;
  phoneNumber: string;
}

export interface AutoCallDependencies {
  now(): number;
  getDeviceConnected(): Promise<boolean>;
  isCompanionReady(): Promise<boolean>;
  listEligible(): Promise<AutoCallCustomer[]>;
  placeCall(customerId: string): Promise<{ id: string; status: string }>;
  hangup(): Promise<void>;
  readCallState(): Promise<'IDLE' | 'DIALING' | 'RINGING' | 'ACTIVE' | 'DISCONNECTED' | 'UNKNOWN'>;
}

const MIN_WAIT_MS = 3_000;
const MAX_WAIT_MS = 120_000;
const MIN_RING_MS = 10_000;
const MAX_RING_MS = 120_000;
const MIN_DURATION_MS = 5_000;
const MAX_DURATION_MS = 300_000;
const MAX_RETRIES = 3;

export function validateAutoCallSettings(input: Partial<AutoCallSettings>): AutoCallSettings {
  const settings: AutoCallSettings = {
    ...DEFAULT_AUTO_CALL_SETTINGS,
    ...input,
  };
  settings.waitBetweenCallsMs = clamp(settings.waitBetweenCallsMs, MIN_WAIT_MS, MAX_WAIT_MS);
  settings.ringTimeoutMs = clamp(settings.ringTimeoutMs, MIN_RING_MS, MAX_RING_MS);
  settings.maxCallDurationMs = clamp(settings.maxCallDurationMs, MIN_DURATION_MS, MAX_DURATION_MS);
  settings.maxRetries = clamp(Math.floor(settings.maxRetries), 0, MAX_RETRIES);
  settings.retryOnFailure = Boolean(settings.retryOnFailure);
  settings.hangupOnStop = settings.hangupOnStop !== false;
  return settings;
}

export class AutoCallMachine {
  private phase: AutoCallPhase = 'IDLE';
  private paused = false;
  private stopRequested = false;
  private settings: AutoCallSettings | null = null;
  private currentCustomerId: string | null = null;
  private currentCallId: string | null = null;
  private attempt = 0;
  private phaseEnteredAt = 0;
  private finishedIds = new Set<string>();
  private remaining = 0;
  private lastError: string | null = null;
  private message: string | null = null;
  private observedActive = false;

  constructor(private readonly deps: AutoCallDependencies) {}

  snapshot(): AutoCallSnapshot {
    return {
      phase: this.phase,
      running: this.phase !== 'IDLE' && this.phase !== 'COMPLETED' && this.phase !== 'STOPPED',
      paused: this.paused,
      currentCustomerId: this.currentCustomerId,
      currentCallId: this.currentCallId,
      attempt: this.attempt,
      remaining: this.remaining,
      lastError: this.lastError,
      message: this.message,
      settings: this.settings,
    };
  }

  async start(input: Partial<AutoCallSettings> = {}): Promise<void> {
    if (this.snapshot().running) {
      throw new Error('Auto-call is already running');
    }

    this.reset();
    this.settings = validateAutoCallSettings(input);
    this.message = null;
    this.lastError = null;

    await this.assertSafeToDial();
    const eligible = await this.deps.listEligible();
    if (eligible.length === 0) {
      throw new Error('No eligible customers to call');
    }

    this.remaining = eligible.length;
    this.enter('READY');
    await this.dialNext();
  }

  pause(): void {
    if (!this.snapshot().running) {
      return;
    }
    this.paused = true;
    if (this.phase === 'WAITING' || this.phase === 'READY') {
      this.enter('PAUSED');
    }
    this.message = '일시정지됨. 현재 통화는 유지됩니다.';
  }

  async resume(): Promise<void> {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.message = null;
    if (this.phase === 'PAUSED' || this.phase === 'WAITING' || this.phase === 'READY') {
      await this.dialNext();
    }
  }

  async stop(hangupCurrent = true): Promise<void> {
    this.stopRequested = true;
    this.paused = false;
    if (hangupCurrent && this.currentCallId) {
      await this.safeHangup();
    }
    this.enter('STOPPED');
    this.message = '자동발신이 중지되었습니다.';
    this.currentCustomerId = null;
    this.currentCallId = null;
  }

  async tick(): Promise<void> {
    if (this.phase === 'IDLE' || this.phase === 'COMPLETED' || this.phase === 'STOPPED') {
      return;
    }

    if (this.stopRequested) {
      return;
    }

    const connected = await this.deps.getDeviceConnected();
    if (!connected) {
      this.lastError = 'Galaxy disconnected';
      await this.stop(true);
      return;
    }

    const companionReady = await this.deps.isCompanionReady();
    if (!companionReady) {
      this.lastError = 'Companion unavailable';
      await this.stop(true);
      return;
    }

    if (this.phase === 'DIALING') {
      await this.tickDialing();
      return;
    }
    if (this.phase === 'ACTIVE') {
      await this.tickActive();
      return;
    }
    if (this.phase === 'WAITING' && !this.paused) {
      if (this.elapsed() >= (this.settings?.waitBetweenCallsMs ?? 0)) {
        await this.dialNext();
      }
    }
  }

  private async tickDialing(): Promise<void> {
    const state = await this.deps.readCallState();
    if (state === 'ACTIVE') {
      this.observedActive = true;
      this.enter('ACTIVE');
      return;
    }
    if (state === 'DISCONNECTED' || state === 'IDLE') {
      this.finishCurrent(false);
      return;
    }
    if (this.elapsed() >= (this.settings?.ringTimeoutMs ?? 0)) {
      await this.safeHangup();
      this.finishCurrent(false);
    }
  }

  private async tickActive(): Promise<void> {
    const state = await this.deps.readCallState();
    if (state === 'ACTIVE') {
      this.observedActive = true;
    }
    if (state === 'DISCONNECTED' || state === 'IDLE') {
      this.finishCurrent(this.observedActive);
      return;
    }
    if (this.elapsed() >= (this.settings?.maxCallDurationMs ?? 0)) {
      await this.safeHangup();
      this.finishCurrent(this.observedActive);
    }
  }

  private async dialNext(): Promise<void> {
    if (this.stopRequested || this.paused) {
      if (this.paused) {
        this.enter('PAUSED');
      }
      return;
    }

    await this.assertSafeToDial();
    const eligible = await this.deps.listEligible();
    const next = eligible.find((item) => !this.finishedIds.has(item.id));
    this.remaining = eligible.filter((item) => !this.finishedIds.has(item.id)).length;
    if (!next) {
      this.enter('COMPLETED');
      this.message = '자동발신이 완료되었습니다.';
      this.currentCustomerId = null;
      this.currentCallId = null;
      return;
    }

    this.currentCustomerId = next.id;
    this.attempt = this.attemptFor(next.id);
    this.observedActive = false;
    this.enter('DIALING');
    try {
      const call = await this.deps.placeCall(next.id);
      this.currentCallId = call.id;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Call failed';
      this.finishCurrent(false);
    }
  }

  private retries = new Map<string, number>();

  private attemptFor(customerId: string): number {
    return (this.retries.get(customerId) ?? 0) + 1;
  }

  private finishCurrent(connected: boolean): void {
    const customerId = this.currentCustomerId;
    this.currentCallId = null;
    this.currentCustomerId = null;

    if (!customerId) {
      this.enterWaitOrNext();
      return;
    }

    const failed = !connected;
    const settings = this.settings ?? DEFAULT_AUTO_CALL_SETTINGS;
    const used = this.retries.get(customerId) ?? 0;
    if (failed && settings.retryOnFailure && used < settings.maxRetries) {
      this.retries.set(customerId, used + 1);
      this.message = '실패하여 재시도 대기 중입니다.';
      this.enter('WAITING');
      return;
    }

    this.finishedIds.add(customerId);
    this.enterWaitOrNext();
  }

  private enterWaitOrNext(): void {
    if (this.stopRequested) {
      return;
    }
    if (this.paused) {
      this.enter('PAUSED');
      return;
    }
    this.enter('WAITING');
  }

  private async assertSafeToDial(): Promise<void> {
    if (!(await this.deps.getDeviceConnected())) {
      throw new Error('Galaxy is not connected');
    }
    if (!(await this.deps.isCompanionReady())) {
      throw new Error('Companion is not ready for auto-call');
    }
  }

  private async safeHangup(): Promise<void> {
    try {
      await this.deps.hangup();
    } catch {
      this.lastError = this.lastError ?? 'Hangup failed';
    }
  }

  private enter(phase: AutoCallPhase): void {
    this.phase = phase;
    this.phaseEnteredAt = this.deps.now();
  }

  private elapsed(): number {
    return this.deps.now() - this.phaseEnteredAt;
  }

  private reset(): void {
    this.phase = 'IDLE';
    this.paused = false;
    this.stopRequested = false;
    this.currentCustomerId = null;
    this.currentCallId = null;
    this.attempt = 0;
    this.remaining = 0;
    this.finishedIds.clear();
    this.retries.clear();
    this.observedActive = false;
    this.settings = null;
    this.lastError = null;
    this.message = null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
