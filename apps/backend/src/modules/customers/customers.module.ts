import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CUSTOMER_REPOSITORY } from './domain/customer.repository';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    PrismaCustomerRepository,
    {
      provide: CUSTOMER_REPOSITORY,
      useExisting: PrismaCustomerRepository,
    },
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
