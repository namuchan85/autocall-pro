const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const ACCESS_TOKEN_KEY = 'autocall_access_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'VIEWER';
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export async function getSetupStatus(): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/setup-status`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('초기 설정 상태를 확인하지 못했습니다.');
  }
  const result = (await response.json()) as { needsSetup?: unknown };
  return result.needsSetup === true;
}

export async function setupAdministrator(password: string, confirmPassword: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/setup`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, confirmPassword }),
  });
  if (response.status === 409) {
    throw new Error('관리자 계정이 이미 있습니다. 로그인하세요.');
  }
  if (!response.ok) {
    throw new Error(
      '비밀번호 정책을 확인해주세요. 영문, 숫자, 특수문자를 포함해 10자 이상이어야 합니다.',
    );
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error('이메일 또는 비밀번호를 확인해주세요.');
  }

  const result = (await response.json()) as AuthResponse;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
  return result.user;
}

export async function getCurrentUser(): Promise<AuthUser> {
  let accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.ok) {
    return (await response.json()) as AuthUser;
  }

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  const retriedToken = await refreshAccessToken();
  const retried = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${retriedToken}` },
  });
  if (!retried.ok) {
    throw new Error('Authentication required');
  }

  return (await retried.json()) as AuthUser;
}

async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Authentication required');
  }

  const result = (await response.json()) as AuthResponse;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
  return result.accessToken;
}
