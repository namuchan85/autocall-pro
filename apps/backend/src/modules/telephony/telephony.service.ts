import { randomUUID } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import {
  BadRequestException,
  ConflictException,
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
import type {
  CallHistoryItem,
  CallRecord,
  CallStatus,
  TelephonyDeviceStatus,
} from './domain/telephony.types';
import { emptyCallTracking, isInProgressCall } from './domain/telephony.types';
import { isSafeAdbDeviceId } from './validation/adb-device-id';
import { callEligibilityMessage } from './validation/call-eligibility';
import { sanitizeErrorMessage } from './validation/sanitize-error-message';
import {
  COMPANION_BRIDGE,
  type CompanionBridge,
  missingCompanionHealth,
} from './companion/companion.bridge';
import type { CompanionCallState } from './companion/companion.constants';
import type { CompanionDashboardStatus, CompanionHealth } from './companion/companion.types';

@Injectable()
export class TelephonyService {
  private placing = false;
  private activeCall: CallRecord | null = null;

  constructor(
    @Inject(ADB_RUNTIME_SETTINGS) private readonly settings: AdbRuntimeSettings,
    private readonly customers: CustomersService,
    @Inject(CALL_REPOSITORY) private readonly calls: CallRepository,
    @Inject(ADB_GATEWAY) private readonly adb: AdbGateway,
    @Inject(COMPANION_BRIDGE) private readonly companion: CompanionBridge,
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

  async getCompanionStatus(): Promise<CompanionDashboardStatus> {
    const device = await this.getDevice();
    let companion = missingCompanionHealth();
    if (device.connected && device.deviceId) {
      try {
        companion = await this.companion.getHealth(device.deviceId);
      } catch (error) {
        companion = missingCompanionHealth({
          lastError: publicErrorMessage(error),
        });
      }
    }

    return {
      galaxy: {
        status: device.status,
        connected: device.connected,
        deviceId: device.deviceId,
      },
      companion,
      labels: {
        galaxy: device.connected ? 'Connected' : deviceStatusLabel(device.status),
        companion: companionLabel(companion),
        phoneControl: phoneControlLabel(companion),
      },
    };
  }

  listRecentCalls(limit = 50): Promise<CallHistoryItem[]> {
    return this.calls.listRecent(Math.min(Math.max(limit, 1), 100));
  }

  getActiveCall(): CallRecord | null {
    return this.activeCall && isInProgressCall(this.activeCall.status) ? this.activeCall : null;
  }

  async placeCall(customerId: string): Promise<CallRecord> {
    if (this.placing || this.getActiveCall()) {
      throw new ConflictException('A call is already in progress');
    }

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
        ...emptyCallTracking(),
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
        ...emptyCallTracking(),
      });
      throw new BadRequestException(E164_PHONE_MESSAGE);
    }

    this.placing = true;
    try {
      this.requireAdbPath();
      const connectedId = this.configuredDeviceId();
      await this.assertDeviceReady(connectedId);

      const companionHealth = await this.companion
        .getHealth(connectedId)
        .catch(() => missingCompanionHealth());
      const useCompanion = companionHealth.installed;
      const sessionId = useCompanion ? randomUUID() : null;

      const call = await this.calls.create({
        customerId: customer.id,
        phoneNumber,
        status: 'REQUESTED',
        provider: useCompanion ? 'COMPANION' : 'ADB_GALAXY',
        deviceId: connectedId,
        errorMessage: null,
        ...emptyCallTracking(),
        sessionId,
        companionState: useCompanion ? 'IDLE' : null,
        startedAt: new Date(),
      });

      try {
        if (useCompanion) {
          await this.companion.sendCommand(connectedId, 'dial', {
            phoneNumber,
            sessionId: sessionId ?? undefined,
          });
          const started = await this.calls.updateStatus(call.id, {
            status: 'DIALING',
            companionState: 'DIALING',
            errorMessage: null,
          });
          this.activeCall = started ?? call;
          return this.activeCall;
        }

        await this.adb.startCall(connectedId, phoneNumber);
        const started = await this.calls.updateStatus(call.id, {
          status: 'STARTED',
          errorMessage: null,
        });
        this.activeCall = started ?? call;
        return this.activeCall;
      } catch (error) {
        if (useCompanion) {
          try {
            await this.adb.startCall(connectedId, phoneNumber);
            const started = await this.calls.updateStatus(call.id, {
              status: 'STARTED',
              provider: 'ADB_GALAXY',
              errorMessage: 'Companion dial failed; used ADB fallback',
            });
            this.activeCall = started ?? call;
            return this.activeCall;
          } catch (fallbackError) {
            const message = publicErrorMessage(fallbackError);
            await this.calls.updateStatus(call.id, { status: 'FAILED', errorMessage: message });
            throw toHttpException(fallbackError);
          }
        }
        const message = publicErrorMessage(error);
        await this.calls.updateStatus(call.id, { status: 'FAILED', errorMessage: message });
        throw toHttpException(error);
      }
    } catch (error) {
      throw toHttpException(error);
    } finally {
      this.placing = false;
    }
  }

  async hangup(): Promise<CallRecord | null> {
    try {
      const active = this.getActiveCall();
      const device = await this.getDevice();
      if (!device.connected || !device.deviceId) {
        throw new AdbDeviceNotConnectedError();
      }

      const companionHealth = await this.companion
        .getHealth(device.deviceId)
        .catch(() => missingCompanionHealth());
      if (!companionHealth.installed || !companionHealth.defaultDialer) {
        throw new ServiceUnavailableException(
          'Hangup requires AutoCall Companion as the default dialer',
        );
      }

      await this.companion.sendCommand(device.deviceId, 'hangup', {
        sessionId: active?.sessionId ?? undefined,
      });

      if (!active) {
        return null;
      }

      const ended = await this.finishCall(active, 'CANCELLED', 'UNKNOWN');
      this.activeCall = ended;
      return ended;
    } catch (error) {
      throw toHttpException(error);
    }
  }

  async syncActiveCall(): Promise<CallRecord | null> {
    const active = this.getActiveCall();
    if (!active || active.provider !== 'COMPANION') {
      return active;
    }
    const deviceId = this.settings.getDeviceId();
    if (!deviceId) {
      return active;
    }
    const status = await this.companion.readStatus(deviceId).catch(() => null);
    if (!status) {
      return active;
    }
    const nextStatus = callStatusFromCompanion(status.callState, active.status);
    const observedActive = active.observedActive || status.callState === 'ACTIVE';
    const ended =
      status.callState === 'DISCONNECTED' || status.callState === 'IDLE'
        ? new Date()
        : active.endedAt;
    const updated = await this.calls.updateStatus(active.id, {
      status: nextStatus,
      companionState: status.callState,
      observedActive,
      endedAt: ended,
      durationSeconds: durationSeconds(active.startedAt, ended),
    });
    this.activeCall = updated;
    return updated;
  }

  async installCompanion(): Promise<{ installed: boolean }> {
    try {
      const device = await this.getDevice();
      if (!device.connected || !device.deviceId) {
        throw new AdbDeviceNotConnectedError();
      }
      const apkPath = process.env.COMPANION_APK_PATH?.trim() ?? '';
      if (
        !apkPath ||
        !existsSync(apkPath) ||
        !statSync(apkPath).isFile() ||
        !apkPath.toLowerCase().endsWith('.apk')
      ) {
        throw new BadRequestException(
          'Companion APK was not found. Build the Android project first.',
        );
      }
      await this.companion.installApk(device.deviceId, apkPath);
      return { installed: true };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  private async finishCall(
    call: CallRecord,
    status: CallStatus,
    companionState: CompanionCallState | null,
  ): Promise<CallRecord> {
    const endedAt = new Date();
    const updated = await this.calls.updateStatus(call.id, {
      status,
      companionState,
      endedAt,
      durationSeconds: durationSeconds(call.startedAt, endedAt),
    });
    return updated ?? call;
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

function durationSeconds(startedAt: Date | null, endedAt: Date | null): number | null {
  if (!startedAt || !endedAt) {
    return null;
  }
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
}

function callStatusFromCompanion(state: CompanionCallState, current: CallStatus): CallStatus {
  if (state === 'DIALING') {
    return 'DIALING';
  }
  if (state === 'RINGING') {
    return 'RINGING';
  }
  if (state === 'ACTIVE') {
    return 'ACTIVE';
  }
  if (state === 'DISCONNECTED' || state === 'IDLE') {
    return current === 'REQUESTED' ? 'CANCELLED' : 'DISCONNECTED';
  }
  return current;
}

function companionLabel(companion: CompanionHealth): string {
  if (companion.companion === 'ready') {
    return 'Ready';
  }
  if (companion.companion === 'installed') {
    return 'Installed';
  }
  return 'Not installed';
}

function phoneControlLabel(companion: CompanionHealth): string {
  if (companion.phoneControl === 'ready') {
    return 'Ready';
  }
  if (companion.phoneControl === 'permission_required') {
    return 'Default dialer permission required';
  }
  if (companion.phoneControl === 'installed') {
    return 'Installed';
  }
  return 'Not installed';
}

function deviceStatusLabel(status: TelephonyDeviceStatus['status']): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'unauthorized':
      return 'Unauthorized';
    case 'offline':
      return 'Offline';
    case 'adb_missing':
      return 'ADB missing';
    case 'not_configured':
      return 'Not configured';
    default:
      return 'Not connected';
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
    error instanceof ConflictException ||
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
