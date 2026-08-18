export const COMPANION_PACKAGE_NAME = 'com.autocall.lite.companion';
export const COMPANION_COMMAND_ACTIVITY = 'com.autocall.lite.companion/.CallCommandActivity';
export const COMPANION_STATUS_URI = 'content://com.autocall.lite.companion.status/current';
export const COMPANION_DIALER_ROLE = 'android.app.role.DIALER';

export const COMPANION_COMMANDS = ['dial', 'hangup', 'ping'] as const;
export type CompanionCommand = (typeof COMPANION_COMMANDS)[number];

export const COMPANION_CALL_STATES = [
  'IDLE',
  'DIALING',
  'RINGING',
  'ACTIVE',
  'DISCONNECTED',
  'UNKNOWN',
] as const;
export type CompanionCallState = (typeof COMPANION_CALL_STATES)[number];
