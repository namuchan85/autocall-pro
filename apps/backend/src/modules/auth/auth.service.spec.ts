import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthRepository } from './domain/auth.repository';
import { AuthService } from './auth.service';
import * as password from './security/password';
import { hashPassword } from './security/password';

const USER_ID = '00000000-0000-4000-8000-000000000001';

function createRepository(): jest.Mocked<AuthRepository> {
  return {
    createRefreshToken: jest.fn().mockResolvedValue(undefined),
    findActiveUserById: jest.fn(),
    findRefreshTokenById: jest.fn(),
    findUserByEmail: jest.fn(),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    rotateRefreshToken: jest.fn().mockResolvedValue(true),
  };
}

function createService(repository: AuthRepository): AuthService {
  return new AuthService(
    repository,
    new JwtService(),
    new ConfigService({
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_REFRESH_TTL_SECONDS: 604_800,
    }),
  );
}

describe('AuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues access and refresh tokens for valid credentials', async () => {
    const repository = createRepository();
    repository.findUserByEmail.mockResolvedValue({
      id: USER_ID,
      email: 'admin@autocall.local',
      password: await hashPassword('ChangeMe123!', 4),
      name: 'Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
    });

    const result = await createService(repository).login('ADMIN@AUTOCALL.LOCAL', 'ChangeMe123!');

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty('password');
    expect(repository.createRefreshToken.mock.calls).toHaveLength(1);
  });

  it('compares against a dummy hash when the user does not exist', async () => {
    const repository = createRepository();
    repository.findUserByEmail.mockResolvedValue(null);
    const verifySpy = jest.spyOn(password, 'verifyPassword');

    await expect(
      createService(repository).login('unknown@autocall.local', 'WrongPass1!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifySpy).toHaveBeenCalledWith('WrongPass1!', password.DUMMY_PASSWORD_HASH);
  });

  it('rejects invalid credentials without revealing which field failed', async () => {
    const repository = createRepository();
    repository.findUserByEmail.mockResolvedValue(null);

    await expect(
      createService(repository).login('unknown@autocall.local', 'WrongPass1!'),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rotates a valid refresh token', async () => {
    const repository = createRepository();
    const user = {
      id: USER_ID,
      email: 'admin@autocall.local',
      password: await hashPassword('ChangeMe123!', 4),
      name: 'Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
    };
    repository.findUserByEmail.mockResolvedValue(user);
    repository.findActiveUserById.mockResolvedValue(user);
    const service = createService(repository);
    const firstSession = await service.login(user.email, 'ChangeMe123!');
    const firstRecord = repository.createRefreshToken.mock.calls[0]?.[0];
    if (!firstRecord) {
      throw new Error('Expected refresh token to be stored');
    }
    repository.findRefreshTokenById.mockResolvedValue(firstRecord);

    const refreshed = await service.refresh(firstSession.refreshToken);

    expect(refreshed.refreshToken).not.toBe(firstSession.refreshToken);
    expect(repository.rotateRefreshToken.mock.calls).toHaveLength(1);
  });
});
