import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ADB_RUNTIME_SETTINGS } from './domain/adb-runtime-settings';
import { FileAdbSettings } from './infrastructure/file-adb-settings';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    FileAdbSettings,
    {
      provide: ADB_RUNTIME_SETTINGS,
      useExisting: FileAdbSettings,
    },
  ],
  exports: [FileAdbSettings, ADB_RUNTIME_SETTINGS],
})
export class SettingsModule {}
