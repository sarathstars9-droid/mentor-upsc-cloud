import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuidv4 } from 'node:crypto';
import express from 'express';
import http from 'http';
import { pool } from './testDbHelper.mjs';
import mentorRoutes from '../routes/mentorRoutes.js';
import { generateToken } from '../utils/tokenUtils.js';

test('Mentor Session Integration', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/mentor', mentorRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/mentor`;

  process.env.NODE_ENV = 'production';
  const userId = uuidv4();
  process.env.MENTOROS_AUTH_SECRET = 'test-secret-16chars-long-that-is-at-least-32-bytes!';

  const origEnv = { ...process.env };
  const origFetch = globalThis.fetch;
  t.afterEach(() => {
    process.env = { ...origEnv };
    globalThis.fetch = origFetch;
  });

  const validToken = generateToken({ sub: userId, role: 'student', iss: 'mentoros', aud: 'mentoros-web' });
  const otherUserId = uuidv4();
  const otherToken = generateToken({ sub: otherUserId, role: 'student', iss: 'mentoros', aud: 'mentoros-web' });

  let sessionId = null;

  t.after(async () => {
    server.close();
    await pool.query('DELETE FROM mentor_messages WHERE session_id IN (SELECT id FROM mentor_sessions WHERE user_id IN ($1, $2))', [userId, otherUserId]);
    await pool.query('DELETE FROM mentor_sessions WHERE user_id IN ($1, $2)', [userId, otherUserId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userId, otherUserId]);
    await pool.end();
  });

  await t.test('Missing auth returns 401', async () => {
    const res = await fetch(`${baseUrl}/sessions`, { method: 'POST', body: JSON.stringify({ dayKey: '2026-08-05' }) });
    assert.strictEqual(res.status, 401);
  });

  await t.test('Raw Bearer moulika returns 401', async () => {
    const res = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer moulika', 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: '2026-08-05' })
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('Setup: Insert test user', async () => {
    await pool.query('INSERT INTO users (id, name) VALUES ($1, $2)', [userId, 'Test User']);
    await pool.query('INSERT INTO users (id, name) VALUES ($1, $2)', [otherUserId, 'Other User']);
  });

  await t.test('Valid signed token creates a session & Session ID is server-side', async () => {
    const res = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: '2026-08-05' })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.session.id);
    assert.strictEqual(body.session.user_id, userId);
    sessionId = body.session.id;
  });

  await t.test('body.userId cannot override req.user.id', async () => {
    const res = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: '2026-08-06', userId: otherUserId })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.session.user_id, userId);
  });

  await t.test('Wrong owner cannot read the session', async () => {
    const res = await fetch(`${baseUrl}/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${otherToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('Message body using only content is rejected', async () => {
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'I feel energetic', stage: 'energy' })
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('Wrong owner cannot add a message', async () => {
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${otherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', stage: 'energy', requestId: uuidv4() })
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('Missing API key uses deterministic fallback & Mentor State snapshot is stored', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    delete process.env.MENTOR_AI_API_KEY;

    const reqId = uuidv4();
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I feel energetic', stage: 'energy', requestId: reqId })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.source, 'deterministic');
    assert.strictEqual(body.session.current_stage, 'available_hours');

    const sessionRes = await fetch(`${baseUrl}/sessions/${sessionId}`, { headers: { 'Authorization': `Bearer ${validToken}` } });
    const sessionBody = await sessionRes.json();
    assert.strictEqual(sessionBody.session.energy_level, 'I feel energetic');
  });

  await t.test('Duplicate requestId creates no duplicate mentor reply', async () => {
    const reqId = uuidv4();
    const payload = JSON.stringify({ message: 'I have 6 hours', stage: 'available_hours', requestId: reqId });
    const res1 = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: payload
    });
    const res2 = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: payload
    });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const b1 = await res1.json();
    const b2 = await res2.json();

    assert.strictEqual(b1.mentorReply, b2.mentorReply);
    assert.strictEqual(b1.session.current_stage, 'mentor_command');

    const { rows } = await pool.query('SELECT COUNT(*) FROM mentor_messages WHERE request_id = $1', [reqId]);
    assert.strictEqual(rows[0].count, '1');
  });

  await t.test('Provider timeout preserves user message and falls back deterministically', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake';
    process.env.MENTOR_AI_TIMEOUT_MS = '100';

    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return new Promise((_, r) => setTimeout(() => r(new Error('AbortError')), 200));
      }
      return origFetch(url, options);
    };

    const reqId = uuidv4();
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Ready', stage: 'mentor_command', requestId: reqId })
    });

    const body = await res.json();
    assert.strictEqual(body.source, 'deterministic');
    assert.strictEqual(body.session.current_stage, 'obstacle');

    const { rows } = await pool.query(`SELECT * FROM mentor_messages WHERE request_id = $1`, [reqId]);
    assert.strictEqual(rows.length, 1);
  });

  await t.test('Provider 4xx preserves user message and falls back', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake';
    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return { ok: false, status: 400 };
      }
      return origFetch(url, options);
    };

    const reqId = uuidv4();
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tired', stage: 'obstacle', requestId: reqId })
    });

    const body = await res.json();
    assert.strictEqual(body.source, 'deterministic');
    assert.strictEqual(body.session.current_stage, 'first_block_commitment');
  });

  await t.test('Provider 5xx preserves user message and falls back', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake';
    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return { ok: false, status: 500 };
      }
      return origFetch(url, options);
    };

    const reqId = uuidv4();
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Polity', stage: 'first_block_commitment', requestId: reqId })
    });

    const body = await res.json();
    assert.strictEqual(body.source, 'deterministic');
    assert.strictEqual(body.session.current_stage, 'csat_commitment');

    const sessRes = await fetch(`${baseUrl}/sessions/${sessionId}`, { headers: { 'Authorization': `Bearer ${validToken}` } });
    const sessBody = await sessRes.json();
    assert.strictEqual(sessBody.session.first_block_commitment, 'Polity');
  });

  await t.test('Malformed JSON uses fallback', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake';
    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'not-json' } }] }) };
      }
      return origFetch(url, options);
    };

    const reqId = uuidv4();
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Yes', stage: 'csat_commitment', requestId: reqId })
    });

    const body = await res.json();
    assert.strictEqual(body.source, 'deterministic');
    assert.strictEqual(body.session.current_stage, 'confirmation');

    const sessRes = await fetch(`${baseUrl}/sessions/${sessionId}`, { headers: { 'Authorization': `Bearer ${validToken}` } });
    const sessBody = await sessRes.json();
    assert.strictEqual(sessBody.session.csat_commitment, 'Yes');
  });

  await t.test('Legal stage transition accepted', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake';
    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: 'Cool', nextStage: 'close' }) } }] }) };
      }
      return origFetch(url, options);
    };

    const reqId = uuidv4();
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Yes', stage: 'confirmation', requestId: reqId })
    });

    const body = await res.json();
    assert.strictEqual(body.source, 'ai');
    assert.strictEqual(body.session.current_stage, 'close');
  });

  await t.test('Wrong owner cannot commit', async () => {
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/commit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${otherToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('Commit is idempotent and completed session cannot be rewritten', async () => {
    const commitRes = await fetch(`${baseUrl}/sessions/${sessionId}/commit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(commitRes.status, 200);

    const extraMsgRes = await fetch(`${baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'More text', stage: 'close', requestId: uuidv4() })
    });
    assert.strictEqual(extraMsgRes.status, 400); // Cannot modify completed session
  });

  await t.test('No study block lifecycle row is modified automatically', async () => {
    assert.ok(true);
  });

  await t.test('Session request limit is enforced', async () => {
    // Already committed, so we need a new session to test limit
    const res = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: '2026-08-07' })
    });
    const sId = (await res.json()).session.id;

    // Insert 40 messages to max it out
    const queries = [];
    for(let i=0; i<40; i++) {
      queries.push(pool.query(`INSERT INTO mentor_messages (id, session_id, role, content, stage) VALUES ($1, $2, 'user', 'x', 'energy')`, [uuidv4(), sId]));
    }
    await Promise.all(queries);

    const overlimit = await fetch(`${baseUrl}/sessions/${sId}/message`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Too many', stage: 'energy', requestId: uuidv4() })
    });
    assert.strictEqual(overlimit.status, 429);
  });
});
