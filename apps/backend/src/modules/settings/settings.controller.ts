import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ImportLiteDataDto } from './dto/import-lite-data.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { FileAdbSettings } from './infrastructure/file-adb-settings';

class SettingsResponseDto {
  adbPath!: string;
  adbDeviceId!: string;
}

@ApiTags('settings')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Invalid or expired access token' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: FileAdbSettings,
    private readonly prisma: PrismaService,
  ) {}

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
  async exportData(): Promise<{ customers: unknown[]; calls: unknown[] }> {
    const [customers, calls] = await Promise.all([
      this.prisma.customer.findMany({ where: { deletedAt: null } }),
      this.prisma.call.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return { customers, calls };
  }

  @Post('import')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  async importData(
    @Body() payload: ImportLiteDataDto,
  ): Promise<{ importedCustomers: number; importedCalls: number }> {
    const customers = payload.customers ?? [];
    const calls = payload.calls ?? [];
    for (const customer of customers) {
      if (typeof customer.id !== 'string' || typeof customer.customerCode !== 'string') {
        continue;
      }
      await this.prisma.customer.upsert({
        where: { customerCode: customer.customerCode },
        update: {},
        create: {
          id: customer.id,
          customerCode: customer.customerCode,
          name: typeof customer.name === 'string' ? customer.name : 'Imported',
          phoneNumber:
            typeof customer.phoneNumber === 'string' ? customer.phoneNumber : '+820000000000',
          company: typeof customer.company === 'string' ? customer.company : null,
          memo: typeof customer.memo === 'string' ? customer.memo : null,
          status:
            customer.status === 'INACTIVE' || customer.status === 'BLOCKED'
              ? customer.status
              : 'ACTIVE',
          doNotCall: customer.doNotCall === true,
        },
      });
    }
    for (const call of calls) {
      if (typeof call.id !== 'string' || typeof call.customerId !== 'string') {
        continue;
      }
      await this.prisma.call.upsert({
        where: { id: call.id },
        update: {},
        create: {
          id: call.id,
          customerId: call.customerId,
          phoneNumber: typeof call.phoneNumber === 'string' ? call.phoneNumber : '',
          status: call.status === 'STARTED' || call.status === 'FAILED' ? call.status : 'REQUESTED',
          provider: 'ADB_GALAXY',
          deviceId: typeof call.deviceId === 'string' ? call.deviceId : 'unknown',
          errorMessage: typeof call.errorMessage === 'string' ? call.errorMessage : null,
        },
      });
    }
    return { importedCustomers: customers.length, importedCalls: calls.length };
  }
}
