import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/enums';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@autocall.local' })
  email!: string;

  @ApiProperty({ example: 'AutoCall Administrator' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.SUPER_ADMIN })
  role!: Role;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
