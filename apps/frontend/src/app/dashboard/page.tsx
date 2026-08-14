'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-client';

export default function DashboardPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(() => setIsReady(true))
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="max-w-xl space-y-3">
        <h1 className="text-3xl font-bold">AutoCall Lite</h1>
        <p className="text-slate-400">
          개인용 오토콜입니다. 지금은 로그인과 고객(전화번호) API만 동작하며, 실제 발신은 다음
          단계에서 연결합니다.
        </p>
      </section>
    </main>
  );
}
