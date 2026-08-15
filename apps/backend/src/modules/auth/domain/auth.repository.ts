import type { AuthUserRecord, AuthenticatedUser, StoredRefreshToken } from './auth.types';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface NewRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findActiveUserById(id: string): Promise<AuthenticatedUser | null>;
  findRefreshTokenById(id: string): Promise<StoredRefreshToken | null>;
  createRefreshToken(token: NewRefreshToken): Promise<void>;
  rotateRefreshToken(previousId: string, token: NewRefreshToken): Promise<boolean>;
  revokeRefreshToken(id: string, userId: string): Promise<void>;
}
