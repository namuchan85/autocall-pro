'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authorizedFetch, readApiError } from '@/lib/api-client';
import { getCurrentUser, type AuthUser } from '@/lib/auth-client';
import { displayBadgeEmoji, displayColorClass } from '@/lib/customer-call-display';
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
  lastOutcome: string | null;
  displayColor: 'gray' | 'yellow' | 'blue' | 'red' | 'green' | 'orange';
  displayBadge: string;
  displayLabel: string;
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
  status: string;
  provider: string;
  createdAt: string;
  errorMessage: string | null;
}

interface ActiveCallResponse {
  id: string;
  customerId: string;
  phoneNumber: string;
  status: string;
  provider: string;
  deviceId: string;
  errorMessage: string | null;
  sessionId: string | null;
  companionState: string | null;
  observedActive: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

interface DeviceStatus {
  status: 'connected' | 'unauthorized' | 'offline' | 'not_found' | 'not_configured' | 'adb_missing';
  connected: boolean;
  deviceId: string | null;
  devices: { id: string; state: string }[];
}

interface CompanionStatus {
  galaxy: { status: string; connected: boolean; deviceId: string | null };
  companion: {
    installed: boolean;
    version: string | null;
    defaultDialer: boolean;
    callState: string;
    lastError: string | null;
    phoneControl: string;
    companion: string;
  };
  labels: {
    galaxy: string;
    companion: string;
    phoneControl: string;
  };
}

interface AutoCallSnapshot {
  phase: string;
  running: boolean;
  paused: boolean;
  currentCustomerId: string | null;
  remaining: number;
  lastError: string | null;
  message: string | null;
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
  const [hangupBusy, setHangupBusy] = useState(false);
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
  const [companion, setCompanion] = useState<CompanionStatus | null>(null);
  const [autoCall, setAutoCall] = useState<AutoCallSnapshot | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallResponse | null>(null);
  const [lastTerminalCall, setLastTerminalCall] = useState<ActiveCallResponse | null>(null);
  const [waitMs, setWaitMs] = useState(5000);
  const [ringMs, setRingMs] = useState(30000);
  const [maxCallMs, setMaxCallMs] = useState(60000);
  const [retryOnFailure, setRetryOnFailure] = useState(false);
  const [maxRetries, setMaxRetries] = useState(1);
  const [hangupOnStop, setHangupOnStop] = useState(true);

  const canManage =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const busy = saving || callingId !== null || deletingId !== null || Boolean(autoCall?.running);
  const inProgressCallState =
    activeCall?.status === 'DIALING' ||
    activeCall?.status === 'RINGING' ||
    activeCall?.status === 'ACTIVE';

  const callStateForUI = (() => {
    if (activeCall) {
      return activeCall.status;
    }
    if (lastTerminalCall) {
      return lastTerminalCall.status;
    }
    return 'IDLE';
  })();

  const sessionIdForUI = activeCall?.sessionId ?? lastTerminalCall?.sessionId ?? null;

  const callErrorForUI = activeCall?.errorMessage ?? lastTerminalCall?.errorMessage ?? null;

  const callStateUI = (() => {
    const state = callStateForUI;
    if (state === 'DIALING' || state === 'RINGING') {
      return { className: 'bg-yellow-500/20 text-yellow-100', label: '진행 중(통화 연결 대기)' };
    }
    if (state === 'ACTIVE') {
      return { className: 'bg-blue-500/20 text-blue-100', label: '통화 연결됨' };
    }
    if (state === 'DISCONNECTED') {
      return {
        className: 'bg-slate-500/20 text-slate-200',
        label: '통화 종료',
      };
    }
    if (state === 'FAILED') {
      return { className: 'bg-red-500/20 text-red-100', label: '통화 실패' };
    }
    if (state === 'CANCELLED') {
      return { className: 'bg-slate-500/20 text-slate-200', label: '통화 종료(중단)' };
    }
    return { className: 'bg-slate-700/20 text-slate-300', label: '대기' };
  })();

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

