export interface ClientIpOptions {
  trustProxy: boolean;
  hops: number;
}

export interface ClientIpRequest {
  ip?: string;
  socket: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}

export function normalizeSocketAddress(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().replace(/^::ffff:/i, '');
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveClientIp(request: ClientIpRequest, options: ClientIpOptions): string {
  const peer = normalizeSocketAddress(request.socket.remoteAddress);
  if (!options.trustProxy) {
    return peer ?? 'unknown';
  }

  const hops = Math.max(1, options.hops);
  const forwarded = parseForwardedFor(request.headers['x-forwarded-for']);
  if (forwarded.length >= hops) {
    return forwarded[forwarded.length - hops] ?? peer ?? 'unknown';
  }

  return normalizeSocketAddress(request.ip) ?? peer ?? 'unknown';
}

function parseForwardedFor(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : value;
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((part) => normalizeSocketAddress(part))
    .filter((part): part is string => part !== undefined);
}
