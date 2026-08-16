import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const DEFAULT_ADB_CANDIDATES = [
  'C:\\platform-tools\\adb.exe',
  path.join(homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
];

export function discoverAdbPath(): string {
  return DEFAULT_ADB_CANDIDATES.find((candidate) => existsSync(candidate)) ?? '';
}
