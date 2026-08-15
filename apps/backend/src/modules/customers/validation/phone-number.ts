export const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
export const E164_PHONE_MESSAGE = 'phoneNumber must be an E.164 number such as +821012345678';

export function isE164PhoneNumber(value: string): boolean {
  return E164_PHONE_PATTERN.test(value);
}

export function normalizePhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (compact.startsWith('+')) {
    return compact;
  }
  if (/^01[016789]\d{7,8}$/.test(compact)) {
    return `+82${compact.slice(1)}`;
  }
  if (/^82\d{8,13}$/.test(compact)) {
    return `+${compact}`;
  }
  return compact;
}
