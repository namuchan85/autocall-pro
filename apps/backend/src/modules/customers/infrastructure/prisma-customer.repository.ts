import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CustomerCodeConflictError } from '../domain/customer.errors';
import type { CustomerRepository } from '../domain/customer.repository';
import {
  CUSTOMER_OUTCOMES,
  type CustomerListQuery,
  type CustomerListResult,
  type CustomerOutcome,
  type CustomerPatch,
  type CustomerRecord,
  type LatestCallSummary,
  type NewCustomer,
} from '../domain/customer.types';

const ACTIVE = { deletedAt: null } as const;

const LATEST_CALL = {
  calls: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      status: true,
      provider: true,
      observedActive: true,
    },
  },
};

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewCustomer): Promise<CustomerRecord> {
    try {
      return toRecord(
        await this.prisma.customer.create({
          data: {
            customerCode: requiredCustomerCode(input.customerCode),
            name: input.name,
            phoneNumber: input.phoneNumber,
            company: input.company,
            memo: input.memo,
            status: input.status ?? 'ACTIVE',
            doNotCall: input.doNotCall ?? false,
          },
          include: LATEST_CALL,
        }),
      );
    } catch (error) {
      throw uniqueConflictOr(error);
    }
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, ...ACTIVE },
      include: LATEST_CALL,
    });
    return customer ? toRecord(customer) : null;
  }

  async list(query: CustomerListQuery): Promise<CustomerListResult> {
    const where: Prisma.CustomerWhereInput = {
      ...ACTIVE,
      ...(query.status ? { status: query.status } : {}),
      ...(query.doNotCall === undefined ? {} : { doNotCall: query.doNotCall }),
      ...(query.keyword
        ? {
            OR: [
              { customerCode: { contains: query.keyword } },
              { name: { contains: query.keyword } },
              { phoneNumber: { contains: query.keyword } },
              { company: { contains: query.keyword } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        include: LATEST_CALL,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }

  async update(id: string, patch: CustomerPatch): Promise<CustomerRecord | null> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, ...ACTIVE },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }

    try {
      return toRecord(
        await this.prisma.customer.update({
          where: { id },
          data: {
            customerCode: patch.customerCode,
            name: patch.name,
            phoneNumber: patch.phoneNumber,
            company: patch.company,
            memo: patch.memo,
            status: patch.status,
            doNotCall: patch.doNotCall,
            lastOutcome: patch.lastOutcome,
          },
          include: LATEST_CALL,
        }),
      );
    } catch (error) {
      throw uniqueConflictOr(error);
    }
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.prisma.customer.updateMany({
      where: { id, ...ACTIVE },
      data: { deletedAt: new Date() },
    });
    return result.count === 1;
  }
}

function requiredCustomerCode(value: string | undefined): string {
  if (!value) {
    throw new Error('customerCode is required');
  }
  return value;
}

function uniqueConflictOr(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new CustomerCodeConflictError();
  }
  return error instanceof Error ? error : new Error('Unexpected customer persistence error');
}

function parseOutcome(value: string | null): CustomerOutcome | null {
  if (value && CUSTOMER_OUTCOMES.includes(value as CustomerOutcome)) {
    return value as CustomerOutcome;
  }
  return null;
}

function toRecord(customer: {
  id: string;
  customerCode: string;
  name: string;
  phoneNumber: string;
  company: string | null;
  memo: string | null;
  status: CustomerRecord['status'];
  doNotCall: boolean;
  lastOutcome: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  calls?: Array<{ status: string; provider: string; observedActive: boolean }>;
}): CustomerRecord {
  const latest = customer.calls?.[0];
  const latestCall: LatestCallSummary | null = latest
    ? {
        status: latest.status,
        provider: latest.provider,
        observedActive: latest.observedActive,
      }
    : null;
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    name: customer.name,
    phoneNumber: customer.phoneNumber,
    company: customer.company,
    memo: customer.memo,
    status: customer.status,
    doNotCall: customer.doNotCall,
    lastOutcome: parseOutcome(customer.lastOutcome),
    latestCall,
    deletedAt: customer.deletedAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
