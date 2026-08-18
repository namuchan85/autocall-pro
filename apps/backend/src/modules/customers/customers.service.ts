import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerCodeConflictError } from './domain/customer.errors';
import { CUSTOMER_REPOSITORY, type CustomerRepository } from './domain/customer.repository';
import type {
  CustomerListQuery,
  CustomerListResult,
  CustomerOutcome,
  CustomerPatch,
  CustomerRecord,
  NewCustomer,
} from './domain/customer.types';
import { isE164PhoneNumber } from './validation/phone-number';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repository: CustomerRepository,
  ) {}

  async create(input: NewCustomer): Promise<CustomerRecord> {
    try {
      return await this.repository.create({
        ...input,
        customerCode: input.customerCode?.trim() || generateCustomerCode(),
        status: input.status ?? 'ACTIVE',
        doNotCall: input.doNotCall ?? false,
      });
    } catch (error) {
      if (error instanceof CustomerCodeConflictError) {
        throw new ConflictException('Customer code already exists');
      }
      throw error;
    }
  }

  async getById(id: string): Promise<CustomerRecord> {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  list(query: CustomerListQuery): Promise<CustomerListResult> {
    return this.repository.list({
      ...query,
      keyword: query.keyword?.trim() || undefined,
    });
  }

  async update(id: string, patch: CustomerPatch): Promise<CustomerRecord> {
    const normalized: CustomerPatch = {
      ...patch,
      customerCode: patch.customerCode?.trim(),
    };
    try {
      const updated = await this.repository.update(id, normalized);
      if (!updated) {
        throw new NotFoundException('Customer not found');
      }
      return updated;
    } catch (error) {
      if (error instanceof CustomerCodeConflictError) {
        throw new ConflictException('Customer code already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException('Customer not found');
    }
  }

  async recordOutcome(id: string, outcome: CustomerOutcome): Promise<CustomerRecord> {
    return this.update(id, {
      lastOutcome: outcome,
      doNotCall: outcome === 'DO_NOT_CALL' ? true : undefined,
    });
  }

  async listEligibleForAutoCall(): Promise<CustomerRecord[]> {
    const result = await this.repository.list({
      page: 1,
      limit: 500,
      status: 'ACTIVE',
      doNotCall: false,
    });
    return result.items.filter(
      (item) =>
        !item.deletedAt &&
        !item.doNotCall &&
        item.status === 'ACTIVE' &&
        isE164PhoneNumber(item.phoneNumber),
    );
  }
}

function generateCustomerCode(): string {
  return `CUST-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}
