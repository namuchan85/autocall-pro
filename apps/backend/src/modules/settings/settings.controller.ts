import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ImportLiteDataDto } from './dto/import-lite-data.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

class SettingsResponseDto {
  adbPath!: string;
  adbDeviceId!: string;
}

class ImportResultDto {
  customersImported!: number;
  callsImported!: number;
}

@ApiTags('settings')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Invalid or expired access token' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: SettingsResponseDto })
  getSettings(): SettingsResponseDto {
    return this.settings.snapshot();
  }

  @Put()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOkResponse({ type: SettingsResponseDto })
  async updateSettings(@Body() input: UpdateSettingsDto): Promise<SettingsResponseDto> {
    await this.settings.save(input);
    return this.settings.snapshot();
  }

  @Get('export')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  exportData(): Promise<{ customers: unknown[]; calls: unknown[] }> {
    return this.settings.exportData();
  }

  @Post('import')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOkResponse({ type: ImportResultDto })
  importData(@Body() payload: ImportLiteDataDto): Promise<ImportResultDto> {
    return this.settings.importData(payload);
  }
}
