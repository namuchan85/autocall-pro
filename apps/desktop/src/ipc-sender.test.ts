import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTrustedIpcSender } from './ipc-sender';

describe('ipc sender validation', () => {
  it('allows the AutoCall Lite renderer main frame', () => {
    assert.equal(
      isTrustedIpcSender({
        senderUrl: 'http://127.0.0.1:3000/dashboard',
        isMainFrame: true,
        senderWebContentsId: 1,
        mainWindowWebContentsId: 1,
      }),
      true,
    );
  });

  it('blocks invalid senders', () => {
    const valid = {
      senderUrl: 'http://127.0.0.1:3000/dashboard',
      isMainFrame: true,
      senderWebContentsId: 1,
      mainWindowWebContentsId: 1,
    };
    assert.equal(isTrustedIpcSender({ ...valid, isMainFrame: false }), false);
    assert.equal(isTrustedIpcSender({ ...valid, senderWebContentsId: 2 }), false);
    assert.equal(isTrustedIpcSender({ ...valid, senderUrl: 'http://127.0.0.1:3001' }), false);
    assert.equal(isTrustedIpcSender({ ...valid, senderUrl: 'https://evil.example' }), false);
    assert.equal(
      isTrustedIpcSender({ ...valid, senderUrl: 'data:text/html,<script></script>' }),
      false,
    );
  });
});
