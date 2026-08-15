export class AdbExecutableMissingError extends Error {
  constructor(message = 'ADB executable was not found') {
    super(message);
    this.name = 'AdbExecutableMissingError';
  }
}

export class AdbDeviceNotConnectedError extends Error {
  constructor(message = 'Galaxy is not connected') {
    super(message);
    this.name = 'AdbDeviceNotConnectedError';
  }
}

export class AdbDeviceUnauthorizedError extends Error {
  constructor(message = 'Galaxy USB debugging is unauthorized') {
    super(message);
    this.name = 'AdbDeviceUnauthorizedError';
  }
}

export class AdbDeviceOfflineError extends Error {
  constructor(message = 'Galaxy is offline') {
    super(message);
    this.name = 'AdbDeviceOfflineError';
  }
}

export class AdbCommandFailedError extends Error {
  constructor(message = 'ADB call command failed') {
    super(message);
    this.name = 'AdbCommandFailedError';
  }
}

export class TelephonyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelephonyConfigError';
  }
}
