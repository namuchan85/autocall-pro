'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authorizedFetch, readApiError } from '@/lib/api-client';
import { getCurrentUser, type AuthUser } from '@/lib/auth-client';
import {
  formatPhoneForDisplay,
  isE164PhoneNumber,
  normalizePhoneNumber,
  statusLabel,
} from '@/lib/phone';

interface CustomerItem {
  id: string;
  name: string;
  phoneNumber: string;
  memo: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  doNotCall: boolean;
}

interface CustomerListResponse {
  items: CustomerItem[];
  total: number;
  page: number;
  limit: number;
}

interface CallHistoryItem {
  id: string;
  customerName: string;
  phoneNumber: string;
  status: 'REQUESTED' | 'STARTED' | 'FAILED';
  createdAt: string;
  errorMessage: string | null;
}

interface DeviceStatus {
  status: 'connected' | 'unauthorized' | 'offline' | 'not_found' | 'not_configured' | 'adb_missing';
  connected: boolean;
  deviceId: string | null;
  devices: { id: string; state: string }[];
}

function deviceStatusLabel(status: DeviceStatus['status']): string {
  switch (status) {
    case 'connected':
      return '연결됨';
    case 'unauthorized':
      return 'USB 디버깅 미승인';
    case 'offline':
      return '오프라인';
    case 'not_found':
      return '연결 안 됨';
    case 'not_configured':
      return 'ADB 미설정';
    case 'adb_missing':
      return 'ADB 실행 파일 없음';
    default:
      return '알 수 없음';
  }
}

