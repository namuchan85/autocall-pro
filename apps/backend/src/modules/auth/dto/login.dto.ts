import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@autocall.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'your-password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
