import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdbGateway } from '../domain/adb.gateway';
import {
  AdbCommandFailedError,
  AdbExecutableMissingError,
  TelephonyConfigError,
} from '../domain/telephony.errors';
import type { AdbDeviceRow } from '../domain/telephony.types';
import { isSafeAdbDeviceId } from '../validation/adb-device-id';
import { parseAdbDevicesOutput } from '../validation/parse-adb-devices';
import { isE164PhoneNumber } from '../../customers/validation/phone-number';
import { sanitizeErrorMessage } from '../validation/sanitize-error-message';

const execFile = promisify(execFileCallback);
const ADB_TIMEOUT_MS = 10_000;

@Injectable()
export class AdbProcessGateway implements AdbGateway {
  private readonly logger = new Logger(AdbProcessGateway.name);

  constructor(private readonly config: ConfigService) {}

  async listDevices(): Promise<AdbDeviceRow[]> {
    const adbPath = this.requireAdbPath();
    try {
      const { stdout } = await execFile(adbPath, ['devices'], {
        timeout: ADB_TIMEOUT_MS,
        windowsHide: true,
      });
      return parseAdbDevicesOutput(stdout);
    } catch (error) {
      throw this.toAdbError(error);
    }
  }

  async startCall(deviceId: string, phoneNumber: string): Promise<void> {
    if (!isSafeAdbDeviceId(deviceId)) {
      throw new AdbCommandFailedError('ADB device id is invalid');
    }
    if (!isE164PhoneNumber(phoneNumber)) {
      throw new AdbCommandFailedError('Phone number is invalid');
    }

    const adbPath = this.requireAdbPath();
    try {
      const { stdout, stderr } = await execFile(
        adbPath,
        [
          '-s',
          deviceId,
          'shell',
          'am',
          'start',
          '-a',
          'android.intent.action.CALL',
          '-d',
          `tel:${phoneNumber}`,
        ],
        { timeout: ADB_TIMEOUT_MS, windowsHide: true },
      );
      const output = `${stdout}\n${stderr}`;
      if (/error:/i.test(output)) {
        this.logger.warn('ADB call command reported an error');
        throw new AdbCommandFailedError(sanitizeErrorMessage(output) || 'ADB call command failed');
      }
    } catch (error) {
      if (error instanceof AdbCommandFailedError) {
        throw error;
      }
      throw this.toAdbError(error);
    }
  }

  private requireAdbPath(): string {
    const adbPath = this.config.get<string>('ADB_PATH')?.trim() ?? '';
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
    this.logger.warn('ADB process failed');
    return new AdbCommandFailedError(sanitizeErrorMessage(raw) || 'ADB command failed');
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