function parseCustomerStatus(value: string): CustomerItem['status'] {
  if (value === 'ACTIVE' || value === 'INACTIVE' || value === 'BLOCKED') {
    return value;
  }
  return 'ACTIVE';
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
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [callError, setCallError] = useState('');
  const [callSuccess, setCallSuccess] = useState('');
  const [callingId, setCallingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState<CustomerItem['status']>('ACTIVE');
  const [doNotCall, setDoNotCall] = useState(false);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [deviceError, setDeviceError] = useState('');
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [adbPath, setAdbPath] = useState('');
  const [adbDeviceId, setAdbDeviceId] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  const canManage =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const busy = saving || callingId !== null || deletingId !== null;

  const loadCustomers = useCallback(async () => {
    const response = await authorizedFetch('/customers?limit=100');
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new Error(readApiError(body, '고객 목록을 불러오지 못했습니다.'));
    }
    const result = (await response.json()) as CustomerListResponse;
    setCustomers(result.items);
  }, []);

  const loadDevice = useCallback(async () => {
    const response = await authorizedFetch('/telephony/device');
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new Error(readApiError(body, 'Galaxy 상태를 불러오지 못했습니다.'));
    }
    setDevice((await response.json()) as DeviceStatus);
  }, []);

  const loadHistory = useCallback(async () => {
    const response = await authorizedFetch('/telephony/calls');
    if (!response.ok) {
      return;
    }
    setHistory((await response.json()) as CallHistoryItem[]);
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await authorizedFetch('/settings');
    if (!response.ok) {
      return;
    }
    const result = (await response.json()) as { adbPath: string; adbDeviceId: string };
    setAdbPath(result.adbPath);
    setAdbDeviceId(result.adbDeviceId);
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then(async (current) => {
        setUser(current);
        try {
          await Promise.all([loadCustomers(), loadDevice(), loadHistory(), loadSettings()]);
        } catch (caught) {
          setLoadError(
            caught instanceof Error ? caught.message : '고객 목록을 불러오지 못했습니다.',
          );
        }
      })
      .catch(() => router.replace('/login'));
  }, [loadCustomers, loadDevice, loadHistory, loadSettings, router]);

  function resetForm(): void {
    setEditingId(null);
    setName('');
    setPhoneNumber('');
    setMemo('');
    setStatus('ACTIVE');
    setDoNotCall(false);
  }

  function startEdit(customer: CustomerItem): void {
    setEditingId(customer.id);
    setName(customer.name);
    setPhoneNumber(formatPhoneForDisplay(customer.phoneNumber));
    setMemo(customer.memo ?? '');
    setStatus(customer.status);
    setDoNotCall(customer.doNotCall);
    setFormError('');
    setFormSuccess('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!name.trim()) {
      setFormError('이름을 입력해주세요.');
      return;
    }
    if (!isE164PhoneNumber(normalizedPhone)) {
      setFormError('올바른 휴대폰 번호를 입력해주세요. 예: 010-1234-5678');
      return;
    }

    setFormError('');
    setFormSuccess('');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phoneNumber: normalizedPhone,
        memo: memo.trim() ? memo.trim() : null,
        status,
        doNotCall,
      };
      const response = editingId
        ? await authorizedFetch(`/customers/${editingId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await authorizedFetch('/customers', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(readApiError(body, '고객 저장에 실패했습니다.'));
      }
      setFormSuccess(editingId ? '고객이 수정되었습니다.' : '고객이 추가되었습니다.');
      resetForm();
      await loadCustomers();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '고객 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomer(customer: CustomerItem): Promise<void> {
    const confirmed = window.confirm('이 고객을 삭제하시겠습니까?');
    if (!confirmed) {
      return;
    }
    setFormError('');
    setFormSuccess('');
    setDeletingId(customer.id);
    try {
      const response = await authorizedFetch(`/customers/${customer.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(readApiError(body, '고객 삭제에 실패했습니다.'));
      }
      if (editingId === customer.id) {
        resetForm();
      }
      setFormSuccess('고객이 삭제되었습니다.');
      await loadCustomers();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : '고객 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

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
      await loadHistory();
    } catch (caught) {
      setCallError(caught instanceof Error ? caught.message : '발신 요청에 실패했습니다.');
    } finally {
      setCallingId(null);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSettingsMessage('');
    const response = await authorizedFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify({ adbPath: adbPath.trim(), adbDeviceId: adbDeviceId.trim() }),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setSettingsMessage(readApiError(body, '설정을 저장하지 못했습니다.'));
      return;
    }
    setSettingsMessage('설정이 저장되었습니다.');
    try {
      await loadDevice();
    } catch (caught) {
      setDeviceError(
        caught instanceof Error ? caught.message : 'Galaxy 상태를 불러오지 못했습니다.',
      );
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
          <p className="mt-2 text-slate-400">고객을 등록한 뒤 Galaxy로 전화를 겁니다.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Galaxy Device</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
              onClick={() => {
                setDeviceError('');
                void loadDevice().catch((caught: unknown) => {
                  setDeviceError(
                    caught instanceof Error ? caught.message : 'Galaxy 상태를 불러오지 못했습니다.',
                  );
                });
              }}
            >
              새로고침
            </button>
          </div>
          <p className="mt-3 text-lg">
            {device?.connected ? '🟢 연결됨' : '🔴 연결 안 됨'}
            {device ? ` · ${deviceStatusLabel(device.status)}` : ''}
          </p>
          <p className="mt-1 text-sm text-slate-400">{device?.deviceId ?? 'Device ID 없음'}</p>
          {device && device.devices.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {device.devices.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="text-left hover:text-cyan-300"
                    onClick={() => setAdbDeviceId(item.id)}
                  >
                    {item.id} ({item.state})
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {deviceError ? <p className="mt-2 text-sm text-red-400">{deviceError}</p> : null}
        </div>
        {canManage ? (
          <form
            className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5"
            onSubmit={(event) => void saveSettings(event)}
          >
            <h2 className="text-lg font-semibold">설정</h2>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">ADB 경로</span>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                  value={adbPath}
                  onChange={(event) => setAdbPath(event.target.value)}
                  placeholder="C:\platform-tools\adb.exe"
                />
                {typeof window !== 'undefined' && window.desktop?.pickAdbPath ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-slate-700 px-3"
                    onClick={() => {
                      void window.desktop?.pickAdbPath().then((selected) => {
                        if (selected) {
                          setAdbPath(selected);
                        }
                      });
                    }}
                  >
                    찾기
                  </button>
                ) : null}
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Galaxy device id</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                value={adbDeviceId}
                onChange={(event) => setAdbDeviceId(event.target.value)}
                placeholder="adb devices 결과의 id"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-950"
            >
              설정 저장
            </button>
            {settingsMessage ? <p className="text-sm text-slate-300">{settingsMessage}</p> : null}
          </form>
        ) : null}
        {canManage ? (
          <form
            className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <h2 className="text-lg font-semibold">{editingId ? '고객 수정' : '고객 추가'}</h2>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">이름</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">전화번호</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="010-1234-5678"
                inputMode="tel"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">메모</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                maxLength={2000}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">상태</span>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                value={status}
                onChange={(event) => setStatus(parseCustomerStatus(event.target.value))}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">수신거부 (doNotCall)</span>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                value={doNotCall ? 'true' : 'false'}
                onChange={(event) => setDoNotCall(event.target.value === 'true')}
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button
                className="rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={busy}
              >
                {saving ? '저장 중…' : editingId ? '수정 저장' : '고객 추가'}
              </button>
              {editingId ? (
                <button
                  className="rounded-lg border border-slate-700 px-4 py-3 text-slate-200"
                  type="button"
                  disabled={busy}
                  onClick={resetForm}
                >
                  취소
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
        {loadError ? (
          <p className="text-sm text-red-400" role="alert">
            {loadError}
          </p>
        ) : null}
        {formSuccess ? (
          <p className="text-sm text-cyan-300" role="status">
            {formSuccess}
          </p>
        ) : null}
        {formError ? (
          <p className="text-sm text-red-400" role="alert">
            {formError}
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
                <li key={customer.id} className="flex items-start justify-between gap-4 px-4 py-4">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-slate-400">
                      {formatPhoneForDisplay(customer.phoneNumber)}
                    </p>
                    {customer.memo ? (
                      <p className="mt-1 text-sm text-slate-500">{customer.memo}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {statusLabel(customer.status)}
                      {customer.doNotCall ? ' · 수신거부' : ''}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={busy || disabledReason !== null}
                        onClick={() => {
                          void placeCall(customer);
                        }}
                      >
                        {callingId === customer.id ? '발신 중…' : '전화 걸기'}
                      </button>
                      {disabledReason ? (
                        <p className="text-xs text-slate-500">{disabledReason}</p>
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-60"
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(customer)}
                        >
                          수정
                        </button>
                        <button
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-60"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void removeCustomer(customer);
                          }}
                        >
                          {deletingId === customer.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">통화 기록</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-slate-400">아직 통화 기록이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {history.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-800 px-4 py-3 text-sm">
                  <p className="font-medium">
                    {item.customerName} · {formatPhoneForDisplay(item.phoneNumber)}
                  </p>
                  <p className="text-slate-400">
                    {item.status} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.errorMessage ? <p className="text-red-400">{item.errorMessage}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
