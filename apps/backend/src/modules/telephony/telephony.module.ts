import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { AutoDialerService } from './auto-call/auto-dialer.service';
import { COMPANION_BRIDGE } from './companion/companion.bridge';
import { AdbCompanionBridge } from './companion/adb-companion.bridge';
import { ADB_GATEWAY } from './domain/adb.gateway';
import { CALL_REPOSITORY } from './domain/call.repository';
import { AdbProcessGateway } from './infrastructure/adb-process.gateway';
import { PrismaCallRepository } from './infrastructure/prisma-call.repository';
import { TelephonyController } from './telephony.controller';
import { TelephonyService } from './telephony.service';

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [TelephonyController],
  providers: [
    TelephonyService,
    AutoDialerService,
    PrismaCallRepository,
    AdbProcessGateway,
    AdbCompanionBridge,
    {
      provide: CALL_REPOSITORY,
      useExisting: PrismaCallRepository,
    },
    {
      provide: ADB_GATEWAY,
      useExisting: AdbProcessGateway,
    },
    {
      provide: COMPANION_BRIDGE,
      useExisting: AdbCompanionBridge,
    },
  ],
})
export class TelephonyModule {}
