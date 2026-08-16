import { ConfigService } from '@nestjs/config';
import { Role } from '../../../generated/prisma/enums';
import type { AuthRepository } from '../domain/auth.repository';
import { JwtStrategy } from './jwt.strategy';

function createRepository(): jest.Mocked<AuthRepository> {
  return {
    createLocalAdmin: jest.fn(),
    createRefreshToken: jest.fn(),
    findActiveUserById: jest.fn(),
    findRefreshTokenById: jest.fn(),
    findUserByEmail: jest.fn(),
    revokeRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn().mockResolvedValue(true),
  };
}

describe('JwtStrategy', () => {
  it('authenticates an active user from a valid access payload', async () => {
    const repository = createRepository();
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@autocall.local',
      name: 'Administrator',
      role: Role.SUPER_ADMIN,
    };
    repository.findActiveUserById.mockResolvedValue(user);
    const strategy = new JwtStrategy(
      new ConfigService({ JWT_ACCESS_SECRET: 'a'.repeat(32) }),
      repository,
    );

    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      }),
    ).resolves.toEqual(user);
  });
});
