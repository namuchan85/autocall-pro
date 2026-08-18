import { isE164PhoneNumber } from '../../customers/validation/phone-number';
import { isSafeAdbDeviceId } from '../validation/adb-device-id';
import {
  COMPANION_COMMAND_ACTIVITY,
  COMPANION_DIALER_ROLE,
  COMPANION_PACKAGE_NAME,
  COMPANION_STATUS_URI,
  type CompanionCommand,
} from './companion.constants';
import { isCompanionCommand } from './parse-companion-status';

const SESSION_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function assertSafeDeviceId(deviceId: string): string {
  if (!isSafeAdbDeviceId(deviceId)) {
    throw new Error('ADB device id is invalid');
  }
  return deviceId;
}

export function companionPmPathArgs(deviceId: string): string[] {
  return ['-s', assertSafeDeviceId(deviceId), 'shell', 'pm', 'path', COMPANION_PACKAGE_NAME];
}

export function companionDumpsysArgs(deviceId: string): string[] {
  return [
    '-s',
    assertSafeDeviceId(deviceId),
    'shell',
    'dumpsys',
    'package',
    COMPANION_PACKAGE_NAME,
  ];
}

export function companionRoleArgs(deviceId: string): string[] {
  return ['-s', assertSafeDeviceId(deviceId), 'shell', 'cmd', 'role', 'get', COMPANION_DIALER_ROLE];
}

export function companionStatusQueryArgs(deviceId: string): string[] {
  return [
    '-s',
    assertSafeDeviceId(deviceId),
    'shell',
    'content',
    'query',
    '--uri',
    COMPANION_STATUS_URI,
  ];
}

export function companionCommandArgs(
  deviceId: string,
  command: CompanionCommand,
  extras: { phoneNumber?: string; sessionId?: string } = {},
): string[] {
  if (!isCompanionCommand(command)) {
    throw new Error('Companion command is invalid');
  }

  const args = [
    '-s',
    assertSafeDeviceId(deviceId),
    'shell',
    'am',
    'start',
    '-n',
    COMPANION_COMMAND_ACTIVITY,
    '--es',
    'cmd',
    command,
  ];

  if (command === 'dial') {
    const phoneNumber = extras.phoneNumber;
    if (!phoneNumber || !isE164PhoneNumber(phoneNumber)) {
      throw new Error('Phone number is invalid');
    }
    args.push('--es', 'tel', phoneNumber);
  }

  if (extras.sessionId) {
    if (!SESSION_PATTERN.test(extras.sessionId)) {
      throw new Error('Call session id is invalid');
    }
    args.push('--es', 'session', extras.sessionId);
  }

  return args;
}

export function companionInstallArgs(deviceId: string, apkPath: string): string[] {
  if (!apkPath.toLowerCase().endsWith('.apk')) {
    throw new Error('Companion APK path is invalid');
  }
  return ['-s', assertSafeDeviceId(deviceId), 'install', '-r', apkPath];
}
