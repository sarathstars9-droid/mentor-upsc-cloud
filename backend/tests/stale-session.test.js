import test from 'node:test';
import assert from 'node:assert';
import { detectStaleSession } from '../utils/staleSessionUtils.js';

test('Stale Session Detection - Not Stale', (t) => {
  const block = {
    started_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
    status: 'active'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.sessionAgeMinutes, 1);
  assert.strictEqual(result.focusedElapsedMinutes, 1);
});

test('Stale Session Detection - Stale', (t) => {
  const block = {
    started_at: new Date(Date.now() - (730 * 60000)).toISOString(), // 730 mins ago
    status: 'active'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.sessionAgeMinutes, 730);
});

test('Stale Session Detection - Paused, not stale', (t) => {
  const block = {
    started_at: new Date(Date.now() - (100 * 60000)).toISOString(), // 100 mins ago
    paused_at: new Date(Date.now() - (90 * 60000)).toISOString(), // paused for 90 mins
    total_pause_seconds: 0,
    status: 'paused'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.sessionAgeMinutes, 100);
  assert.strictEqual(result.focusedElapsedMinutes, 10);
});

test('Stale Session Detection - Paused, stale', (t) => {
  const block = {
    started_at: new Date(Date.now() - (800 * 60000)).toISOString(), // 800 mins ago
    paused_at: new Date(Date.now() - (790 * 60000)).toISOString(), // paused for 790 mins
    total_pause_seconds: 0,
    status: 'paused'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  // session age is 800 mins, so it IS stale regardless of pause time.
  assert.strictEqual(result.isStale, true); 
  assert.strictEqual(result.sessionAgeMinutes, 800);
  assert.strictEqual(result.focusedElapsedMinutes, 10);
});

test('Stale Session Detection - Unpaused but total_pause_seconds high', (t) => {
  const block = {
    started_at: new Date(Date.now() - (1000 * 60000)).toISOString(), // 1000 mins ago
    total_pause_seconds: 900 * 60, // 900 mins paused
    status: 'active'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  assert.strictEqual(result.isStale, true); // session age > 720
  assert.strictEqual(result.sessionAgeMinutes, 1000);
  assert.strictEqual(result.focusedElapsedMinutes, 100);
});

test('Stale Session Detection - active for 60 minutes, then paused for 13 hours', (t) => {
  const now = Date.now();
  const block = {
    started_at: new Date(now - (14 * 60 * 60000)).toISOString(), // 14 hours ago total wall clock
    paused_at: new Date(now - (13 * 60 * 60000)).toISOString(), // paused 13 hours ago
    total_pause_seconds: 0,
    status: 'paused'
  };
  const result = detectStaleSession(block, new Date(now).toISOString());
  assert.strictEqual(result.isStale, true); // 14 hours > 12 hours
  assert.strictEqual(result.sessionAgeMinutes, 840);
  assert.strictEqual(result.focusedElapsedMinutes, 60);
});

test('Stale Session Detection - invalid paused_at is handled safely', (t) => {
  const block = {
    started_at: new Date(Date.now() - (60000 * 800)).toISOString(),
    paused_at: 'invalid-date',
    total_pause_seconds: 0,
    status: 'paused'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.invalidTimestamp, true);
});

test('Stale Session Detection - future paused_at is rejected safely', (t) => {
  const block = {
    started_at: new Date(Date.now() - (60000 * 800)).toISOString(),
    paused_at: new Date(Date.now() + 60000).toISOString(), // 1 min in future
    total_pause_seconds: 0,
    status: 'paused'
  };
  const result = detectStaleSession(block, new Date().toISOString());
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.invalidTimestamp, true);
});
