import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CUSTOMER_STATUSES, type CustomerStatus } from '../domain/customer.types';
import { E164_PHONE_MESSAGE, E164_PHONE_PATTERN } from '../validation/phone-number';
import { trimIfString } from '../validation/trim-string';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'CUST-001' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,64}$/, {
    message: 'customerCode must be 2-64 letters, numbers, underscores, or hyphens',
  })
  customerCode?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimIfString(value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '+821012345678' })
  @IsOptional()
  @IsString()
  @Matches(E164_PHONE_PATTERN, { message: E164_PHONE_MESSAGE })
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  memo?: string | null;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  doNotCall?: boolean;
}
