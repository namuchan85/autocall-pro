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
      <h1 className="text-3xl font-bold">Welcome AutoCall Pro</h1>
    </main>
  );
}
