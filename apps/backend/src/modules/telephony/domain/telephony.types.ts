export const CALL_STATUSES = ['REQUESTED', 'STARTED', 'FAILED'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_PROVIDERS = ['ADB_GALAXY'] as const;
export type CallProvider = (typeof CALL_PROVIDERS)[number];

export interface CallRecord {
  id: string;
  customerId: string;
  phoneNumber: string;
  status: CallStatus;
  provider: CallProvider;
  deviceId: string;
  errorMessage: string | null;
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
}

export interface CallStatusPatch {
  status: CallStatus;
  errorMessage?: string | null;
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
