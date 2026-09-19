import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Calendar Retry Classification Semantics', () => {
  function classifyTransient(status, parsedBody) {
    const bodyText = [
      parsedBody?.error,
      parsedBody?.message,
      parsedBody?.raw
    ].filter(Boolean).join(' ');

    const bodyLooksTransient =
      /rate\s*limit|quota|user\s*rate\s*limit\s*exceeded|too\s*many\s*requests|service\s*unavailable|maximum\s*execution\s*time/i
        .test(bodyText);

    return (
      status === 429 ||
      status === 503 ||
      (status === 403 && bodyLooksTransient) ||
      (status === 200 && bodyLooksTransient)
    );
  }

  test('403 permission error → NO retry', () => {
    const isTransient = classifyTransient(403, { error: 'Forbidden: Insufficient OAuth scopes' });
    assert.equal(isTransient, false, 'Plain 403 permission error must not be retried');
  });

  test('403 rate limit error → retry', () => {
    const isTransient = classifyTransient(403, { error: '403 User Rate Limit Exceeded' });
    assert.equal(isTransient, true, '403 with Rate Limit Exceeded must be retried');
  });

  test('429 too many requests → retry', () => {
    const isTransient = classifyTransient(429, { error: 'Too Many Requests' });
    assert.equal(isTransient, true, '429 must be retried');
  });

  test('503 service unavailable → retry', () => {
    const isTransient = classifyTransient(503, { error: 'Service Unavailable' });
    assert.equal(isTransient, true, '503 must be retried');
  });

  test('HTTP 200 with embedded rate-limit error in JSON → retry', () => {
    const isTransient = classifyTransient(200, {
      ok: false,
      error: 'Exception: GoogleJsonResponseException: 403 User Rate Limit Exceeded'
    });
    assert.equal(isTransient, true, 'HTTP 200 with body-level rate limit must be retried');
  });

  test('HTTP 200 normal success → NO retry', () => {
    const isTransient = classifyTransient(200, { ok: true, synced: 3, skipped: 596, errors: 0 });
    assert.equal(isTransient, false, 'HTTP 200 success must not be retried');
  });

  test('400 bad request / validation error → NO retry', () => {
    const isTransient = classifyTransient(400, { error: 'Invalid date format' });
    assert.equal(isTransient, false, '400 validation error must not be retried');
  });
});
