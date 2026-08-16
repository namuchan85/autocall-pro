import { ApiProperty } from '@nestjs/swagger';

export class SetupStatusDto {
  @ApiProperty()
  needsSetup!: boolean;
}
