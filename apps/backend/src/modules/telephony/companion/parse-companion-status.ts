import {
  COMPANION_CALL_STATES,
  COMPANION_PACKAGE_NAME,
  type CompanionCallState,
} from './companion.constants';
import type { CompanionStatusSnapshot } from './companion.types';

const VERSION_PATTERN = /versionName=([0-9A-Za-z._-]+)/;
const PATH_PATTERN = /^package:/m;

export function isCompanionInstalled(pmPathOutput: string): boolean {
  return PATH_PATTERN.test(pmPathOutput);
}

export function parseCompanionVersion(dumpsysOutput: string): string | null {
  const matched = VERSION_PATTERN.exec(dumpsysOutput);
  return matched?.[1] ?? null;
}

export function parseDefaultDialerPackage(roleOutput: string): string | null {
  const lines = roleOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith(':'));
  const packageLine = lines.find((line) => /^[A-Za-z][A-Za-z0-9._]+$/.test(line));
  return packageLine ?? null;
}

export function isCompanionDefaultDialer(roleOutput: string): boolean {
  return parseDefaultDialerPackage(roleOutput) === COMPANION_PACKAGE_NAME;
}

export function parseCompanionCallState(value: string): CompanionCallState {
  return COMPANION_CALL_STATES.includes(value as CompanionCallState)
    ? (value as CompanionCallState)
    : 'UNKNOWN';
}

export function parseContentQuerySnapshot(output: string): CompanionStatusSnapshot | null {
  const row = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('Row:'));
  if (!row) {
    return null;
  }

  const fields = parseContentRow(row);
  return {
    installed: true,
    version: emptyToNull(fields.versionName ?? fields.version),
    defaultDialer: parseBooleanFlag(fields.defaultDialer),
    callState: parseCompanionCallState(fields.callState ?? 'UNKNOWN'),
    sessionId: emptyToNull(fields.sessionId),
    lastError: emptyToNull(fields.lastError),
  };
}

export function isCompanionCommand(value: string): boolean {
  return value === 'dial' || value === 'hangup' || value === 'ping';
}

function parseContentRow(row: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const body = row.replace(/^Row:\s*\d+\s*/, '');
  for (const part of body.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) {
      fields[key] = value === 'NULL' ? '' : value;
    }
  }
  return fields;
}

function parseBooleanFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function emptyToNull(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return value;
}
