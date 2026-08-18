import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class StartAutoCallDto {
  @ApiPropertyOptional({ default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3000)
  @Max(120000)
  waitBetweenCallsMs?: number;

  @ApiPropertyOptional({ default: 30000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10000)
  @Max(120000)
  ringTimeoutMs?: number;

  @ApiPropertyOptional({ default: 60000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5000)
  @Max(300000)
  maxCallDurationMs?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  retryOnFailure?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  maxRetries?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hangupOnStop?: boolean;
}

export class StopAutoCallDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hangupCurrent?: boolean;
}

export class AutoCallSnapshotDto {
  @ApiProperty()
  phase!: string;

  @ApiProperty()
  running!: boolean;

  @ApiProperty()
  paused!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  currentCustomerId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currentCallId!: string | null;

  @ApiProperty()
  attempt!: number;

  @ApiProperty()
  remaining!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastError!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  message!: string | null;
}
