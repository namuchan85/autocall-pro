import { customerDisplayBadge } from './customer-display';

describe('customerDisplayBadge', () => {
  it('uses gray for customers who have not been called', () => {
    expect(
      customerDisplayBadge({
        doNotCall: false,
        lastOutcome: null,
        latestCallStatus: null,
        latestObservedActive: false,
      }),
    ).toMatchObject({ color: 'gray', badge: '미발신' });
  });

  it('uses yellow for in-progress calls', () => {
    expect(
      customerDisplayBadge({
        doNotCall: false,
        lastOutcome: null,
        latestCallStatus: 'DIALING',
        latestObservedActive: false,
      }).color,
    ).toBe('yellow');
  });

  it('uses blue only when an ACTIVE state was actually observed', () => {
    expect(
      customerDisplayBadge({
        doNotCall: false,
        lastOutcome: null,
        latestCallStatus: 'DISCONNECTED',
        latestObservedActive: true,
      }),
    ).toMatchObject({ color: 'blue', badge: '연결' });
    expect(
      customerDisplayBadge({
        doNotCall: false,
        lastOutcome: null,
        latestCallStatus: 'DISCONNECTED',
        latestObservedActive: false,
      }),
    ).toMatchObject({ color: 'red', badge: '미연결' });
  });

  it('uses green for SMS requested and orange for do-not-call', () => {
    expect(
      customerDisplayBadge({
        doNotCall: false,
        lastOutcome: 'SMS_REQUESTED',
        latestCallStatus: 'DISCONNECTED',
        latestObservedActive: true,
      }),
    ).toMatchObject({ color: 'green', badge: '문자 요청' });
    expect(
      customerDisplayBadge({
        doNotCall: true,
        lastOutcome: null,
        latestCallStatus: 'ACTIVE',
        latestObservedActive: true,
      }),
    ).toMatchObject({ color: 'orange', badge: '수신거부' });
  });
});
