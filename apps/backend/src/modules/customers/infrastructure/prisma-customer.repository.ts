import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CustomerCodeConflictError } from '../domain/customer.errors';
import type { CustomerRepository } from '../domain/customer.repository';
import type {
  CustomerListQuery,
  CustomerListResult,
  CustomerPatch,
  CustomerRecord,
  NewCustomer,
} from '../domain/customer.types';

const ACTIVE = { deletedAt: null } as const;

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
        }),
      );
    } catch (error) {
      throw uniqueConflictOr(error);
    }
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, ...ACTIVE },
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
              { customerCode: { contains: query.keyword, mode: 'insensitive' } },
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { phoneNumber: { contains: query.keyword, mode: 'insensitive' } },
              { company: { contains: query.keyword, mode: 'insensitive' } },
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
          },
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

function toRecord(customer: {
  id: string;
  customerCode: string;
  name: string;
  phoneNumber: string;
  company: string | null;
  memo: string | null;
  status: CustomerRecord['status'];
  doNotCall: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerRecord {
  return customer;
}
