import { isE164PhoneNumber, normalizePhoneNumber } from './phone-number';

describe('isE164PhoneNumber', () => {
  it('accepts international E.164 numbers', () => {
    expect(isE164PhoneNumber('+821012345678')).toBe(true);
    expect(isE164PhoneNumber('+14155552671')).toBe(true);
  });

  it('rejects local or malformed numbers before normalize', () => {
    expect(isE164PhoneNumber('01012345678')).toBe(false);
    expect(isE164PhoneNumber('+0123')).toBe(false);
    expect(isE164PhoneNumber('821012345678')).toBe(false);
  });
});

describe('normalizePhoneNumber', () => {
  it('keeps E.164 numbers', () => {
    expect(normalizePhoneNumber('+821012345678')).toBe('+821012345678');
  });

  it('converts Korean mobile numbers to E.164', () => {
    expect(normalizePhoneNumber('01012345678')).toBe('+821012345678');
    expect(normalizePhoneNumber('010-1234-5678')).toBe('+821012345678');
  });

  it('does not invent a country code for random digits', () => {
    expect(normalizePhoneNumber('12345')).toBe('12345');
  });
});
