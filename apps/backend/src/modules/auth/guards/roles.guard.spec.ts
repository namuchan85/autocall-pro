import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/enums';
import { RolesGuard } from './roles.guard';

function createContext(role: Role): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows users whose role is explicitly required', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(new RolesGuard(reflector).canActivate(createContext(Role.ADMIN))).toBe(true);
  });

  it('denies users whose role is not permitted', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(new RolesGuard(reflector).canActivate(createContext(Role.VIEWER))).toBe(false);
  });
});
