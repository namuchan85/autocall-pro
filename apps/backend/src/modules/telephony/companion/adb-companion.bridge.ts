import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdbRuntimeSettings } from '../../settings/domain/adb-runtime-settings';
import { ADB_RUNTIME_SETTINGS } from '../../settings/domain/adb-runtime-settings';
import {
  AdbCommandFailedError,
  AdbExecutableMissingError,
  TelephonyConfigError,
} from '../domain/telephony.errors';
import { sanitizeErrorMessage } from '../validation/sanitize-error-message';
import {
  companionCommandArgs,
  companionDumpsysArgs,
  companionInstallArgs,
  companionPmPathArgs,
  companionRoleArgs,
  companionStatusQueryArgs,
} from './companion-argv';
import type { CompanionBridge } from './companion.bridge';
import { missingCompanionHealth, phoneControlFrom } from './companion.bridge';
import type { CompanionCommand } from './companion.constants';
import type { CompanionHealth, CompanionStatusSnapshot } from './companion.types';
import {
  isCompanionDefaultDialer,
  isCompanionInstalled,
  parseCompanionVersion,
  parseContentQuerySnapshot,
} from './parse-companion-status';

const execFile = promisify(execFileCallback);
const ADB_TIMEOUT_MS = 15_000;

@Injectable()
export class AdbCompanionBridge implements CompanionBridge {
  private readonly logger = new Logger(AdbCompanionBridge.name);

  constructor(@Inject(ADB_RUNTIME_SETTINGS) private readonly settings: AdbRuntimeSettings) {}

  async getHealth(deviceId: string): Promise<CompanionHealth> {
    const installedOutput = await this.run(companionPmPathArgs(deviceId));
    if (!isCompanionInstalled(installedOutput)) {
      return missingCompanionHealth();
    }

    const [versionOutput, roleOutput, status] = await Promise.all([
      this.run(companionDumpsysArgs(deviceId)).catch(() => ''),
      this.run(companionRoleArgs(deviceId)).catch(() => ''),
      this.readStatus(deviceId),
    ]);

    const defaultDialer = status?.defaultDialer || isCompanionDefaultDialer(roleOutput);
    const snapshot: CompanionStatusSnapshot = status ?? {
      installed: true,
      version: parseCompanionVersion(versionOutput),
      defaultDialer,
      callState: 'UNKNOWN',
      sessionId: null,
      lastError: null,
    };
    const version = snapshot.version ?? parseCompanionVersion(versionOutput);

    return {
      ...snapshot,
      installed: true,
      version,
      defaultDialer,
      ...phoneControlFrom({ installed: true, defaultDialer }),
    };
  }

  async readStatus(deviceId: string): Promise<CompanionStatusSnapshot | null> {
    try {
      const output = await this.run(companionStatusQueryArgs(deviceId));
      return parseContentQuerySnapshot(output);
    } catch (error) {
      if (error instanceof AdbCommandFailedError) {
        return null;
      }
      throw error;
    }
  }

  async sendCommand(
    deviceId: string,
    command: CompanionCommand,
    extras: { phoneNumber?: string; sessionId?: string } = {},
  ): Promise<void> {
    const output = await this.run(companionCommandArgs(deviceId, command, extras));
    if (/error:/i.test(output)) {
      this.logger.warn('Companion command reported an error');
      throw new AdbCommandFailedError(sanitizeErrorMessage(output) || 'Companion command failed');
    }
  }

  async installApk(deviceId: string, apkPath: string): Promise<void> {
    const output = await this.run(companionInstallArgs(deviceId, apkPath));
    if (/failure/i.test(output) || /error:/i.test(output)) {
      throw new AdbCommandFailedError(
        sanitizeErrorMessage(output) || 'Companion APK install failed',
      );
    }
  }

  private async run(args: string[]): Promise<string> {
    const adbPath = this.requireAdbPath();
    try {
      const { stdout, stderr } = await execFile(adbPath, args, {
        timeout: ADB_TIMEOUT_MS,
        windowsHide: true,
      });
      return `${stdout}\n${stderr}`;
    } catch (error) {
      throw this.toAdbError(error);
    }
  }

  private requireAdbPath(): string {
    const adbPath = this.settings.getAdbPath();
    if (!adbPath) {
      throw new TelephonyConfigError('ADB executable is not configured');
    }
    return adbPath;
  }

  private toAdbError(error: unknown): Error {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return new AdbExecutableMissingError();
    }
    const raw = error instanceof Error ? error.message : 'ADB command failed';
    this.logger.warn('Companion ADB process failed');
    return new AdbCommandFailedError(sanitizeErrorMessage(raw) || 'ADB command failed');
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
