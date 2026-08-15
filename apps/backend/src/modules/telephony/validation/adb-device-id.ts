export const ADB_DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function isSafeAdbDeviceId(value: string): boolean {
  return ADB_DEVICE_ID_PATTERN.test(value);
}
