import type { CompanionCallState, CompanionCommand } from './companion.constants';
import type { CompanionHealth, CompanionStatusSnapshot } from './companion.types';

export const COMPANION_BRIDGE = Symbol('COMPANION_BRIDGE');

export interface CompanionBridge {
  getHealth(deviceId: string): Promise<CompanionHealth>;
  readStatus(deviceId: string): Promise<CompanionStatusSnapshot | null>;
  sendCommand(
    deviceId: string,
    command: CompanionCommand,
    extras?: { phoneNumber?: string; sessionId?: string },
  ): Promise<void>;
  installApk(deviceId: string, apkPath: string): Promise<void>;
}

export function missingCompanionHealth(overrides: Partial<CompanionHealth> = {}): CompanionHealth {
  return {
    installed: false,
    version: null,
    defaultDialer: false,
    callState: 'UNKNOWN',
    sessionId: null,
    lastError: null,
    phoneControl: 'missing',
    companion: 'missing',
    ...overrides,
  };
}

export function phoneControlFrom(snapshot: Pick<CompanionHealth, 'installed' | 'defaultDialer'>): {
  phoneControl: CompanionHealth['phoneControl'];
  companion: CompanionHealth['companion'];
} {
  if (!snapshot.installed) {
    return { phoneControl: 'missing', companion: 'missing' };
  }
  if (!snapshot.defaultDialer) {
    return { phoneControl: 'permission_required', companion: 'installed' };
  }
  return { phoneControl: 'ready', companion: 'ready' };
}

export function isInProgressCallState(state: CompanionCallState): boolean {
  return state === 'DIALING' || state === 'RINGING' || state === 'ACTIVE';
}
