import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CallRepository } from '../domain/call.repository';
import type {
  CallHistoryItem,
  CallRecord,
  CallStatusPatch,
  NewCall,
} from '../domain/telephony.types';

@Injectable()
export class PrismaCallRepository implements CallRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewCall): Promise<CallRecord> {
    return toRecord(
      await this.prisma.call.create({
        data: {
          customerId: input.customerId,
          phoneNumber: input.phoneNumber,
          status: input.status,
          provider: input.provider,
          deviceId: input.deviceId,
          errorMessage: input.errorMessage ?? null,
        },
      }),
    );
  }

  async updateStatus(id: string, patch: CallStatusPatch): Promise<CallRecord | null> {
    const existing = await this.prisma.call.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return toRecord(
      await this.prisma.call.update({
        where: { id },
        data: {
          status: patch.status,
          errorMessage: patch.errorMessage ?? null,
        },
      }),
    );
  }

  async listRecent(limit: number): Promise<CallHistoryItem[]> {
    const rows = await this.prisma.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { customer: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...toRecord(row),
      customerName: row.customer.name,
    }));
  }
}

function toRecord(call: {
  id: string;
  customerId: string;
  phoneNumber: string;
  status: CallRecord['status'];
  provider: CallRecord['provider'];
  deviceId: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CallRecord {
  return call;
}
