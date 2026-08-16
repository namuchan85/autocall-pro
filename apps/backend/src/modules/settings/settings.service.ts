import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { FileAdbSettings } from './infrastructure/file-adb-settings';
import { importLiteData, ImportValidationError, type ImportLiteResult } from './import-lite-data';

@Injectable()
export class SettingsService {
  constructor(
    private readonly settings: FileAdbSettings,
    private readonly prisma: PrismaService,
  ) {}

  snapshot() {
    return this.settings.snapshot();
  }

  save(input: UpdateSettingsDto) {
    return this.settings.save(input);
  }

  async exportData(): Promise<{ customers: unknown[]; calls: unknown[] }> {
    const [customers, calls] = await Promise.all([
      this.prisma.customer.findMany({ where: { deletedAt: null } }),
      this.prisma.call.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return { customers, calls };
  }

  async importData(payload: unknown): Promise<ImportLiteResult> {
    try {
      return await importLiteData(this.prisma, payload);
    } catch (error) {
      if (error instanceof ImportValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
