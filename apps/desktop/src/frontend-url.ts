export const FRONTEND_ORIGIN = 'http://127.0.0.1:3000';

export function isAllowedFrontendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port === '3000';
  } catch {
    return false;
  }
}
