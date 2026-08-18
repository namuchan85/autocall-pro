export const CALL_STATUSES = [
  'REQUESTED',
  'STARTED',
  'DIALING',
  'RINGING',
  'ACTIVE',
  'DISCONNECTED',
  'FAILED',
  'CANCELLED',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_PROVIDERS = ['ADB_GALAXY', 'COMPANION'] as const;
export type CallProvider = (typeof CALL_PROVIDERS)[number];

export const IN_PROGRESS_CALL_STATUSES = [
  'REQUESTED',
  'STARTED',
  'DIALING',
  'RINGING',
  'ACTIVE',
] as const;

export interface CallRecord {
  id: string;
  customerId: string;
  phoneNumber: string;
  status: CallStatus;
  provider: CallProvider;
  deviceId: string;
  errorMessage: string | null;
  sessionId: string | null;
  companionState: string | null;
  observedActive: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  attempt: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCall {
  customerId: string;
  phoneNumber: string;
  status: CallStatus;
  provider: CallProvider;
  deviceId: string;
  errorMessage?: string | null;
  sessionId?: string | null;
  companionState?: string | null;
  observedActive?: boolean;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  attempt?: number;
}

export interface CallStatusPatch {
  status?: CallStatus;
  provider?: CallProvider;
  errorMessage?: string | null;
  sessionId?: string | null;
  companionState?: string | null;
  observedActive?: boolean;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  attempt?: number;
}

export interface CallHistoryItem extends CallRecord {
  customerName: string;
}

export interface AdbDeviceRow {
  id: string;
  state: string;
}

export const DEVICE_CONNECTION_STATUSES = [
  'connected',
  'unauthorized',
  'offline',
  'not_found',
  'not_configured',
  'adb_missing',
] as const;
export type DeviceConnectionStatus = (typeof DEVICE_CONNECTION_STATUSES)[number];

export interface TelephonyDeviceStatus {
  status: DeviceConnectionStatus;
  connected: boolean;
  deviceId: string | null;
  devices: AdbDeviceRow[];
}

export function isInProgressCall(status: CallStatus): boolean {
  return (IN_PROGRESS_CALL_STATUSES as readonly string[]).includes(status);
}

export function emptyCallTracking(): Pick<
  CallRecord,
  | 'sessionId'
  | 'companionState'
  | 'observedActive'
  | 'startedAt'
  | 'endedAt'
  | 'durationSeconds'
  | 'attempt'
> {
  return {
    sessionId: null,
    companionState: null,
    observedActive: false,
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    attempt: 1,
  };
}
