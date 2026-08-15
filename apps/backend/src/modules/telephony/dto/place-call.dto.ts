import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PlaceCallDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;
}
