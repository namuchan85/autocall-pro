import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from '../security/password';

export class SetupAdminDto {
  @ApiProperty({ example: 'your-password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(1024)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  password!: string;

  @ApiProperty({ example: 'your-password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  confirmPassword!: string;
}
