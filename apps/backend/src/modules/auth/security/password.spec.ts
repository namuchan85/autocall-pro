import { assertPasswordPolicy, hashPassword, verifyPassword } from './password';

describe('password security', () => {
  it('hashes passwords and verifies the matching plain text', async () => {
    const hash = await hashPassword('ChangeMe123!', 4);

    expect(hash).not.toContain('ChangeMe123!');
    await expect(verifyPassword('ChangeMe123!', hash)).resolves.toBe(true);
    await expect(verifyPassword('WrongPass1!', hash)).resolves.toBe(false);
  });

  it('rejects passwords without the required character groups', () => {
    expect(() => assertPasswordPolicy('onlyletters')).toThrow();
  });
});
