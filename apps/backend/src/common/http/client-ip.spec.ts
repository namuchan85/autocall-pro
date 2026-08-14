import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('uses the TCP peer and ignores forwarded headers when trust proxy is disabled', () => {
    expect(
      resolveClientIp(
        {
          ip: '203.0.113.10',
          socket: { remoteAddress: '::ffff:10.0.0.8' },
          headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' },
        },
        { trustProxy: false, hops: 1 },
      ),
    ).toBe('10.0.0.8');
  });

  it('uses the rightmost forwarded address for one trusted proxy hop', () => {
    expect(
      resolveClientIp(
        {
          socket: { remoteAddress: '10.0.0.2' },
          headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.50' },
        },
        { trustProxy: true, hops: 1 },
      ),
    ).toBe('203.0.113.50');
  });

  it('falls back to the TCP peer when trusted proxy mode has no forwarded header', () => {
    expect(
      resolveClientIp(
        {
          ip: '10.0.0.2',
          socket: { remoteAddress: '10.0.0.2' },
          headers: {},
        },
        { trustProxy: true, hops: 1 },
      ),
    ).toBe('10.0.0.2');
  });
});
