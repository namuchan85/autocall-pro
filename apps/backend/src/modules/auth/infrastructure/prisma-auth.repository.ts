import { Injectable } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { AuthRepository, NewLocalAdmin, NewRefreshToken } from '../domain/auth.repository';
import type { AuthUserRecord, AuthenticatedUser, StoredRefreshToken } from '../domain/auth.types';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        ...USER_SELECT,
        password: true,
        isActive: true,
      },
    });
  }

  findActiveUserById(id: string): Promise<AuthenticatedUser | null> {
    return this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: USER_SELECT,
    });
  }

  async createLocalAdmin(input: NewLocalAdmin): Promise<void> {
    await this.prisma.user.create({
      data: {
        email: input.email,
        password: input.passwordHash,
        name: input.name,
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
  }

  findRefreshTokenById(id: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
      },
    });
  }

  async createRefreshToken(token: NewRefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({ data: token });
  }

  async rotateRefreshToken(previousId: string, token: NewRefreshToken): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const deleted = await transaction.refreshToken.deleteMany({
        where: { id: previousId, userId: token.userId },
      });
      if (deleted.count !== 1) {
        return false;
      }

      await transaction.refreshToken.create({ data: token });
      return true;
    });
  }

  async revokeRefreshToken(id: string, userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { id, userId },
    });
  }
}
