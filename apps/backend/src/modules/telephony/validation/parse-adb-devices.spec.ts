import { parseAdbDevicesOutput } from './parse-adb-devices';

describe('parseAdbDevicesOutput', () => {
  it('parses a connected device', () => {
    expect(parseAdbDevicesOutput('List of devices attached\nTESTDEVICE01\tdevice\n')).toEqual([
      { id: 'TESTDEVICE01', state: 'device' },
    ]);
  });

  it('parses unauthorized and offline states', () => {
    expect(
      parseAdbDevicesOutput(
        'List of devices attached\nTESTDEVICE01\tunauthorized\nTESTDEVICE02\toffline\n',
      ),
    ).toEqual([
      { id: 'TESTDEVICE01', state: 'unauthorized' },
      { id: 'TESTDEVICE02', state: 'offline' },
    ]);
  });

  it('returns an empty list when no device is attached', () => {
    expect(parseAdbDevicesOutput('List of devices attached\n\n')).toEqual([]);
  });
});
