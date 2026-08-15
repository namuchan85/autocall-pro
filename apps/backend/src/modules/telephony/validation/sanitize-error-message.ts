export function sanitizeErrorMessage(raw: string): string {
  return raw.replace(/\+?\d{8,15}/g, '[redacted]').slice(0, 500);
}
