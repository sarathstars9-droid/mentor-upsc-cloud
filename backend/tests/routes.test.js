import test from 'node:test';
import assert from 'node:assert';
import { isValidDayKey } from '../routes/planBlockRoutes.js';

test('calendar-date validation rules', async (t) => {
  // Invalid formats
  assert.strictEqual(isValidDayKey(''), false, 'missing value');
  assert.strictEqual(isValidDayKey(null), false, 'null');
  assert.strictEqual(isValidDayKey('04-08-2026'), false, 'DD-MM-YYYY format');
  assert.strictEqual(isValidDayKey('2026/08/04'), false, 'slashes instead of dashes');
  assert.strictEqual(isValidDayKey('2026-2-4'), false, 'single digits');
  assert.strictEqual(isValidDayKey('2026-08-04T00:00:00.000Z'), false, 'trailing text/time');
  assert.strictEqual(isValidDayKey([]), false, 'arrays');

  // Valid formats but invalid calendar dates
  assert.strictEqual(isValidDayKey('2026-02-31'), false, 'impossible calendar date 2026-02-31');
  assert.strictEqual(isValidDayKey('2026-13-01'), false, 'impossible month 13');
  assert.strictEqual(isValidDayKey('2026-02-29'), false, 'non-leap year 2026 February 29');

  // Valid formats and valid calendar dates
  assert.strictEqual(isValidDayKey('2024-02-29'), true, 'leap year 2024 February 29');
  assert.strictEqual(isValidDayKey('2026-08-04'), true, 'valid standard date');
});
