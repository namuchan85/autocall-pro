import type { CustomerOutcome } from '../domain/customer.types';

export const DISPLAY_COLORS = ['gray', 'yellow', 'blue', 'red', 'green', 'orange'] as const;
export type DisplayColor = (typeof DISPLAY_COLORS)[number];

export interface CustomerDisplayBadge {
  color: DisplayColor;
  badge: string;
  label: string;
}

export function customerDisplayBadge(input: {
  doNotCall: boolean;
  lastOutcome: CustomerOutcome | null;
  latestCallStatus: string | null;
  latestObservedActive: boolean;
}): CustomerDisplayBadge {
  if (input.doNotCall || input.lastOutcome === 'DO_NOT_CALL') {
    return { color: 'orange', badge: '수신거부', label: '수신거부' };
  }
  if (input.lastOutcome === 'SMS_REQUESTED') {
    return { color: 'green', badge: '문자 요청', label: '문자 요청' };
  }
  if (input.lastOutcome === 'NOT_INTERESTED') {
    return { color: 'red', badge: '관심 없음', label: '관심 없음' };
  }
  if (input.lastOutcome === 'CALL_AGAIN') {
    return { color: 'gray', badge: '다시 전화', label: '다시 전화' };
  }

  const status = input.latestCallStatus;
  if (!status) {
    return { color: 'gray', badge: '미발신', label: '아직 발신하지 않음' };
  }
  if (
    status === 'REQUESTED' ||
    status === 'STARTED' ||
    status === 'DIALING' ||
    status === 'RINGING'
  ) {
    return { color: 'yellow', badge: '진행 중', label: '진행 중' };
  }
  if (status === 'ACTIVE' || (status === 'DISCONNECTED' && input.latestObservedActive)) {
    return { color: 'blue', badge: '연결', label: '연결 확인' };
  }
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'DISCONNECTED') {
    return { color: 'red', badge: '미연결', label: '미연결/실패' };
  }
  return { color: 'gray', badge: '미발신', label: '아직 발신하지 않음' };
}
