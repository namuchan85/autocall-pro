import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CALL_PROVIDERS,
  CALL_STATUSES,
  type CallProvider,
  type CallRecord,
  type CallStatus,
} from '../domain/telephony.types';

export class TelephonyDeviceResponseDto {
  @ApiProperty({ example: true })
  connected!: true;

  @ApiProperty({ example: 'R3CR20HLMCV' })
  deviceId!: string;
}

export class CallResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: '+821012345678' })
  phoneNumber!: string;

  @ApiProperty({ enum: CALL_STATUSES })
  status!: CallStatus;

  @ApiProperty({ enum: CALL_PROVIDERS })
  provider!: CallProvider;

  @ApiProperty()
  deviceId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  errorMessage!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static fromRecord(record: CallRecord): CallResponseDto {
    return {
      id: record.id,
      customerId: record.customerId,
      phoneNumber: record.phoneNumber,
      status: record.status,
      provider: record.provider,
      deviceId: record.deviceId,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
