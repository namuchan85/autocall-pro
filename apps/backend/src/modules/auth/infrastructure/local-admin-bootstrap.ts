import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { hashPassword } from '../security/password';

const LOCAL_ADMIN_EMAIL = 'admin@autocall.local';

@Injectable()
export class LocalAdminBootstrap implements OnModuleInit {
  private readonly logger = new Logger(LocalAdminBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const password = process.env.SEED_ADMIN_PASSWORD?.trim();
    if (!password) {
      return;
    }

    const existing = await this.prisma.user.findUnique({ where: { email: LOCAL_ADMIN_EMAIL } });
    if (existing) {
      return;
    }

    await this.prisma.user.create({
      data: {
        email: LOCAL_ADMIN_EMAIL,
        password: await hashPassword(password),
        name: 'AutoCall Administrator',
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
    this.logger.log('Created the local administrator account');
  }
}
