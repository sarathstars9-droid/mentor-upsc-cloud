import test from 'node:test';
import assert from 'node:assert';
import { generateToken, verifyToken } from '../utils/tokenUtils.js';
import crypto from 'node:crypto';

// Setup mock env vars for testing
process.env.NODE_ENV = 'test';
process.env.MENTOROS_AUTH_SECRET = 'test-secret-1234567890';
process.env.MENTOROS_LOGIN_PASSWORD = 'test-password';

test('tokenUtils - valid signed token', (t) => {
  const payload = { sub: 'moulika', role: 'aspirant', iss: 'mentoros', aud: 'mentoros-web', exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = generateToken(payload);

  assert.ok(token);

  const verified = verifyToken(token);
  assert.ok(verified);
  assert.strictEqual(verified.sub, 'moulika');
});

test('tokenUtils - expired token is rejected', (t) => {
  const payload = { sub: 'moulika', role: 'aspirant', iss: 'mentoros', aud: 'mentoros-web', exp: Math.floor(Date.now() / 1000) - 1000 };
  const token = generateToken(payload);

  const verified = verifyToken(token);
  assert.strictEqual(verified, null);
});

test('tokenUtils - tampered payload is rejected', (t) => {
  const payload = { sub: 'moulika', role: 'aspirant', iss: 'mentoros', aud: 'mentoros-web', exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = generateToken(payload);

  const parts = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, sub: 'admin' })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  const verified = verifyToken(tamperedToken);
  assert.strictEqual(verified, null);
});

test('tokenUtils - raw string instead of token', (t) => {
  const verified = verifyToken('moulika');
  assert.strictEqual(verified, null);
});

test('tokenUtils - wrong issuer is rejected', (t) => {
  const payload = { sub: 'moulika', role: 'aspirant', iss: 'wrong-issuer', aud: 'mentoros-web', exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = generateToken(payload);

  const verified = verifyToken(token);
  assert.strictEqual(verified, null);
});

test('tokenUtils - wrong audience is rejected', (t) => {
  const payload = { sub: 'moulika', role: 'aspirant', iss: 'mentoros', aud: 'wrong-audience', exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = generateToken(payload);

  const verified = verifyToken(token);
  assert.strictEqual(verified, null);
});
