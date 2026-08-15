import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestConfigModule } from '../../config/create-test-config-module';
import { TEST_ENVIRONMENT } from '../../config/test-environment';
import { Role } from '../../generated/prisma/enums';
import { AUTH_REPOSITORY, type AuthRepository } from '../auth/domain/auth.repository';
import type { AuthenticatedUser } from '../auth/domain/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/guards/jwt.strategy';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersService } from '../customers/customers.service';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '../customers/domain/customer.repository';
import type {
  CustomerListQuery,
  CustomerPatch,
  CustomerRecord,
  NewCustomer,
} from '../customers/domain/customer.types';
import { ADB_GATEWAY, type AdbGateway } from './domain/adb.gateway';
import { CALL_REPOSITORY, type CallRepository } from './domain/call.repository';
import type { CallRecord, CallStatusPatch, NewCall } from './domain/telephony.types';
import { TelephonyController } from './telephony.controller';
import { TelephonyService } from './telephony.service';

const ADMIN: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@autocall.local',
  name: 'Administrator',
  role: Role.SUPER_ADMIN,
};

const DEVICE_ID = 'TESTDEVICE01';

class MemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly records: CustomerRecord[]) {}

  create(input: NewCustomer): Promise<CustomerRecord> {
    const now = new Date();
    const record: CustomerRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      customerCode: input.customerCode ?? 'CUST-UNSPECIFIED',
      name: input.name,
      phoneNumber: input.phoneNumber,
      company: input.company ?? null,
      memo: input.memo ?? null,
      status: input.status ?? 'ACTIVE',
      doNotCall: input.doNotCall ?? false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    return Promise.resolve(record);
  }

  findById(id: string): Promise<CustomerRecord | null> {
    return Promise.resolve(this.records.find((item) => item.id === id && !item.deletedAt) ?? null);
  }

  list(query: CustomerListQuery) {
    void query;
    return Promise.resolve({
      items: this.records.filter((item) => !item.deletedAt),
      total: this.records.length,
    });
  }

  update(id: string, patch: CustomerPatch): Promise<CustomerRecord | null> {
    void id;
    void patch;
    return Promise.resolve(null);
  }

  softDelete(id: string): Promise<boolean> {
    void id;
    return Promise.resolve(false);
  }
}

class MemoryCallRepository implements CallRepository {
  readonly records: CallRecord[] = [];

  create(input: NewCall): Promise<CallRecord> {
    const now = new Date();
    const record: CallRecord = {
      id: `22222222-2222-4222-8222-${String(this.records.length + 1).padStart(12, '0')}`,
      customerId: input.customerId,
      phoneNumber: input.phoneNumber,
      status: input.status,
      provider: input.provider,
      deviceId: input.deviceId,
      errorMessage: input.errorMessage ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    return Promise.resolve(record);
  }

  updateStatus(id: string, patch: CallStatusPatch): Promise<CallRecord | null> {
    const current = this.records.find((item) => item.id === id);
    if (!current) {
      return Promise.resolve(null);
    }
    current.status = patch.status;
    current.errorMessage = patch.errorMessage ?? null;
    current.updatedAt = new Date();
    return Promise.resolve(current);
  }
}

function sampleCustomer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  const now = new Date('2026-08-15T00:00:00.000Z');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    customerCode: 'CUST-001',
    name: 'Hong Gildong',
    phoneNumber: '+821012345678',
    company: null,
    memo: null,
    status: 'ACTIVE',
    doNotCall: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Telephony HTTP integration', () => {
  let app: INestApplication | undefined;
  let jwt: JwtService;
  let calls: MemoryCallRepository;
  let startCall: jest.Mock;
  let listDevices: jest.Mock;

