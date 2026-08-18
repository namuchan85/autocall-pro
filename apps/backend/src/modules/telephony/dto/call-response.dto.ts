import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CALL_PROVIDERS,
  CALL_STATUSES,
  DEVICE_CONNECTION_STATUSES,
  type CallHistoryItem,
  type CallProvider,
  type CallRecord,
  type CallStatus,
  type DeviceConnectionStatus,
  type TelephonyDeviceStatus,
} from '../domain/telephony.types';

export class AdbDeviceRowDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  state!: string;
}

export class TelephonyDeviceResponseDto implements TelephonyDeviceStatus {
  @ApiProperty({ enum: DEVICE_CONNECTION_STATUSES })
  status!: DeviceConnectionStatus;

  @ApiProperty()
  connected!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  deviceId!: string | null;

  @ApiProperty({ type: [AdbDeviceRowDto] })
  devices!: AdbDeviceRowDto[];
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

  @ApiPropertyOptional({ nullable: true, type: String })
  sessionId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  companionState!: string | null;

  @ApiProperty()
  observedActive!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  endedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  durationSeconds!: number | null;

  @ApiProperty()
  attempt!: number;

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
      sessionId: record.sessionId,
      companionState: record.companionState,
      observedActive: record.observedActive,
      startedAt: record.startedAt?.toISOString() ?? null,
      endedAt: record.endedAt?.toISOString() ?? null,
      durationSeconds: record.durationSeconds,
      attempt: record.attempt,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

export class CallHistoryResponseDto extends CallResponseDto {
  @ApiProperty()
  customerName!: string;

  static fromHistory(record: CallHistoryItem): CallHistoryResponseDto {
    return {
      ...CallResponseDto.fromRecord(record),
      customerName: record.customerName,
    };
  }
}
