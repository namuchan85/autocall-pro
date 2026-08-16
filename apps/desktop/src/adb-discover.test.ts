import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discoverAdbPath } from './adb-discover';

describe('discoverAdbPath', () => {
  it('returns a string path or empty when adb is absent', () => {
    const result = discoverAdbPath();
    assert.equal(typeof result, 'string');
  });
});
