import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CUSTOMER_OUTCOMES,
  CUSTOMER_STATUSES,
  type CustomerOutcome,
  type CustomerRecord,
  type CustomerStatus,
} from '../domain/customer.types';
import { customerDisplayBadge } from '../validation/customer-display';

export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CUST-001' })
  customerCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '+821012345678' })
  phoneNumber!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  company!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  memo!: string | null;

  @ApiProperty({ enum: CUSTOMER_STATUSES })
  status!: CustomerStatus;

  @ApiProperty()
  doNotCall!: boolean;

  @ApiPropertyOptional({ enum: CUSTOMER_OUTCOMES, nullable: true, type: String })
  lastOutcome!: CustomerOutcome | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  latestCallStatus!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  latestCallProvider!: string | null;

  @ApiProperty()
  latestObservedActive!: boolean;

  @ApiProperty({ enum: ['gray', 'yellow', 'blue', 'red', 'green', 'orange'] })
  displayColor!: string;

  @ApiProperty()
  displayBadge!: string;

  @ApiProperty()
  displayLabel!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  deletedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static fromRecord(record: CustomerRecord): CustomerResponseDto {
    const display = customerDisplayBadge({
      doNotCall: record.doNotCall,
      lastOutcome: record.lastOutcome,
      latestCallStatus: record.latestCall?.status ?? null,
      latestObservedActive: record.latestCall?.observedActive ?? false,
    });
    return {
      id: record.id,
      customerCode: record.customerCode,
      name: record.name,
      phoneNumber: record.phoneNumber,
      company: record.company,
      memo: record.memo,
      status: record.status,
      doNotCall: record.doNotCall,
      lastOutcome: record.lastOutcome,
      latestCallStatus: record.latestCall?.status ?? null,
      latestCallProvider: record.latestCall?.provider ?? null,
      latestObservedActive: record.latestCall?.observedActive ?? false,
      displayColor: display.color,
      displayBadge: display.badge,
      displayLabel: display.label,
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

export class CustomerListResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  items!: CustomerResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
