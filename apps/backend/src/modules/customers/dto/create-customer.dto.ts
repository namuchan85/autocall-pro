import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateCustomerDto {
  @ApiProperty({ example: 'CUST-001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{2,64}$/, {
    message: 'customerCode must be 2-64 letters, numbers, underscores, or hyphens',
  })
  customerCode!: string;

  @ApiProperty({ example: 'Hong Gildong' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: '+821012345678' })
  @IsString()
  @Matches(E164_PHONE_PATTERN, { message: E164_PHONE_MESSAGE })
  phoneNumber!: string;

  @ApiPropertyOptional({ example: 'AutoCall Co.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  memo?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_STATUSES, example: 'ACTIVE' })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  doNotCall?: boolean;
}
