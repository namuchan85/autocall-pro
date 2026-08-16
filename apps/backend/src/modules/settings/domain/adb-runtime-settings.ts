export const ADB_RUNTIME_SETTINGS = Symbol('ADB_RUNTIME_SETTINGS');

export interface AdbRuntimeSettings {
  getAdbPath(): string;
  getDeviceId(): string;
  save(input: { adbPath: string; adbDeviceId: string }): Promise<void>;
}

export interface AppSettingsSnapshot {
  adbPath: string;
  adbDeviceId: string;
}