  async function createApp(
    customers: CustomerRecord[],
    configOverrides: Record<string, unknown> = {},
  ): Promise<void> {
    calls = new MemoryCallRepository();
    listDevices = jest.fn().mockResolvedValue([{ id: DEVICE_ID, state: 'device' }]);
    startCall = jest.fn().mockResolvedValue(undefined);
    const adb: AdbGateway = { listDevices, startCall };
    const users = new Map<string, AuthenticatedUser>([[ADMIN.id, ADMIN]]);
    const authRepository: Pick<AuthRepository, 'findActiveUserById'> = {
      findActiveUserById: (id) => Promise.resolve(users.get(id) ?? null),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        createTestConfigModule(configOverrides),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [TelephonyController],
      providers: [
        TelephonyService,
        CustomersService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: AUTH_REPOSITORY, useValue: authRepository },
        { provide: CUSTOMER_REPOSITORY, useValue: new MemoryCustomerRepository(customers) },
        { provide: CALL_REPOSITORY, useValue: calls },
        { provide: ADB_GATEWAY, useValue: adb },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    jwt = moduleRef.get(JwtService);
  }

  function httpServer() {
    if (!app) {
      throw new Error('Test application is not initialized');
    }
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  async function bearer(): Promise<string> {
    const token = await jwt.signAsync(
      { sub: ADMIN.id, email: ADMIN.email, role: ADMIN.role, type: 'access' },
      { secret: TEST_ENVIRONMENT.JWT_ACCESS_SECRET, expiresIn: 900 },
    );
    return `Bearer ${token}`;
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns the connected ADB device', async () => {
    await createApp([sampleCustomer()]);
    const response = await request(httpServer())
      .get('/telephony/device')
      .set('Authorization', await bearer());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ connected: true, deviceId: DEVICE_ID });
  });

  it('returns an error when no ADB device is attached', async () => {
    await createApp([sampleCustomer()]);
    listDevices.mockResolvedValue([]);
    const response = await request(httpServer())
      .get('/telephony/device')
      .set('Authorization', await bearer());
    expect(response.status).toBe(503);
  });

  it('returns 503 when ADB_PATH is not configured', async () => {
    await createApp([sampleCustomer()], { ADB_PATH: '' });
    const response = await request(httpServer())
      .get('/telephony/device')
      .set('Authorization', await bearer());
    expect(response.status).toBe(503);
    expect(readMessage(response.body)).toBe('ADB executable is not configured');
    expect(listDevices).not.toHaveBeenCalled();
  });

  it('returns 503 when ADB_DEVICE_ID is not configured', async () => {
    await createApp([sampleCustomer()], { ADB_DEVICE_ID: '' });
    const response = await request(httpServer())
      .get('/telephony/device')
      .set('Authorization', await bearer());
    expect(response.status).toBe(503);
    expect(readMessage(response.body)).toBe('ADB device is not configured');
    expect(listDevices).not.toHaveBeenCalled();
  });

  it('returns 503 when Galaxy USB debugging is unauthorized', async () => {
    await createApp([sampleCustomer()]);
    listDevices.mockResolvedValue([{ id: DEVICE_ID, state: 'unauthorized' }]);
    const response = await request(httpServer())
      .get('/telephony/device')
      .set('Authorization', await bearer());
    expect(response.status).toBe(503);
    expect(readMessage(response.body)).toBe('Galaxy USB debugging is unauthorized');
  });

  it('returns 503 when Galaxy is offline', async () => {
    await createApp([sampleCustomer()]);
    listDevices.mockResolvedValue([{ id: DEVICE_ID, state: 'offline' }]);
    const response = await request(httpServer())
      .get('/telephony/device')
      .set('Authorization', await bearer());
    expect(response.status).toBe(503);
    expect(readMessage(response.body)).toBe('Galaxy is offline');
  });

  it('places a call after loading a customer and records STARTED', async () => {
    await createApp([sampleCustomer()]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(201);
    expect(readStatus(response.body)).toBe('STARTED');
    expect(startCall).toHaveBeenCalledWith(DEVICE_ID, '+821012345678');
    expect(calls.records.map((item) => item.status)).toEqual(['STARTED']);
  });

  it('returns 404 when the customer is missing', async () => {
    await createApp([]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(404);
    expect(calls.records).toHaveLength(0);
  });

  it('rejects an invalid phone number and records FAILED', async () => {
    await createApp([sampleCustomer({ phoneNumber: '01012345678' })]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(400);
    expect(calls.records).toHaveLength(1);
    expect(calls.records[0]?.status).toBe('FAILED');
    expect(startCall).not.toHaveBeenCalled();
  });

  it('records FAILED when ADB execution fails', async () => {
    await createApp([sampleCustomer()]);
    startCall.mockRejectedValue(new Error('ADB call command failed'));
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(503);
    expect(calls.records.map((item) => item.status)).toEqual(['FAILED']);
  });

  it('places a call for an ACTIVE customer who is not do-not-call', async () => {
    await createApp([sampleCustomer({ status: 'ACTIVE', doNotCall: false })]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(201);
    expect(startCall).toHaveBeenCalledWith(DEVICE_ID, '+821012345678');
    expect(calls.records.map((item) => item.status)).toEqual(['STARTED']);
  });

  it('rejects a do-not-call customer without ADB or a Call record', async () => {
    await createApp([sampleCustomer({ doNotCall: true })]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(403);
    expect(startCall).not.toHaveBeenCalled();
    expect(calls.records).toHaveLength(0);
  });

  it('rejects an INACTIVE customer without ADB or a Call record', async () => {
    await createApp([sampleCustomer({ status: 'INACTIVE' })]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(403);
    expect(startCall).not.toHaveBeenCalled();
    expect(calls.records).toHaveLength(0);
  });

  it('rejects a BLOCKED customer without ADB or a Call record', async () => {
    await createApp([sampleCustomer({ status: 'BLOCKED' })]);
    const response = await request(httpServer())
      .post('/telephony/call')
      .set('Authorization', await bearer())
      .send({ customerId: sampleCustomer().id });
    expect(response.status).toBe(403);
    expect(startCall).not.toHaveBeenCalled();
    expect(calls.records).toHaveLength(0);
  });
});

function readMessage(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }
  throw new Error('Unexpected error response');
}

function readStatus(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    typeof body.status === 'string'
  ) {
    return body.status;
  }
  throw new Error('Unexpected call response');
}
