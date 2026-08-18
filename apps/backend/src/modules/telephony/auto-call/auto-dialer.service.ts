import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CustomersService } from '../../customers/customers.service';
import { TelephonyService } from '../telephony.service';
import { AutoCallMachine, type AutoCallSettings, type AutoCallSnapshot } from './auto-call-machine';

const TICK_MS = 1_000;

@Injectable()
export class AutoDialerService implements OnModuleDestroy {
  private readonly machine: AutoCallMachine;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly telephony: TelephonyService,
    private readonly customers: CustomersService,
  ) {
    this.machine = new AutoCallMachine({
      now: () => Date.now(),
      getDeviceConnected: async () => (await this.telephony.getDevice()).connected,
      isCompanionReady: async () => {
        const status = await this.telephony.getCompanionStatus();
        return status.companion.phoneControl === 'ready';
      },
      listEligible: async () => this.customers.listEligibleForAutoCall(),
      placeCall: async (customerId) => this.telephony.placeCall(customerId),
      hangup: async () => {
        await this.telephony.hangup();
      },
      readCallState: async () => {
        await this.telephony.syncActiveCall();
        const status = await this.telephony.getCompanionStatus();
        return status.companion.callState;
      },
    });
  }

  snapshot(): AutoCallSnapshot {
    return this.machine.snapshot();
  }

  async start(settings: Partial<AutoCallSettings> = {}): Promise<AutoCallSnapshot> {
    try {
      await this.machine.start(settings);
    } catch (error) {
      throw toAutoCallHttp(error);
    }
    this.startTimer();
    return this.snapshot();
  }

  pause(): AutoCallSnapshot {
    this.machine.pause();
    return this.snapshot();
  }

  async resume(): Promise<AutoCallSnapshot> {
    await this.machine.resume();
    this.startTimer();
    return this.snapshot();
  }

  async stop(hangupCurrent = true): Promise<AutoCallSnapshot> {
    await this.machine.stop(hangupCurrent);
    this.stopTimer();
    return this.snapshot();
  }

  onModuleDestroy(): void {
    this.stopTimer();
  }

  private startTimer(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.machine.tick().then(() => {
        if (!this.machine.snapshot().running) {
          this.stopTimer();
        }
      });
    }, TICK_MS);
    this.timer.unref?.();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

function toAutoCallHttp(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Auto-call failed';
  if (message.includes('already running')) {
    return new ConflictException(message);
  }
  if (message.includes('Galaxy') || message.includes('Companion')) {
    return new ServiceUnavailableException(message);
  }
  return new BadRequestException(message);
}
