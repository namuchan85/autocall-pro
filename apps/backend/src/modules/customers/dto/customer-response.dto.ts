import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CUSTOMER_STATUSES,
  type CustomerRecord,
  type CustomerStatus,
} from '../domain/customer.types';

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

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  deletedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static fromRecord(record: CustomerRecord): CustomerResponseDto {
    return {
      id: record.id,
      customerCode: record.customerCode,
      name: record.name,
      phoneNumber: record.phoneNumber,
      company: record.company,
      memo: record.memo,
      status: record.status,
      doNotCall: record.doNotCall,
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
