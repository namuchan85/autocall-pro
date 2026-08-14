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
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerCodeConflictError } from './domain/customer.errors';
import { CUSTOMER_REPOSITORY, type CustomerRepository } from './domain/customer.repository';
import type {
  CustomerListQuery,
  CustomerPatch,
  CustomerRecord,
  NewCustomer,
} from './domain/customer.types';

const ADMIN: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@autocall.local',
  name: 'Administrator',
  role: Role.SUPER_ADMIN,
};

const VIEWER: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'viewer@autocall.local',
  name: 'Viewer',
  role: Role.VIEWER,
};

class MemoryCustomerRepository implements CustomerRepository {
  private readonly records: CustomerRecord[] = [];

  create(input: NewCustomer): Promise<CustomerRecord> {
    if (this.records.some((item) => item.customerCode === input.customerCode)) {
      return Promise.reject(new CustomerCodeConflictError());
    }
    const now = new Date();
    const record: CustomerRecord = {
      id: `11111111-1111-4111-8111-${String(this.records.length + 1).padStart(12, '0')}`,
      customerCode: input.customerCode,
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
    const filtered = this.records.filter((item) => {
      if (item.deletedAt) {
        return false;
      }
      if (query.status && item.status !== query.status) {
        return false;
      }
      if (query.doNotCall !== undefined && item.doNotCall !== query.doNotCall) {
        return false;
      }
      if (query.keyword) {
        const keyword = query.keyword.toLowerCase();
        const haystack = [item.customerCode, item.name, item.phoneNumber, item.company ?? '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }
      return true;
    });
    const start = (query.page - 1) * query.limit;
    return Promise.resolve({
      items: filtered.slice(start, start + query.limit),
      total: filtered.length,
    });
  }

  update(id: string, patch: CustomerPatch): Promise<CustomerRecord | null> {
    const current = this.records.find((item) => item.id === id && !item.deletedAt);
    if (!current) {
      return Promise.resolve(null);
    }
    if (
      patch.customerCode &&
      this.records.some((item) => item.customerCode === patch.customerCode && item.id !== id)
    ) {
      return Promise.reject(new CustomerCodeConflictError());
    }
    Object.assign(current, patch, { updatedAt: new Date() });
    return Promise.resolve(current);
  }

  softDelete(id: string): Promise<boolean> {
    const current = this.records.find((item) => item.id === id && !item.deletedAt);
    if (!current) {
      return Promise.resolve(false);
    }
    current.deletedAt = new Date();
    current.updatedAt = new Date();
    return Promise.resolve(true);
  }
}

function customerBody(overrides: Record<string, unknown> = {}) {
  return {
    customerCode: 'CUST-001',
    name: 'Hong Gildong',
    phoneNumber: '+821012345678',
    company: 'AutoCall Co.',
    ...overrides,
  };
}

describe('Customers HTTP integration', () => {
  let app: INestApplication | undefined;
  let jwt: JwtService;

  async function createApp(): Promise<void> {
    const users = new Map<string, AuthenticatedUser>([
      [ADMIN.id, ADMIN],
      [VIEWER.id, VIEWER],
    ]);
    const authRepository: Pick<AuthRepository, 'findActiveUserById'> = {
      findActiveUserById: (id) => Promise.resolve(users.get(id) ?? null),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        createTestConfigModule(),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [CustomersController],
      providers: [
        CustomersService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: AUTH_REPOSITORY, useValue: authRepository },
        { provide: CUSTOMER_REPOSITORY, useValue: new MemoryCustomerRepository() },
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

  async function bearer(user: AuthenticatedUser): Promise<string> {
    const token = await jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      { secret: TEST_ENVIRONMENT.JWT_ACCESS_SECRET, expiresIn: 900 },
    );
    return `Bearer ${token}`;
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('runs create, read, update, list, and soft delete', async () => {
    await createApp();
    const authorization = await bearer(ADMIN);

    const created = await request(httpServer())
      .post('/customers')
      .set('Authorization', authorization)
      .send(customerBody());
    expect(created.status).toBe(201);
    const id = readId(created.body);

    const fetched = await request(httpServer())
      .get(`/customers/${id}`)
      .set('Authorization', authorization);
    expect(fetched.status).toBe(200);
    expect(readName(fetched.body)).toBe('Hong Gildong');

    const patched = await request(httpServer())
      .patch(`/customers/${id}`)
      .set('Authorization', authorization)
      .send({ name: 'Hong Gil-dong', status: 'INACTIVE' });
    expect(patched.status).toBe(200);
    expect(readName(patched.body)).toBe('Hong Gil-dong');

    const listed = await request(httpServer())
      .get('/customers')
      .set('Authorization', authorization);
    expect(listed.status).toBe(200);
    expect(readTotal(listed.body)).toBe(1);

    const removed = await request(httpServer())
      .delete(`/customers/${id}`)
      .set('Authorization', authorization);
    expect(removed.status).toBe(200);

    const missing = await request(httpServer())
      .get(`/customers/${id}`)
      .set('Authorization', authorization);
    expect(missing.status).toBe(404);

    const afterDelete = await request(httpServer())
      .get('/customers')
      .set('Authorization', authorization);
    expect(readTotal(afterDelete.body)).toBe(0);
  });

  it('paginates customers', async () => {
    await createApp();
    const authorization = await bearer(ADMIN);
    for (const code of ['CUST-001', 'CUST-002', 'CUST-003']) {
      const created = await request(httpServer())
        .post('/customers')
        .set('Authorization', authorization)
        .send(customerBody({ customerCode: code, name: code }));
      expect(created.status).toBe(201);
    }

    const page1 = await request(httpServer())
      .get('/customers?page=1&limit=2')
      .set('Authorization', authorization);
    expect(page1.status).toBe(200);
    expect(readItems(page1.body)).toHaveLength(2);
    expect(readTotal(page1.body)).toBe(3);

    const page2 = await request(httpServer())
      .get('/customers?page=2&limit=2')
      .set('Authorization', authorization);
    expect(readItems(page2.body)).toHaveLength(1);
  });

  it('filters customers by keyword and status', async () => {
    await createApp();
    const authorization = await bearer(ADMIN);
    await request(httpServer())
      .post('/customers')
      .set('Authorization', authorization)
      .send(customerBody({ customerCode: 'CUST-ALPHA', name: 'Alpha Corp' }));
    await request(httpServer())
      .post('/customers')
      .set('Authorization', authorization)
      .send(customerBody({ customerCode: 'CUST-BETA', name: 'Beta LLC', status: 'BLOCKED' }));

    const search = await request(httpServer())
      .get('/customers?keyword=alpha')
      .set('Authorization', authorization);
    expect(readTotal(search.body)).toBe(1);
    expect(readName(readItems(search.body)[0])).toBe('Alpha Corp');

    const blocked = await request(httpServer())
      .get('/customers?status=BLOCKED')
      .set('Authorization', authorization);
    expect(readTotal(blocked.body)).toBe(1);
  });

  it('rejects invalid phone numbers and duplicated codes', async () => {
    await createApp();
    const authorization = await bearer(ADMIN);

    const invalidPhone = await request(httpServer())
      .post('/customers')
      .set('Authorization', authorization)
      .send(customerBody({ phoneNumber: '01012345678' }));
    expect(invalidPhone.status).toBe(400);

    const first = await request(httpServer())
      .post('/customers')
      .set('Authorization', authorization)
      .send(customerBody());
    expect(first.status).toBe(201);

    const duplicate = await request(httpServer())
      .post('/customers')
      .set('Authorization', authorization)
      .send(customerBody({ name: 'Other' }));
    expect(duplicate.status).toBe(409);
  });

  it('requires authentication and blocks viewer writes', async () => {
    await createApp();

    const anonymous = await request(httpServer()).post('/customers').send(customerBody());
    expect(anonymous.status).toBe(401);

    const viewer = await request(httpServer())
      .post('/customers')
      .set('Authorization', await bearer(VIEWER))
      .send(customerBody());
    expect(viewer.status).toBe(403);
  });
});

function readId(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string') {
    return body.id;
  }
  throw new Error('Unexpected customer response');
}

function readName(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'name' in body &&
    typeof body.name === 'string'
  ) {
    return body.name;
  }
  throw new Error('Unexpected customer response');
}

function readTotal(body: unknown): number {
  if (
    typeof body === 'object' &&
    body !== null &&
    'total' in body &&
    typeof body.total === 'number'
  ) {
    return body.total;
  }
  throw new Error('Unexpected customer list response');
}

function readItems(body: unknown): unknown[] {
  if (typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items)) {
    return body.items;
  }
  throw new Error('Unexpected customer list response');
}
