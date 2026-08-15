'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authorizedFetch, readApiError } from '@/lib/api-client';
import { getCurrentUser, type AuthUser } from '@/lib/auth-client';

interface CustomerItem {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  doNotCall: boolean;
}

interface CustomerListResponse {
  items: CustomerItem[];
}

function callDisabledReason(customer: CustomerItem): string | null {
  if (customer.doNotCall) {
    return '수신거부 고객 발신 불가';
  }
  if (customer.status === 'INACTIVE') {
    return '비활성 고객 발신 불가';
  }
  if (customer.status === 'BLOCKED') {
    return '차단 고객 발신 불가';
  }
  if (customer.status !== 'ACTIVE') {
    return '발신 불가';
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [callError, setCallError] = useState('');
  const [callSuccess, setCallSuccess] = useState('');
  const [callingId, setCallingId] = useState<string | null>(null);

  const canCall =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const loadCustomers = useCallback(async () => {
    const response = await authorizedFetch('/customers?limit=100');
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new Error(readApiError(body, '고객 목록을 불러오지 못했습니다.'));
    }
    const result = (await response.json()) as CustomerListResponse;
    setCustomers(result.items);
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then(async (current) => {
        setUser(current);
        try {
          await loadCustomers();
        } catch (caught) {
          setLoadError(
            caught instanceof Error ? caught.message : '고객 목록을 불러오지 못했습니다.',
          );
        }
      })
      .catch(() => router.replace('/login'));
  }, [loadCustomers, router]);

  async function placeCall(customer: CustomerItem): Promise<void> {
    const confirmed = window.confirm(`${customer.name}에게 전화를 걸까요?`);
    if (!confirmed) {
      return;
    }

    setCallError('');
    setCallSuccess('');
    setCallingId(customer.id);
    try {
      const response = await authorizedFetch('/telephony/call', {
        method: 'POST',
        body: JSON.stringify({ customerId: customer.id }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(readApiError(body, '발신 요청에 실패했습니다.'));
      }
      setCallSuccess('Galaxy에서 발신 요청이 시작되었습니다.');
    } catch (caught) {
      setCallError(caught instanceof Error ? caught.message : '발신 요청에 실패했습니다.');
    } finally {
      setCallingId(null);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AutoCall Lite</h1>
          <p className="mt-2 text-slate-400">고객 번호를 선택한 뒤 Galaxy로 전화를 겁니다.</p>
        </div>
        {loadError ? (
          <p className="text-sm text-red-400" role="alert">
            {loadError}
          </p>
        ) : null}
        {callSuccess ? (
          <p className="text-sm text-cyan-300" role="status">
            {callSuccess}
          </p>
        ) : null}
        {callError ? (
          <p className="text-sm text-red-400" role="alert">
            {callError}
          </p>
        ) : null}
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {customers.length === 0 ? (
            <li className="px-4 py-6 text-slate-400">저장된 고객이 없습니다.</li>
          ) : (
            customers.map((customer) => {
              const disabledReason = callDisabledReason(customer);
              return (
                <li key={customer.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-slate-400">{customer.phoneNumber}</p>
                  </div>
                  {canCall ? (
                    <div className="text-right">
                      <button
                        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={callingId !== null || disabledReason !== null}
                        onClick={() => {
                          void placeCall(customer);
                        }}
                      >
                        {callingId === customer.id ? '발신 중…' : '전화 걸기'}
                      </button>
                      {disabledReason ? (
                        <p className="mt-1 text-xs text-slate-500">{disabledReason}</p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </main>
  );
}