  const loadCompanion = useCallback(async () => {
    const response = await authorizedFetch('/telephony/companion');
    if (!response.ok) {
      return;
    }
    setCompanion((await response.json()) as CompanionStatus);
  }, []);

  const loadAutoCall = useCallback(async () => {
    const response = await authorizedFetch('/telephony/auto-call');
    if (!response.ok) {
      return;
    }
    setAutoCall((await response.json()) as AutoCallSnapshot);
  }, []);

  const loadActiveCall = useCallback(async () => {
    const response = await authorizedFetch('/telephony/active-call');
    if (!response.ok) {
      setActiveCall(null);
      return;
    }
    const body = (await response.json()) as { id: string | null } | ActiveCallResponse;
    if ('id' in body && body.id === null) {
      setActiveCall(null);
      return;
    }

    const call = body as ActiveCallResponse;
    setActiveCall(call);

    const terminalStatuses = ['DISCONNECTED', 'FAILED', 'CANCELLED'];
    if (terminalStatuses.includes(call.status)) {
      setLastTerminalCall(call);
    } else {
      setLastTerminalCall(null);
    }
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
          await Promise.all([
            loadCustomers(),
            loadDevice(),
            loadHistory(),
            loadSettings(),
            loadCompanion(),
            loadAutoCall(),
            loadActiveCall(),
          ]);
        } catch (caught) {
          setLoadError(
            caught instanceof Error ? caught.message : '고객 목록을 불러오지 못했습니다.',
          );
        }
      })
      .catch(() => router.replace('/login'));
  }, [
    loadCustomers,
    loadDevice,
    loadHistory,
    loadSettings,
    loadCompanion,
    loadAutoCall,
    loadActiveCall,
    router,
  ]);

  useEffect(() => {
    const fast = window.setInterval(() => {
      void Promise.all([loadAutoCall(), loadActiveCall(), loadHistory()]);
    }, 1000);

    const slow = window.setInterval(() => {
      void Promise.all([loadCompanion(), loadCustomers()]);
    }, 5000);

    return () => {
      window.clearInterval(fast);
      window.clearInterval(slow);
    };
  }, [loadCompanion, loadAutoCall, loadActiveCall, loadCustomers, loadHistory]);

  useEffect(() => {
    if (!lastTerminalCall) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLastTerminalCall(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [lastTerminalCall]);

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
      await Promise.all([loadHistory(), loadActiveCall(), loadCustomers()]);
    } catch (caught) {
      setCallError(caught instanceof Error ? caught.message : '발신 요청에 실패했습니다.');
    } finally {
      setCallingId(null);
    }
  }

  async function hangup(): Promise<void> {
    if (hangupBusy) {
      return;
    }
    setHangupBusy(true);
    try {
      setCallError('');
      const response = await authorizedFetch('/telephony/hangup', {
        method: 'POST',
        body: '{}',
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setCallError(readApiError(body, '통화 종료에 실패했습니다.'));
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      if (
        body &&
        typeof body === 'object' &&
        'id' in body &&
        (body as { id: unknown }).id === null
      ) {
        setCallError('종료할 활성 통화가 없습니다.');
        return;
      }
      setCallSuccess('통화 종료를 요청했습니다.');
      await Promise.all([loadHistory(), loadActiveCall(), loadCompanion()]);
    } finally {
      setHangupBusy(false);
    }
  }

  async function recordOutcome(
    customer: CustomerItem,
    outcome: 'SMS_REQUESTED' | 'NOT_INTERESTED' | 'DO_NOT_CALL' | 'CALL_AGAIN',
  ): Promise<void> {
    const response = await authorizedFetch(`/customers/${customer.id}/outcome`, {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setFormError(readApiError(body, '결과를 저장하지 못했습니다.'));
      return;
    }
    await loadCustomers();
  }

  async function startAutoCall(): Promise<void> {
    setCallError('');
    const response = await authorizedFetch('/telephony/auto-call/start', {
      method: 'POST',
      body: JSON.stringify({
        waitBetweenCallsMs: waitMs,
        ringTimeoutMs: ringMs,
        maxCallDurationMs: maxCallMs,
        retryOnFailure,
        maxRetries,
        hangupOnStop,
      }),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setCallError(readApiError(body, '자동발신을 시작하지 못했습니다.'));
      return;
    }
    setAutoCall((await response.json()) as AutoCallSnapshot);
  }

  async function controlAutoCall(path: 'pause' | 'resume' | 'stop'): Promise<void> {
    const response = await authorizedFetch(`/telephony/auto-call/${path}`, {
      method: 'POST',
      body: JSON.stringify(path === 'stop' ? { hangupCurrent: hangupOnStop } : {}),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setCallError(readApiError(body, '자동발신 제어에 실패했습니다.'));
      return;
    }
    setAutoCall((await response.json()) as AutoCallSnapshot);
  }

  async function installCompanion(): Promise<void> {
    const confirmed = window.confirm('연결된 Galaxy에 AutoCall Companion APK를 설치할까요?');
    if (!confirmed) {
      return;
    }
    const response = await authorizedFetch('/telephony/companion/install', {
      method: 'POST',
      body: '{}',
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setCallError(readApiError(body, 'Companion 설치에 실패했습니다.'));
      return;
    }
    setCallSuccess('Companion APK 설치를 요청했습니다. Galaxy에서 기본 전화 앱 권한을 승인하세요.');
    await loadCompanion();
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
      await Promise.all([loadDevice(), loadCompanion()]);
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

  const phoneControlReady = companion?.companion.phoneControl === 'ready';

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AutoCall Lite</h1>
          <p className="mt-2 text-slate-400">
            고객을 등록한 뒤 USB Galaxy와 Companion으로 전화를 겁니다. 앱 시작만으로 자동발신되지
            않습니다.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Galaxy / Companion / Phone Control</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
              onClick={() => {
                setDeviceError('');
                void Promise.all([loadDevice(), loadCompanion()]).catch((caught: unknown) => {
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
          <ul className="mt-4 space-y-1 text-sm">
            <li>
              Galaxy:{' '}
              {companion?.labels.galaxy ?? (device?.connected ? 'Connected' : 'Not connected')}
            </li>
            <li>Companion: {companion?.labels.companion ?? 'Not installed'}</li>
            <li>Phone Control: {companion?.labels.phoneControl ?? 'Not installed'}</li>
            <li>
              현재 통화:{' '}
              <span className={`rounded px-2 py-0.5 ${callStateUI.className}`}>
                {callStateUI.label}
              </span>
            </li>
            {companion?.companion.version ? <li>Version: {companion.companion.version}</li> : null}
            {sessionIdForUI ? <li>Session: {sessionIdForUI}</li> : null}
            {callErrorForUI ? <li className="text-red-400">통화 오류: {callErrorForUI}</li> : null}
            {companion?.companion.lastError ? (
              <li className="text-red-400">{companion.companion.lastError}</li>
            ) : null}
          </ul>
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
          {canManage && inProgressCallState ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                disabled={busy || hangupBusy}
                onClick={() => {
                  void hangup();
                }}
              >
                통화 종료
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
                onClick={() => {
                  void installCompanion();
                }}
              >
                Companion APK 설치
              </button>
            </div>
          ) : null}
          {deviceError ? <p className="mt-2 text-sm text-red-400">{deviceError}</p> : null}
        </div>
        {canManage ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">자동발신</h2>
            <p className="mt-2 text-sm text-slate-400">
              Start를 누르기 전에는 발신하지 않습니다. Companion이 기본 전화 앱이어야 합니다. ADB
              fallback은 단건 발신에만 사용합니다.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                다음 전화 대기(ms)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  type="number"
                  value={waitMs}
                  onChange={(event) => setWaitMs(Number(event.target.value))}
                />
              </label>
              <label className="text-sm">
                ringing 최대 대기(ms)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  type="number"
                  value={ringMs}
                  onChange={(event) => setRingMs(Number(event.target.value))}
                />
              </label>
              <label className="text-sm">
                연결 후 최대 통화(ms)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  type="number"
                  value={maxCallMs}
                  onChange={(event) => setMaxCallMs(Number(event.target.value))}
                />
              </label>
              <label className="text-sm">
                최대 재시도
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  type="number"
                  value={maxRetries}
                  onChange={(event) => setMaxRetries(Number(event.target.value))}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={retryOnFailure}
                onChange={(event) => setRetryOnFailure(event.target.checked)}
              />
              실패 시 재시도
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hangupOnStop}
                onChange={(event) => setHangupOnStop(event.target.checked)}
              />
              중지 시 현재 통화도 종료
            </label>
            <p className="mt-3 text-sm text-slate-300">
              상태: {autoCall?.phase ?? 'IDLE'}
              {autoCall?.message ? ` · ${autoCall.message}` : ''}
              {autoCall?.lastError ? ` · ${autoCall.lastError}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                disabled={Boolean(autoCall?.running) || !phoneControlReady}
                onClick={() => {
                  void startAutoCall();
                }}
              >
                자동발신 시작
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-60"
                disabled={!autoCall?.running || autoCall.paused}
                onClick={() => {
                  void controlAutoCall('pause');
                }}
              >
                일시정지
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-60"
                disabled={!autoCall?.paused}
                onClick={() => {
                  void controlAutoCall('resume');
                }}
              >
                재개
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-200 disabled:opacity-60"
                disabled={!autoCall?.running && autoCall?.phase !== 'PAUSED'}
                onClick={() => {
                  void controlAutoCall('stop');
                }}
              >
                중지
              </button>
            </div>
          </div>
        ) : null}
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
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="font-medium">통화 결과 색상</p>
          <ul className="mt-2 space-y-1">
            <li>⚪ 회색 = 아직 발신하지 않음</li>
            <li>🟡 노랑 = 진행 중</li>
            <li>🔵 파랑 = 연결 확인</li>
            <li>🔴 빨강 = 미연결/실패</li>
            <li>🟢 녹색 = 문자 요청</li>
            <li>🟠 주황 = 수신거부</li>
          </ul>
        </div>
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {customers.length === 0 ? (
            <li className="px-4 py-6 text-slate-400">저장된 고객이 없습니다.</li>
          ) : (
            customers.map((customer) => {
              const disabledReason = callDisabledReason(customer);
              return (
                <li
                  key={customer.id}
                  className={`flex items-start justify-between gap-4 px-4 py-4 ${displayColorClass(customer.displayColor)}`}
                >
                  <div>
                    <p className="font-medium">
                      {displayBadgeEmoji(customer.displayColor)} {customer.displayBadge} ·{' '}
                      {customer.name}
                    </p>
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
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          type="button"
                          onClick={() => void recordOutcome(customer, 'SMS_REQUESTED')}
                        >
                          문자 요청
                        </button>
                        <button
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          type="button"
                          onClick={() => void recordOutcome(customer, 'NOT_INTERESTED')}
                        >
                          관심 없음
                        </button>
                        <button
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          type="button"
                          onClick={() => void recordOutcome(customer, 'DO_NOT_CALL')}
                        >
                          수신거부
                        </button>
                        <button
                          className="rounded border border-slate-700 px-2 py-1 text-xs"
                          type="button"
                          onClick={() => void recordOutcome(customer, 'CALL_AGAIN')}
                        >
                          다시 전화
                        </button>
                      </div>
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
                    {item.status} · {item.provider} · {new Date(item.createdAt).toLocaleString()}
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
