import { isE164PhoneNumber } from '../../customers/validation/phone-number';
import {
  companionCommandArgs,
  companionInstallArgs,
  companionPmPathArgs,
  companionRoleArgs,
  companionStatusQueryArgs,
} from './companion-argv';
import { COMPANION_PACKAGE_NAME, COMPANION_STATUS_URI } from './companion.constants';
import {
  isCompanionCommand,
  isCompanionDefaultDialer,
  isCompanionInstalled,
  parseCompanionVersion,
  parseContentQuerySnapshot,
  parseDefaultDialerPackage,
} from './parse-companion-status';

describe('companion parsers', () => {
  it('detects an installed package from pm path output', () => {
    expect(isCompanionInstalled('package:/data/app/base.apk\n')).toBe(true);
    expect(isCompanionInstalled('Error: package not found')).toBe(false);
  });

  it('parses versionName from dumpsys package output', () => {
    expect(parseCompanionVersion('    versionCode=1 minSdk=26\n    versionName=1.0.0\n')).toBe(
      '1.0.0',
    );
    expect(parseCompanionVersion('no version here')).toBeNull();
  });

  it('parses the default dialer package from cmd role output', () => {
    const samsung = 'android.app.role.DIALER:\n  com.samsung.android.incallui\n';
    expect(parseDefaultDialerPackage(samsung)).toBe('com.samsung.android.incallui');
    expect(isCompanionDefaultDialer(samsung)).toBe(false);
    expect(isCompanionDefaultDialer(`${COMPANION_PACKAGE_NAME}\n`)).toBe(true);
  });

  it('parses a content query row into a status snapshot', () => {
    const output =
      'Row: 0 versionName=1.0.0, callState=ACTIVE, sessionId=sess-1, defaultDialer=true, lastError=NULL';
    expect(parseContentQuerySnapshot(output)).toEqual({
      installed: true,
      version: '1.0.0',
      defaultDialer: true,
      callState: 'ACTIVE',
      sessionId: 'sess-1',
      lastError: null,
    });
  });

  it('maps unknown Android states to UNKNOWN instead of inventing NO_ANSWER', () => {
    const output = 'Row: 0 versionName=1.0.0, callState=NO_ANSWER, sessionId=, defaultDialer=false';
    expect(parseContentQuerySnapshot(output)?.callState).toBe('UNKNOWN');
  });
});

describe('companion argv builders', () => {
  const deviceId = 'R5CT00TEST1';

  it('builds pm path, role, and content query argv without shell concatenation', () => {
    expect(companionPmPathArgs(deviceId)).toEqual([
      '-s',
      deviceId,
      'shell',
      'pm',
      'path',
      COMPANION_PACKAGE_NAME,
    ]);
    expect(companionRoleArgs(deviceId)).toEqual([
      '-s',
      deviceId,
      'shell',
      'cmd',
      'role',
      'get',
      'android.app.role.DIALER',
    ]);
    expect(companionStatusQueryArgs(deviceId).includes(COMPANION_STATUS_URI)).toBe(true);
  });

  it('puts the E.164 number in its own argv slot', () => {
    const phoneNumber = '+821012345678';
    expect(isE164PhoneNumber(phoneNumber)).toBe(true);
    expect(companionCommandArgs(deviceId, 'dial', { phoneNumber, sessionId: 'session-1' })).toEqual(
      [
        '-s',
        deviceId,
        'shell',
        'am',
        'start',
        '-n',
        'com.autocall.lite.companion/.CallCommandActivity',
        '--es',
        'cmd',
        'dial',
        '--es',
        'tel',
        phoneNumber,
        '--es',
        'session',
        'session-1',
      ],
    );
  });

  it('rejects an invalid phone number instead of embedding it in a shell string', () => {
    expect(() => companionCommandArgs(deviceId, 'dial', { phoneNumber: '01012345678' })).toThrow(
      'Phone number is invalid',
    );
  });

  it('rejects an unknown command', () => {
    expect(isCompanionCommand('rm')).toBe(false);
    expect(() => companionCommandArgs(deviceId, 'rm' as 'dial')).toThrow(
      'Companion command is invalid',
    );
  });

  it('builds install argv from a validated apk path', () => {
    expect(companionInstallArgs(deviceId, 'C:\\apps\\AutoCall Companion.apk')).toEqual([
      '-s',
      deviceId,
      'install',
      '-r',
      'C:\\apps\\AutoCall Companion.apk',
    ]);
    expect(() => companionInstallArgs(deviceId, 'C:\\apps\\payload.exe')).toThrow(
      'Companion APK path is invalid',
    );
  });
});
