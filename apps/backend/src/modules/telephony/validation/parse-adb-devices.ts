import type { AdbDeviceRow } from '../domain/telephony.types';

export function parseAdbDevicesOutput(stdout: string): AdbDeviceRow[] {
  const rows: AdbDeviceRow[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('List of devices')) {
      continue;
    }
    const [id, state] = line.split(/\s+/);
    if (!id || !state) {
      continue;
    }
    rows.push({ id, state });
  }
  return rows;
}
