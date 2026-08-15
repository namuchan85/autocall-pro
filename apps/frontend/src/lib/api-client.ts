const ACCESS_TOKEN_KEY = 'autocall_access_token';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken();
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export function readApiError(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return fallback;
  }
  const message = body.message;
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  if (
    typeof message === 'object' &&
    message !== null &&
    'message' in message &&
    typeof message.message === 'string' &&
    message.message.length > 0
  ) {
    return message.message;
  }
  return fallback;
}
