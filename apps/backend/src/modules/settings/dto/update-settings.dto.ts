import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({ example: 'C:\\\\platform-tools\\\\adb.exe' })
  @IsString()
  @MaxLength(1024)
  adbPath!: string;

  @ApiProperty({ example: 'R3CR20HLMCV' })
  @IsString()
  @MaxLength(128)
  @Matches(/^$|^[A-Za-z0-9._:-]+$/)
  adbDeviceId!: string;
}
