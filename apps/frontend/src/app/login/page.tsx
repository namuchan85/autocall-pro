'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSetupStatus, login, setupAdministrator } from '@/lib/auth-client';

const ADMIN_EMAIL = 'admin@autocall.local';

export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSetupStatus()
      .then((required) => {
        if (!cancelled) {
          setNeedsSetup(required);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('초기 설정 상태를 확인하지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await setupAdministrator(String(form.get('password')), String(form.get('confirmPassword')));
      setNeedsSetup(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '관리자 설정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      router.push('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadingStatus) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <p>AutoCall Lite를 준비하는 중입니다.</p>
      </main>
    );
  }

  if (needsSetup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <form
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl"
          onSubmit={handleSetup}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">Local</p>
          <h1 className="mt-3 text-3xl font-bold">AutoCall Lite 첫 실행</h1>
          <p className="mt-2 text-sm text-slate-400">관리자 설정</p>
          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">이메일</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                name="email"
                type="email"
                value={ADMIN_EMAIL}
                readOnly
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">새 비밀번호</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">비밀번호 확인</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          </div>
          {error ? (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? '설정 중…' : '설정 완료'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl"
        onSubmit={handleLogin}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">Local</p>
        <h1 className="mt-3 text-3xl font-bold">AutoCall Lite</h1>
        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              name="email"
              type="email"
              defaultValue={ADMIN_EMAIL}
              autoComplete="username"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
