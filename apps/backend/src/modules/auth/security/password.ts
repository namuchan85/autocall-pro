import * as bcrypt from 'bcrypt';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;
export const PASSWORD_PATTERN_MESSAGE =
  'password must contain letters, numbers, and special characters';

const DEFAULT_BCRYPT_ROUNDS = 12;

export function assertPasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || !PASSWORD_PATTERN.test(password)) {
    throw new Error(PASSWORD_PATTERN_MESSAGE);
  }
}

export function hashPassword(password: string, rounds = DEFAULT_BCRYPT_ROUNDS): Promise<string> {
  assertPasswordPolicy(password);
  return hashSecret(password, rounds);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return verifySecret(password, hash);
}

export function hashSecret(value: string, rounds = DEFAULT_BCRYPT_ROUNDS): Promise<string> {
  return bcrypt.hash(value, rounds);
}

export function verifySecret(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}
