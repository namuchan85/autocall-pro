export const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
export const E164_PHONE_MESSAGE = 'phoneNumber must be an E.164 number such as +821012345678';

export function isE164PhoneNumber(value: string): boolean {
  return E164_PHONE_PATTERN.test(value);
}
