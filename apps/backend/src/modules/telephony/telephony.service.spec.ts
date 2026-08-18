import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import type { CustomerRecord } from '../customers/domain/customer.types';
import type { AdbRuntimeSettings } from '../settings/domain/adb-runtime-settings';
import type { AdbGateway } from './domain/adb.gateway';
import type { CallRepository } from './domain/call.repository';
import { AdbCommandFailedError, AdbExecutableMissingError } from './domain/telephony.errors';
import type { CallRecord } from './domain/telephony.types';
import { missingCompanionHealth, type CompanionBridge } from './companion/companion.bridge';
import { TelephonyService } from './telephony.service';

const DEVICE_ID = 'TESTDEVICE01';
const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';

function createCustomer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  const now = new Date('2026-08-15T00:00:00.000Z');
  return {
    id: CUSTOMER_ID,
    customerCode: 'CUST-001',
    name: 'Hong Gildong',
    phoneNumber: '+821012345678',
    company: null,
    memo: null,
    status: 'ACTIVE',
    doNotCall: false,
    lastOutcome: null,
    latestCall: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createCall(overrides: Partial<CallRecord> = {}): CallRecord {
  const now = new Date('2026-08-15T00:00:00.000Z');
  return {
    id: '22222222-2222-4222-8222-222222222222',
    customerId: CUSTOMER_ID,
    phoneNumber: '+821012345678',
    status: 'REQUESTED',
    provider: 'ADB_GALAXY',
    deviceId: DEVICE_ID,
    errorMessage: null,
    sessionId: null,
    companionState: null,
    observedActive: false,
    startedAt: null,
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    disconnectSource: null,
    disconnectCause: null,
    attempt: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(
  overrides: {
    getById?: CustomersService['getById'];
    calls?: Partial<CallRepository>;
    adb?: Partial<AdbGateway>;
    companion?: Partial<CompanionBridge>;
    deviceId?: string;
    adbPath?: string;
  } = {},
): {
  service: TelephonyService;
  createCallRecord: jest.Mock;
  updateStatus: jest.Mock;
  startCall: jest.Mock;
  companionStart: jest.Mock;
} {
  const createCallRecord = overrides.calls?.create ?? jest.fn();
  const updateStatus = overrides.calls?.updateStatus ?? jest.fn();
  const startCall = overrides.adb?.startCall ?? jest.fn().mockResolvedValue(undefined);
  const listDevices =
    overrides.adb?.listDevices ?? jest.fn().mockResolvedValue([{ id: DEVICE_ID, state: 'device' }]);
  const companionStart = overrides.companion?.sendCommand ?? jest.fn().mockResolvedValue(undefined);
  const calls = {
    create: createCallRecord,
    updateStatus,
    findById: jest.fn(),
    listRecent: jest.fn(),
  } as jest.Mocked<CallRepository>;
  const adb = {
    listDevices,
    startCall,
  } as jest.Mocked<AdbGateway>;
  const companion = {
    getHealth:
      overrides.companion?.getHealth ?? jest.fn().mockResolvedValue(missingCompanionHealth()),
    readStatus: overrides.companion?.readStatus ?? jest.fn().mockResolvedValue(null),
    sendCommand: companionStart,
    installApk: overrides.companion?.installApk ?? jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<CompanionBridge>;
  const customers = {
    getById: overrides.getById ?? jest.fn().mockResolvedValue(createCustomer()),
  } as Pick<CustomersService, 'getById'>;
  const settings: AdbRuntimeSettings = {
    getAdbPath: () => overrides.adbPath ?? 'C:\\platform-tools\\adb.exe',
    getDeviceId: () => overrides.deviceId ?? DEVICE_ID,
    save: () => Promise.resolve(),
  };

  return {
    service: new TelephonyService(settings, customers as CustomersService, calls, adb, companion),
    createCallRecord,
    updateStatus,
    startCall,
    companionStart,
  };
}

describe('TelephonyService', () => {
  it('returns the connected device', async () => {
    const { service } = createService();

    await expect(service.getDevice()).resolves.toEqual({
      status: 'connected',
      connected: true,
      deviceId: DEVICE_ID,
      devices: [{ id: DEVICE_ID, state: 'device' }],
    });
  });

  it('reports not_found when no device is attached', async () => {
    const { service } = createService({
      adb: { listDevices: jest.fn().mockResolvedValue([]) },
    });

    await expect(service.getDevice()).resolves.toMatchObject({
      status: 'not_found',
      connected: false,
    });
  });

  it('reports not_configured when ADB_PATH is missing', async () => {
    const { service } = createService({ adbPath: '' });

    await expect(service.getDevice()).resolves.toMatchObject({ status: 'not_configured' });
  });

  it('reports not_configured when ADB_DEVICE_ID is missing', async () => {
    const { service } = createService({ deviceId: '' });

    await expect(service.getDevice()).resolves.toMatchObject({ status: 'not_configured' });
  });

  it('reports unauthorized when Galaxy USB debugging is unauthorized', async () => {
    const { service } = createService({
      adb: { listDevices: jest.fn().mockResolvedValue([{ id: DEVICE_ID, state: 'unauthorized' }]) },
    });

    await expect(service.getDevice()).resolves.toMatchObject({ status: 'unauthorized' });
  });

  it('reports offline when Galaxy is offline', async () => {
    const { service } = createService({
      adb: { listDevices: jest.fn().mockResolvedValue([{ id: DEVICE_ID, state: 'offline' }]) },
    });

    await expect(service.getDevice()).resolves.toMatchObject({ status: 'offline' });
  });

  it('places a call and records STARTED', async () => {
    const requested = createCall();
    const started = createCall({ status: 'STARTED' });
    const { service, updateStatus, startCall } = createService({
      calls: {
        create: jest.fn().mockResolvedValue(requested),
        updateStatus: jest.fn().mockResolvedValue(started),
      },
    });

    await expect(service.placeCall(CUSTOMER_ID)).resolves.toEqual(started);
    expect(startCall).toHaveBeenCalledWith(DEVICE_ID, '+821012345678');
    expect(updateStatus).toHaveBeenCalledWith(requested.id, {
      status: 'STARTED',
      errorMessage: null,
    });
  });

  it('rejects a missing customer without creating a call', async () => {
    const { service, createCallRecord } = createService({
      getById: jest.fn().mockRejectedValue(new NotFoundException('Customer not found')),
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(createCallRecord).not.toHaveBeenCalled();
  });

  it('allows a call when the customer is ACTIVE and not do-not-call', async () => {
    const requested = createCall();
    const started = createCall({ status: 'STARTED' });
    const { service, startCall } = createService({
      getById: jest.fn().mockResolvedValue(createCustomer({ status: 'ACTIVE', doNotCall: false })),
      calls: {
        create: jest.fn().mockResolvedValue(requested),
        updateStatus: jest.fn().mockResolvedValue(started),
      },
    });

    await expect(service.placeCall(CUSTOMER_ID)).resolves.toEqual(started);
    expect(startCall).toHaveBeenCalledWith(DEVICE_ID, '+821012345678');
  });

  it('rejects a do-not-call customer without ADB or a Call record', async () => {
    const { service, createCallRecord, startCall } = createService({
      getById: jest.fn().mockResolvedValue(createCustomer({ doNotCall: true })),
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createCallRecord).not.toHaveBeenCalled();
    expect(startCall).not.toHaveBeenCalled();
  });

  it('rejects an INACTIVE customer without ADB or a Call record', async () => {
    const { service, createCallRecord, startCall } = createService({
      getById: jest.fn().mockResolvedValue(createCustomer({ status: 'INACTIVE' })),
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createCallRecord).not.toHaveBeenCalled();
    expect(startCall).not.toHaveBeenCalled();
  });

  it('rejects a BLOCKED customer without ADB or a Call record', async () => {
    const { service, createCallRecord, startCall } = createService({
      getById: jest.fn().mockResolvedValue(createCustomer({ status: 'BLOCKED' })),
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createCallRecord).not.toHaveBeenCalled();
    expect(startCall).not.toHaveBeenCalled();
  });

  it('records FAILED for an invalid phone number', async () => {
    const failed = createCall({ status: 'FAILED', phoneNumber: '01012345678' });
    const { service, createCallRecord, startCall } = createService({
      getById: jest.fn().mockResolvedValue(createCustomer({ phoneNumber: '01012345678' })),
      calls: { create: jest.fn().mockResolvedValue(failed) },
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(createCallRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: 'Invalid phone number' }),
    );
    expect(startCall).not.toHaveBeenCalled();
  });

  it('records FAILED when ADB execution fails', async () => {
    const requested = createCall();
    const failed = createCall({ status: 'FAILED', errorMessage: 'ADB call command failed' });
    const { service, updateStatus } = createService({
      calls: {
        create: jest.fn().mockResolvedValue(requested),
        updateStatus: jest.fn().mockResolvedValue(failed),
      },
      adb: {
        listDevices: jest.fn().mockResolvedValue([{ id: DEVICE_ID, state: 'device' }]),
        startCall: jest.fn().mockRejectedValue(new AdbCommandFailedError()),
      },
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(updateStatus).toHaveBeenCalledWith(requested.id, {
      status: 'FAILED',
      errorMessage: 'ADB call command failed',
    });
  });

  it('rejects without a Call record when the ADB executable is missing', async () => {
    const { service, createCallRecord, startCall } = createService({
      adb: {
        listDevices: jest.fn().mockRejectedValue(new AdbExecutableMissingError()),
      },
    });

    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(createCallRecord).not.toHaveBeenCalled();
    expect(startCall).not.toHaveBeenCalled();
  });

  it('prefers Companion when it is installed', async () => {
    const requested = createCall({ provider: 'COMPANION', status: 'REQUESTED' });
    const dialing = createCall({
      provider: 'COMPANION',
      status: 'DIALING',
      companionState: 'DIALING',
    });
    const { service, startCall, companionStart } = createService({
      calls: {
        create: jest.fn().mockResolvedValue(requested),
        updateStatus: jest.fn().mockResolvedValue(dialing),
      },
      companion: {
        getHealth: jest.fn().mockResolvedValue({
          ...missingCompanionHealth(),
          installed: true,
          companion: 'installed',
          phoneControl: 'permission_required',
        }),
      },
    });

    await expect(service.placeCall(CUSTOMER_ID)).resolves.toEqual(dialing);
    expect(companionStart).toHaveBeenCalledWith(
      DEVICE_ID,
      'dial',
      expect.objectContaining({ phoneNumber: '+821012345678' }),
    );
    expect(startCall).not.toHaveBeenCalled();
  });

  it('falls back to ADB ACTION_CALL when Companion dial fails', async () => {
    const requested = createCall({ provider: 'COMPANION' });
    const started = createCall({ provider: 'ADB_GALAXY', status: 'STARTED' });
    const { service, startCall } = createService({
      calls: {
        create: jest.fn().mockResolvedValue(requested),
        updateStatus: jest.fn().mockResolvedValue(started),
      },
      companion: {
        getHealth: jest.fn().mockResolvedValue({
          ...missingCompanionHealth(),
          installed: true,
          companion: 'installed',
          phoneControl: 'permission_required',
        }),
        sendCommand: jest.fn().mockRejectedValue(new AdbCommandFailedError('companion failed')),
      },
    });

    await expect(service.placeCall(CUSTOMER_ID)).resolves.toEqual(started);
    expect(startCall).toHaveBeenCalledWith(DEVICE_ID, '+821012345678');
  });

  it('rejects a second in-progress call', async () => {
    const requested = createCall();
    const started = createCall({ status: 'STARTED' });
    const { service } = createService({
      calls: {
        create: jest.fn().mockResolvedValue(requested),
        updateStatus: jest.fn().mockResolvedValue(started),
      },
    });

    await service.placeCall(CUSTOMER_ID);
    await expect(service.placeCall(CUSTOMER_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  describe('syncActiveCall (Companion lifecycle)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('sets answeredAt when ACTIVE is observed the first time', async () => {
      jest.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));

      const requested = createCall({
        provider: 'COMPANION',
        status: 'REQUESTED',
        sessionId: 'sess-1',
      });
      const dialing = createCall({
        provider: 'COMPANION',
        status: 'DIALING',
        companionState: 'DIALING',
        sessionId: 'sess-1',
      });

      const { service, updateStatus } = createService({
        calls: {
          create: jest.fn().mockResolvedValue(requested),
          updateStatus: jest.fn().mockResolvedValue(dialing),
        },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
          sendCommand: jest.fn().mockResolvedValue(undefined),
          readStatus: jest.fn().mockResolvedValue({
            installed: true,
            version: '1.0.2',
            defaultDialer: true,
            callState: 'ACTIVE',
            sessionId: 'sess-1',
            lastError: null,
          }),
        },
      });

      // Place call to set service.activeCall to dialing.
      await service.placeCall(CUSTOMER_ID);

      jest.setSystemTime(new Date('2026-08-15T00:00:05.000Z'));

      await service.syncActiveCall();

      expect(updateStatus).toHaveBeenCalledWith(
        dialing.id,
        expect.objectContaining({
          status: 'ACTIVE',
          companionState: 'ACTIVE',
          observedActive: true,
          answeredAt: new Date('2026-08-15T00:00:05.000Z'),
        }),
      );
    });

    it('finalizes endedAt/durationSeconds on DISCONNECTED (and is idempotent)', async () => {
      jest.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));

      const active = createCall({
        provider: 'COMPANION',
        status: 'ACTIVE',
        companionState: 'ACTIVE',
        sessionId: 'sess-1',
        observedActive: true,
        answeredAt: new Date('2026-08-15T00:00:01.000Z'),
        startedAt: new Date('2026-08-15T00:00:00.000Z'),
      });

      const updateStatus = jest.fn().mockResolvedValue({
        ...active,
        status: 'DISCONNECTED',
      });

      const { service } = createService({
        calls: {
          updateStatus,
        },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
          readStatus: jest.fn().mockResolvedValue({
            installed: true,
            version: '1.0.2',
            defaultDialer: true,
            callState: 'DISCONNECTED',
            sessionId: 'sess-1',
            lastError: null,
          }),
        },
      });

      // Force activeCall (private) for this unit test.
      (service as unknown as { activeCall: CallRecord }).activeCall = active;

      jest.setSystemTime(new Date('2026-08-15T00:00:10.000Z'));
      await service.syncActiveCall();

      expect(updateStatus).toHaveBeenCalledWith(
        active.id,
        expect.objectContaining({
          status: 'DISCONNECTED',
          companionState: 'DISCONNECTED',
          endedAt: new Date('2026-08-15T00:00:10.000Z'),
          durationSeconds: 10,
          disconnectSource: 'COMPANION',
        }),
      );

      // Second call should not update again because status is terminal.
      await service.syncActiveCall();
      expect(updateStatus).toHaveBeenCalledTimes(1);
    });

    it('records session mismatch as errorMessage', async () => {
      const active = createCall({
        provider: 'COMPANION',
        status: 'ACTIVE',
        companionState: 'ACTIVE',
        sessionId: 'sess-1',
        startedAt: new Date('2026-08-15T00:00:00.000Z'),
        observedActive: false,
      });

      const updateStatus = jest.fn().mockResolvedValue({
        ...active,
        status: 'ACTIVE',
      });

      const { service } = createService({
        calls: { updateStatus },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
          readStatus: jest.fn().mockResolvedValue({
            installed: true,
            version: '1.0.2',
            defaultDialer: true,
            callState: 'ACTIVE',
            sessionId: 'sess-2',
            lastError: null,
          }),
        },
      });

      (service as unknown as { activeCall: CallRecord }).activeCall = active;
      await service.syncActiveCall();

      expect(updateStatus).toHaveBeenCalledWith(
        active.id,
        expect.objectContaining({
          errorMessage: 'Companion sessionId mismatch',
        }),
      );
    });

    it('sets DIALING state when companion reports DIALING', async () => {
      jest.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));

      const active = createCall({
        provider: 'COMPANION',
        status: 'REQUESTED',
        companionState: null,
        sessionId: 'sess-1',
        startedAt: new Date('2026-08-15T00:00:00.000Z'),
        observedActive: false,
      });

      const updateStatus = jest.fn().mockResolvedValue({
        ...active,
        status: 'DIALING',
      });

      const { service } = createService({
        calls: { updateStatus },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
          readStatus: jest.fn().mockResolvedValue({
            installed: true,
            version: '1.0.2',
            defaultDialer: true,
            callState: 'DIALING',
            sessionId: 'sess-1',
            lastError: null,
          }),
        },
      });

      (service as unknown as { activeCall: CallRecord }).activeCall = active;
      await service.syncActiveCall();

      expect(updateStatus).toHaveBeenCalledWith(
        active.id,
        expect.objectContaining({
          status: 'DIALING',
          companionState: 'DIALING',
          observedActive: false,
        }),
      );
    });

    it('records missing sessionId as errorMessage', async () => {
      const active = createCall({
        provider: 'COMPANION',
        status: 'ACTIVE',
        companionState: 'ACTIVE',
        sessionId: 'sess-1',
        startedAt: new Date('2026-08-15T00:00:00.000Z'),
        observedActive: false,
      });

      const updateStatus = jest.fn().mockResolvedValue({
        ...active,
        status: 'ACTIVE',
      });

      const { service } = createService({
        calls: { updateStatus },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
          readStatus: jest.fn().mockResolvedValue({
            installed: true,
            version: '1.0.2',
            defaultDialer: true,
            callState: 'ACTIVE',
            sessionId: null,
            lastError: null,
          }),
        },
      });

      (service as unknown as { activeCall: CallRecord }).activeCall = active;
      await service.syncActiveCall();

      expect(updateStatus).toHaveBeenCalledWith(
        active.id,
        expect.objectContaining({
          errorMessage: 'Companion sessionId is missing',
        }),
      );
    });
  });

  describe('hangup (Companion)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('waits for DISCONNECTED and marks disconnectSource=USER', async () => {
      jest.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));

      const active: CallRecord = {
        ...createCall({
          provider: 'COMPANION',
          status: 'ACTIVE',
          companionState: 'ACTIVE',
          sessionId: 'sess-1',
          startedAt: new Date('2026-08-15T00:00:00.000Z'),
          observedActive: true,
          answeredAt: new Date('2026-08-15T00:00:00.000Z'),
        }),
      };

      const updateStatus = jest.fn().mockResolvedValue({
        ...active,
        status: 'DISCONNECTED',
      });

      const { service } = createService({
        calls: { updateStatus },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
          sendCommand: jest.fn().mockResolvedValue(undefined),
          readStatus: jest.fn().mockResolvedValue({
            installed: true,
            version: '1.0.2',
            defaultDialer: true,
            callState: 'DISCONNECTED',
            sessionId: 'sess-1',
            lastError: null,
          }),
        },
      });

      (service as unknown as { activeCall: CallRecord }).activeCall = active;

      jest.setSystemTime(new Date('2026-08-15T00:00:10.000Z'));
      const result = await service.hangup();

      expect(result?.status).toBe('DISCONNECTED');
      expect(updateStatus).toHaveBeenCalledWith(
        active.id,
        expect.objectContaining({
          status: 'DISCONNECTED',
          disconnectSource: 'USER',
        }),
      );
    });

    it('returns null when there is no active call', async () => {
      const { service } = createService({
        calls: {},
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'ready',
            defaultDialer: true,
          }),
        },
      });
      (service as unknown as { activeCall: CallRecord | null }).activeCall = null;
      await expect(service.hangup()).resolves.toBeNull();
    });

    it('throws when Companion is not default dialer', async () => {
      jest.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));

      const active = createCall({
        provider: 'COMPANION',
        status: 'ACTIVE',
        companionState: 'ACTIVE',
        sessionId: 'sess-1',
        startedAt: new Date('2026-08-15T00:00:00.000Z'),
        observedActive: true,
      });

      const { service } = createService({
        calls: { updateStatus: jest.fn() },
        companion: {
          getHealth: jest.fn().mockResolvedValue({
            ...missingCompanionHealth(),
            installed: true,
            companion: 'installed',
            phoneControl: 'permission_required',
            defaultDialer: false,
          }),
          sendCommand: jest.fn(),
        },
      });

      (service as unknown as { activeCall: CallRecord }).activeCall = active;
      await expect(service.hangup()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
