import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { FileAdbSettings } from './file-adb-settings';

describe('FileAdbSettings', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'autocall-settings-'));
  const settingsPath = path.join(tempDir, 'settings.json');

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and reloads ADB settings', async () => {
    const settings = new FileAdbSettings(
      new ConfigService({
        DATABASE_URL: `file:${path.join(tempDir, 'autocall.db')}`,
        SETTINGS_PATH: settingsPath,
        ADB_PATH: '',
        ADB_DEVICE_ID: '',
      }),
    );

    await settings.save({ adbPath: 'C:\\platform-tools\\adb.exe', adbDeviceId: 'R3CR20HLMCV' });
    expect(settings.snapshot()).toEqual({
      adbPath: 'C:\\platform-tools\\adb.exe',
      adbDeviceId: 'R3CR20HLMCV',
    });
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toMatchObject({
      adbPath: 'C:\\platform-tools\\adb.exe',
    });
  });

  it('falls back to environment ADB_PATH when the settings file is empty', () => {
    const settings = new FileAdbSettings(
      new ConfigService({
        DATABASE_URL: `file:${path.join(tempDir, 'autocall.db')}`,
        SETTINGS_PATH: path.join(tempDir, 'missing-settings.json'),
        ADB_PATH: 'C:\\platform-tools\\adb.exe',
        ADB_DEVICE_ID: 'ENVDEVICE01',
      }),
    );

    expect(settings.snapshot()).toEqual({
      adbPath: 'C:\\platform-tools\\adb.exe',
      adbDeviceId: 'ENVDEVICE01',
    });
  });
});
