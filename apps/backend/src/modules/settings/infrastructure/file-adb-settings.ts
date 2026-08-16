import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toSqliteFilePath } from '../../../infrastructure/database/sqlite-url';
import type { AdbRuntimeSettings, AppSettingsSnapshot } from '../domain/adb-runtime-settings';

interface SettingsFile {
  adbPath?: string;
  adbDeviceId?: string;
}

@Injectable()
export class FileAdbSettings implements AdbRuntimeSettings {
  private cached: SettingsFile = {};

  constructor(private readonly config: ConfigService) {
    this.cached = this.readFile();
  }

  getAdbPath(): string {
    return this.cached.adbPath?.trim() || this.config.get<string>('ADB_PATH')?.trim() || '';
  }

  getDeviceId(): string {
    return (
      this.cached.adbDeviceId?.trim() || this.config.get<string>('ADB_DEVICE_ID')?.trim() || ''
    );
  }

  snapshot(): AppSettingsSnapshot {
    return {
      adbPath: this.getAdbPath(),
      adbDeviceId: this.getDeviceId(),
    };
  }

  async save(input: { adbPath: string; adbDeviceId: string }): Promise<void> {
    this.cached = {
      adbPath: input.adbPath.trim(),
      adbDeviceId: input.adbDeviceId.trim(),
    };
    const filePath = this.settingsFilePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(this.cached, null, 2)}\n`, 'utf8');
    await Promise.resolve();
  }

  private settingsFilePath(): string {
    const configured = this.config.get<string>('SETTINGS_PATH')?.trim();
    if (configured) {
      return path.resolve(configured);
    }
    const databaseUrl = this.config.getOrThrow<string>('DATABASE_URL');
    return path.join(path.dirname(toSqliteFilePath(databaseUrl)), 'settings.json');
  }

  private readFile(): SettingsFile {
    const filePath = this.settingsFilePath();
    if (!existsSync(filePath)) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      const record = parsed as Record<string, unknown>;
      return {
        adbPath: typeof record.adbPath === 'string' ? record.adbPath : undefined,
        adbDeviceId: typeof record.adbDeviceId === 'string' ? record.adbDeviceId : undefined,
      };
    } catch {
      return {};
    }
  }
}
