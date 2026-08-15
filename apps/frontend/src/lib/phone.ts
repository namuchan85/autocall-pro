export function normalizePhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (compact.startsWith('+')) {
    return compact;
  }
  if (/^01[016789]\d{7,8}$/.test(compact)) {
    return `+82${compact.slice(1)}`;
  }
  if (/^82\d{8,13}$/.test(compact)) {
    return `+${compact}`;
  }
  return compact;
}

export function isE164PhoneNumber(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function formatPhoneForDisplay(value: string): string {
  if (value.startsWith('+82') && value.length >= 12) {
    const local = `0${value.slice(3)}`;
    if (local.length === 11) {
      return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    }
  }
  return value;
}

export function statusLabel(status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'): string {
  if (status === 'ACTIVE') {
    return '활성';
  }
  if (status === 'INACTIVE') {
    return '비활성';
  }
  return '차단';
}
