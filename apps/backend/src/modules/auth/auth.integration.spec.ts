import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { validateEnvironment } from '../../config/environment';
import { Role } from '../../generated/prisma/enums';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  type NewRefreshToken,
} from './domain/auth.repository';
import { LOGIN_RATE_LIMITER, type LoginRateLimiter } from './domain/login-rate-limiter';
import type { AuthUserRecord, StoredRefreshToken } from './domain/auth.types';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { hashPassword } from './security/password';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = 'admin@autocall.local';
const PASSWORD = 'ChangeMe123!';

class MemoryAuthRepository implements AuthRepository {
  private readonly tokens = new Map<string, StoredRefreshToken>();

  constructor(private readonly user: AuthUserRecord) {}

  findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(email === this.user.email ? this.user : null);
  }

  findActiveUserById(id: string) {
    if (id !== this.user.id || !this.user.isActive) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      id: this.user.id,
      email: this.user.email,
      name: this.user.name,
      role: this.user.role,
    });
  }

  findRefreshTokenById(id: string): Promise<StoredRefreshToken | null> {
    return Promise.resolve(this.tokens.get(id) ?? null);
  }

  createRefreshToken(token: NewRefreshToken): Promise<void> {
    this.tokens.set(token.id, token);
    return Promise.resolve();
  }

  rotateRefreshToken(previousId: string, token: NewRefreshToken): Promise<boolean> {
    const previous = this.tokens.get(previousId);
    if (!previous || previous.userId !== token.userId) {
      return Promise.resolve(false);
    }
    this.tokens.delete(previousId);
    this.tokens.set(token.id, token);
    return Promise.resolve(true);
  }

  revokeRefreshToken(id: string, userId: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token?.userId === userId) {
      this.tokens.delete(id);
    }
    return Promise.resolve();
  }
}

class MemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly maxAttempts: number) {}

  consume(identity: string) {
    const count = (this.counts.get(identity) ?? 0) + 1;
    this.counts.set(identity, count);
    return Promise.resolve({
      allowed: count <= this.maxAttempts,
      retryAfterSeconds: 60,
    });
  }
}

function cookieHeader(response: request.Response): string[] {
  const raw = response.headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw;
  }
  return typeof raw === 'string' ? [raw] : [];
}

function readAuthBody(body: unknown): { accessToken: string; userEmail: string } {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Unexpected auth response');
  }
  if (!('accessToken' in body) || !('user' in body)) {
    throw new Error('Unexpected auth response');
  }
  const accessToken = body.accessToken;
  const user = body.user;
  if (typeof accessToken !== 'string' || typeof user !== 'object' || user === null) {
    throw new Error('Unexpected auth response');
  }
  if (!('email' in user) || typeof user.email !== 'string') {
    throw new Error('Unexpected auth response');
  }
  return { accessToken, userEmail: user.email };
}

function readErrorMessage(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    return body.message;
  }
  return undefined;
}

describe('Auth HTTP integration', () => {
  let app: INestApplication | undefined;

  async function createApp(maxAttempts: number): Promise<void> {
    const user: AuthUserRecord = {
      id: USER_ID,
      email: EMAIL,
      password: await hashPassword(PASSWORD, 4),
      name: 'Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: 'postgresql://localhost:5432/autocall',
              REDIS_URL: 'redis://localhost:6379',
              JWT_ACCESS_SECRET: 'a'.repeat(32),
              JWT_REFRESH_SECRET: 'b'.repeat(32),
              JWT_ACCESS_TTL_SECONDS: 900,
              JWT_REFRESH_TTL_SECONDS: 604_800,
              COOKIE_SECURE: false,
              FRONTEND_URL: 'http://localhost:3000',
              LOGIN_RATE_LIMIT_MAX: maxAttempts,
              LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
            }),
          ],
          validate: validateEnvironment,
        }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        LoginRateLimitGuard,
        { provide: AUTH_REPOSITORY, useValue: new MemoryAuthRepository(user) },
        { provide: LOGIN_RATE_LIMITER, useValue: new MemoryLoginRateLimiter(maxAttempts) },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }

  function httpServer() {
    if (!app) {
      throw new Error('Test application is not initialized');
    }
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('logs in, rotates refresh tokens, and rejects refresh after logout', async () => {
    await createApp(20);

    const login = await request(httpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const loginBody = readAuthBody(login.body);
    expect(login.status).toBe(200);
    expect(loginBody.userEmail).toBe(EMAIL);
    expect(loginBody.accessToken).toEqual(expect.any(String));
    const firstCookies = cookieHeader(login);
    expect(firstCookies.some((value) => value.startsWith('refresh_token='))).toBe(true);

    const refreshed = await request(httpServer()).post('/auth/refresh').set('Cookie', firstCookies);
    const refreshedBody = readAuthBody(refreshed.body);
    expect(refreshed.status).toBe(200);
    expect(refreshedBody.accessToken).not.toBe(loginBody.accessToken);
    const rotatedCookies = cookieHeader(refreshed);
    expect(rotatedCookies.some((value) => value.startsWith('refresh_token='))).toBe(true);

    const reused = await request(httpServer()).post('/auth/refresh').set('Cookie', firstCookies);
    expect(reused.status).toBe(401);

    const logout = await request(httpServer()).post('/auth/logout').set('Cookie', rotatedCookies);
    expect(logout.status).toBe(200);

    const afterLogout = await request(httpServer())
      .post('/auth/refresh')
      .set('Cookie', rotatedCookies);
    expect(afterLogout.status).toBe(401);
  });

  it('accepts a login password that does not match signup complexity rules', async () => {
    await createApp(20);

    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'short' });

    expect(response.status).toBe(401);
    expect(readErrorMessage(response.body)).not.toEqual(
      expect.stringMatching(/special characters|must contain/i),
    );
  });

  it('returns 429 after the login rate limit is exceeded', async () => {
    await createApp(3);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const failed = await request(httpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: 'WrongPass1!' });
      expect(failed.status).toBe(401);
    }

    const blocked = await request(httpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'WrongPass1!' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('60');
  });
});
