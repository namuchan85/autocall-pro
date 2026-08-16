import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedFrontendUrl } from './frontend-url';

describe('isAllowedFrontendUrl', () => {
  it('allows the Lite frontend origin and paths', () => {
    assert.equal(isAllowedFrontendUrl('http://127.0.0.1:3000'), true);
    assert.equal(isAllowedFrontendUrl('http://127.0.0.1:3000/dashboard'), true);
  });

  it('rejects localhost, other ports, https, and external hosts', () => {
    assert.equal(isAllowedFrontendUrl('http://localhost:3000'), false);
    assert.equal(isAllowedFrontendUrl('http://127.0.0.1:3001'), false);
    assert.equal(isAllowedFrontendUrl('https://127.0.0.1:3000'), false);
    assert.equal(isAllowedFrontendUrl('https://example.com'), false);
    assert.equal(isAllowedFrontendUrl('http://evil.example.com'), false);
  });
});
