import type { CompanionCallState } from './companion.constants';

export const PHONE_CONTROL_STATUSES = [
  'ready',
  'installed',
  'missing',
  'permission_required',
] as const;
export type PhoneControlStatus = (typeof PHONE_CONTROL_STATUSES)[number];

export const COMPANION_READINESS = ['ready', 'installed', 'missing'] as const;
export type CompanionReadiness = (typeof COMPANION_READINESS)[number];

export interface CompanionStatusSnapshot {
  installed: boolean;
  version: string | null;
  defaultDialer: boolean;
  callState: CompanionCallState;
  sessionId: string | null;
  lastError: string | null;
}

export interface CompanionHealth extends CompanionStatusSnapshot {
  phoneControl: PhoneControlStatus;
  companion: CompanionReadiness;
}

export interface CompanionDashboardStatus {
  galaxy: {
    status: string;
    connected: boolean;
    deviceId: string | null;
  };
  companion: CompanionHealth;
  labels: {
    galaxy: string;
    companion: string;
    phoneControl: string;
  };
}
