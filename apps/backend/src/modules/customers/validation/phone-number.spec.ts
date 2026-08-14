import { isE164PhoneNumber } from './phone-number';

describe('isE164PhoneNumber', () => {
  it('accepts international E.164 numbers', () => {
    expect(isE164PhoneNumber('+821012345678')).toBe(true);
    expect(isE164PhoneNumber('+14155552671')).toBe(true);
  });

  it('rejects local or malformed numbers', () => {
    expect(isE164PhoneNumber('01012345678')).toBe(false);
    expect(isE164PhoneNumber('+0123')).toBe(false);
    expect(isE164PhoneNumber('821012345678')).toBe(false);
  });
});
