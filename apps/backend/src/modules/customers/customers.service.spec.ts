import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerCodeConflictError } from './domain/customer.errors';
import type { CustomerRepository } from './domain/customer.repository';
import type {
  CustomerListQuery,
  CustomerListResult,
  CustomerPatch,
  CustomerRecord,
} from './domain/customer.types';
import { CustomersService } from './customers.service';

function createRecord(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  const now = new Date('2026-08-14T00:00:00.000Z');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    customerCode: 'CUST-001',
    name: 'Hong Gildong',
    phoneNumber: '+821012345678',
    company: 'AutoCall Co.',
    memo: null,
    status: 'ACTIVE',
    doNotCall: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRepository(
  overrides: Partial<jest.Mocked<CustomerRepository>> = {},
): jest.Mocked<CustomerRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    ...overrides,
  };
}

describe('CustomersService', () => {
  it('creates a customer', async () => {
    const record = createRecord();
    const create = jest.fn().mockResolvedValue(record);
    const repository = createRepository({ create });

    await expect(
      new CustomersService(repository).create({
        customerCode: ' CUST-001 ',
        name: 'Hong Gildong',
        phoneNumber: '+821012345678',
      }),
    ).resolves.toEqual(record);
    expect(create).toHaveBeenCalledWith({
      customerCode: 'CUST-001',
      name: 'Hong Gildong',
      phoneNumber: '+821012345678',
      status: 'ACTIVE',
      doNotCall: false,
    });
  });

  it('generates a customer code when it is omitted', async () => {
    const record = createRecord();
    let savedCode = '';
    const create = jest.fn().mockImplementation((input: { customerCode: string }) => {
      savedCode = input.customerCode;
      return Promise.resolve(record);
    });
    const repository = createRepository({ create });

    await new CustomersService(repository).create({
      name: 'Hong Gildong',
      phoneNumber: '+821012345678',
    });
    expect(create).toHaveBeenCalledWith({
      name: 'Hong Gildong',
      phoneNumber: '+821012345678',
      status: 'ACTIVE',
      doNotCall: false,
      customerCode: savedCode,
    });
    expect(savedCode).toMatch(/^CUST-[A-Z0-9]{12}$/);
  });

  it('rejects a duplicated customer code', async () => {
    const repository = createRepository({
      create: jest.fn().mockRejectedValue(new CustomerCodeConflictError()),
    });

    await expect(
      new CustomersService(repository).create({
        customerCode: 'CUST-001',
        name: 'Hong Gildong',
        phoneNumber: '+821012345678',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for missing customers', async () => {
    const repository = createRepository({ findById: jest.fn().mockResolvedValue(null) });

    await expect(
      new CustomersService(repository).getById('11111111-1111-4111-8111-111111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists customers with a trimmed keyword', async () => {
    const result: CustomerListResult = { items: [createRecord()], total: 1 };
    const list = jest.fn().mockResolvedValue(result);
    const repository = createRepository({ list });
    const query: CustomerListQuery = {
      page: 1,
      limit: 20,
      keyword: ' hong ',
      status: 'ACTIVE',
      doNotCall: false,
    };

    await expect(new CustomersService(repository).list(query)).resolves.toEqual(result);
    expect(list).toHaveBeenCalledWith({ ...query, keyword: 'hong' });
  });

  it('soft deletes a customer', async () => {
    const repository = createRepository({ softDelete: jest.fn().mockResolvedValue(true) });

    await expect(
      new CustomersService(repository).remove('11111111-1111-4111-8111-111111111111'),
    ).resolves.toBeUndefined();
  });

  it('rejects update when the customer is missing', async () => {
    const repository = createRepository({ update: jest.fn().mockResolvedValue(null) });
    const patch: CustomerPatch = { name: 'Updated' };

    await expect(
      new CustomersService(repository).update('11111111-1111-4111-8111-111111111111', patch),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
