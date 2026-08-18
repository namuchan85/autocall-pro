import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CUSTOMER_OUTCOMES, type CustomerOutcome } from '../domain/customer.types';

export class RecordCustomerOutcomeDto {
  @ApiProperty({ enum: CUSTOMER_OUTCOMES })
  @IsIn(CUSTOMER_OUTCOMES)
  outcome!: CustomerOutcome;
}
