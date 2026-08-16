import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_NAME } from './domain/auth.constants';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  type NewRefreshToken,
} from './domain/auth.repository';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  AuthUserRecord,
  RefreshTokenPayload,
} from './domain/auth.types';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  hashSecret,
  PASSWORD_PATTERN_MESSAGE,
  verifyPassword,
  verifySecret,
} from './security/password';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async needsSetup(): Promise<boolean> {
    const existing = await this.repository.findUserByEmail(LOCAL_ADMIN_EMAIL);
    return existing === null;
  }

  async setupAdministrator(password: string, confirmPassword: string): Promise<void> {
    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existing = await this.repository.findUserByEmail(LOCAL_ADMIN_EMAIL);
    if (existing) {
      throw new ConflictException('Administrator already exists');
    }

    let passwordHash: string;
    try {
      passwordHash = await hashPassword(password);
    } catch {
      throw new BadRequestException(PASSWORD_PATTERN_MESSAGE);
    }

    await this.repository.createLocalAdmin({
      email: LOCAL_ADMIN_EMAIL,
      passwordHash,
      name: LOCAL_ADMIN_NAME,
    });
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    const passwordHash = user?.password ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, passwordHash);
    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(this.toAuthenticatedUser(user));
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const [storedToken, user] = await Promise.all([
      this.repository.findRefreshTokenById(payload.tokenId),
      this.repository.findActiveUserById(payload.sub),
    ]);

    if (
      !storedToken ||
      !user ||
      storedToken.userId !== payload.sub ||
      storedToken.expiresAt.getTime() <= Date.now() ||
      !(await verifySecret(refreshToken, storedToken.tokenHash))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueSession(user, payload.tokenId);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.repository.revokeRefreshToken(payload.tokenId, payload.sub);
    } catch {
      // Logout remains idempotent and the controller always clears the cookie.
    }
  }

  private async issueSession(
    user: AuthenticatedUser,
    previousTokenId?: string,
  ): Promise<AuthSession> {
    const accessTtl = this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    const refreshTtl = this.config.getOrThrow<number>('JWT_REFRESH_TTL_SECONDS');
    const tokenId = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      type: 'refresh',
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      }),
    ]);
    const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);
    const tokenRecord: NewRefreshToken = {
      id: tokenId,
      userId: user.id,
      tokenHash: await hashSecret(refreshToken),
      expiresAt: refreshExpiresAt,
    };

    if (previousTokenId) {
      const rotated = await this.repository.rotateRefreshToken(previousTokenId, tokenRecord);
      if (!rotated) {
        throw new UnauthorizedException('Refresh token has already been used');
      }
    } else {
      await this.repository.createRefreshToken(tokenRecord);
    }

    return { accessToken, refreshToken, refreshExpiresAt, user };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (
        payload.type !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.tokenId !== 'string'
      ) {
        throw new Error('Unexpected refresh token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
