import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { E164_PHONE_MESSAGE, isE164PhoneNumber } from '../customers/validation/phone-number';
import {
  ADB_RUNTIME_SETTINGS,
  type AdbRuntimeSettings,
} from '../settings/domain/adb-runtime-settings';
import { ADB_GATEWAY, type AdbGateway } from './domain/adb.gateway';
import { CALL_REPOSITORY, type CallRepository } from './domain/call.repository';
import {
  AdbCommandFailedError,
  AdbDeviceNotConnectedError,
  AdbDeviceOfflineError,
  AdbDeviceUnauthorizedError,
  AdbExecutableMissingError,
  TelephonyConfigError,
} from './domain/telephony.errors';
import type { CallHistoryItem, CallRecord, TelephonyDeviceStatus } from './domain/telephony.types';
import { isSafeAdbDeviceId } from './validation/adb-device-id';
import { callEligibilityMessage } from './validation/call-eligibility';
import { sanitizeErrorMessage } from './validation/sanitize-error-message';

@Injectable()
export class TelephonyService {
  constructor(
    @Inject(ADB_RUNTIME_SETTINGS) private readonly settings: AdbRuntimeSettings,
    private readonly customers: CustomersService,
    @Inject(CALL_REPOSITORY) private readonly calls: CallRepository,
    @Inject(ADB_GATEWAY) private readonly adb: AdbGateway,
  ) {}

  async getDevice(): Promise<TelephonyDeviceStatus> {
    const adbPath = this.settings.getAdbPath();
    const configuredId = this.settings.getDeviceId().trim();
    if (!adbPath) {
      return {
        status: 'not_configured',
        connected: false,
        deviceId: configuredId || null,
        devices: [],
      };
    }

    try {
      const devices = await this.adb.listDevices();
      if (!configuredId) {
        return { status: 'not_configured', connected: false, deviceId: null, devices };
      }
      const found = devices.find((item) => item.id === configuredId);
      if (!found) {
        return { status: 'not_found', connected: false, deviceId: configuredId, devices };
      }
      if (found.state === 'unauthorized') {
        return { status: 'unauthorized', connected: false, deviceId: configuredId, devices };
      }
      if (found.state === 'offline') {
        return { status: 'offline', connected: false, deviceId: configuredId, devices };
      }
      if (found.state !== 'device') {
        return { status: 'not_found', connected: false, deviceId: configuredId, devices };
      }
      return { status: 'connected', connected: true, deviceId: configuredId, devices };
    } catch (error) {
      if (error instanceof AdbExecutableMissingError || error instanceof TelephonyConfigError) {
        return {
          status: 'adb_missing',
          connected: false,
          deviceId: configuredId || null,
          devices: [],
        };
      }
      throw toHttpException(error);
    }
  }

  listRecentCalls(limit = 50): Promise<CallHistoryItem[]> {
    return this.calls.listRecent(Math.min(Math.max(limit, 1), 100));
  }

  async placeCall(customerId: string): Promise<CallRecord> {
    const customer = await this.customers.getById(customerId);
    const eligibilityError = callEligibilityMessage(customer);
    if (eligibilityError) {
      throw new ForbiddenException(eligibilityError);
    }

    const phoneNumber = customer.phoneNumber.trim();
    const deviceId = this.settings.getDeviceId() || 'unconfigured';

    if (!phoneNumber) {
      await this.calls.create({
        customerId: customer.id,
        phoneNumber: '',
        status: 'FAILED',
        provider: 'ADB_GALAXY',
        deviceId,
        errorMessage: 'Phone number is missing',
      });
      throw new BadRequestException('Phone number is missing');
    }

    if (!isE164PhoneNumber(phoneNumber)) {
      await this.calls.create({
        customerId: customer.id,
        phoneNumber,
        status: 'FAILED',
        provider: 'ADB_GALAXY',
        deviceId,
        errorMessage: 'Invalid phone number',
      });
      throw new BadRequestException(E164_PHONE_MESSAGE);
    }

    try {
      this.requireAdbPath();
      const connectedId = this.configuredDeviceId();
      await this.assertDeviceReady(connectedId);
      const call = await this.calls.create({
        customerId: customer.id,
        phoneNumber,
        status: 'REQUESTED',
        provider: 'ADB_GALAXY',
        deviceId: connectedId,
        errorMessage: null,
      });
      try {
        await this.adb.startCall(connectedId, phoneNumber);
        const started = await this.calls.updateStatus(call.id, {
          status: 'STARTED',
          errorMessage: null,
        });
        if (!started) {
          throw new NotFoundException('Call record was not found');
        }
        return started;
      } catch (error) {
        const message = publicErrorMessage(error);
        await this.calls.updateStatus(call.id, { status: 'FAILED', errorMessage: message });
        throw toHttpException(error);
      }
    } catch (error) {
      throw toHttpException(error);
    }
  }

  private requireAdbPath(): string {
    const adbPath = this.settings.getAdbPath();
    if (!adbPath) {
      throw new TelephonyConfigError('ADB executable is not configured');
    }
    return adbPath;
  }

  private configuredDeviceId(): string {
    const deviceId = this.settings.getDeviceId();
    if (!deviceId) {
      throw new TelephonyConfigError('ADB device is not configured');
    }
    if (!isSafeAdbDeviceId(deviceId)) {
      throw new TelephonyConfigError('ADB device id is invalid');
    }
    return deviceId;
  }

  private async assertDeviceReady(deviceId: string): Promise<void> {
    const devices = await this.adb.listDevices();
    const found = devices.find((item) => item.id === deviceId);
    if (!found) {
      throw new AdbDeviceNotConnectedError();
    }
    if (found.state === 'unauthorized') {
      throw new AdbDeviceUnauthorizedError();
    }
    if (found.state === 'offline') {
      throw new AdbDeviceOfflineError();
    }
    if (found.state !== 'device') {
      throw new AdbDeviceNotConnectedError();
    }
  }
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return sanitizeErrorMessage(error.message);
  }
  return 'ADB call command failed';
}

function toHttpException(error: unknown): Error {
  if (
    error instanceof BadRequestException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException ||
    error instanceof ServiceUnavailableException
  ) {
    return error;
  }
  if (error instanceof TelephonyConfigError) {
    return new ServiceUnavailableException(error.message);
  }
  if (error instanceof AdbExecutableMissingError) {
    return new ServiceUnavailableException('ADB executable was not found');
  }
  if (error instanceof AdbDeviceUnauthorizedError) {
    return new ServiceUnavailableException(error.message);
  }
  if (error instanceof AdbDeviceOfflineError) {
    return new ServiceUnavailableException(error.message);
  }
  if (error instanceof AdbDeviceNotConnectedError) {
    return new ServiceUnavailableException(error.message);
  }
  if (error instanceof AdbCommandFailedError) {
    return new ServiceUnavailableException('ADB call command failed');
  }
  return new ServiceUnavailableException('ADB call command failed');
}
