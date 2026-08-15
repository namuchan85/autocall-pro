import type { AdbDeviceRow } from './telephony.types';

export const ADB_GATEWAY = Symbol('ADB_GATEWAY');

export interface AdbGateway {
  listDevices(): Promise<AdbDeviceRow[]>;
  startCall(deviceId: string, phoneNumber: string): Promise<void>;
}
