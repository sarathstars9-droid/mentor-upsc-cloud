import assert from 'node:assert/strict';
import { startBlock } from './services/blockLifecycleService.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePersistedRow(overrides = {}) {
  return {
    id:              '11111111-0000-0000-0000-000000000001',
    user_id:         'moulika',
    block_id:        '2026-07-13__0930__GS_2__1',
    day_key:         '2026-07-13',
    title:           'GS-2 Morning Session',
    subject:         'GS-2',
    topic:           'Polity',
    planned_start:   '09:30',
    planned_end:     '11:30',
    planned_minutes: 120,
    status:          'planned',
    started_at:      null,
    paused_at:       null,
    last_resumed_at: null,
    total_pause_seconds: 0,
    calendar_sync_status: 'pending',
    updated_at:      new Date().toISOString(),
    node_id:         'GS2-POLITY',
    is_test_data:    false,
    ...overrides,
  };
}

class FakeClient {
  constructor({ rows = [], updateRows = null, throwOnQuery = null } = {}) {
    this._rows        = rows;
    this._updateRows  = updateRows;
    this._throwOn     = throwOnQuery;
    this.committed    = false;
    this.rolledBack   = false;
    this.queries      = [];
  }

  async query(sql, params) {
    this.queries.push({ sql: sql.trim().replace(/\s+/g, ' '), params });

    if (this._throwOn && sql.includes(this._throwOn)) {
      throw new Error(`Simulated DB error on: ${this._throwOn}`);
    }

    if (sql.includes("status = 'active'") && sql.includes('FOR UPDATE') && !sql.includes('block_id')) {
      return { rows: [] };
    }

    if (sql.includes('FOR UPDATE') && sql.includes('block_id = $2')) {
      if (params && params[0] === 'wrong_user') return { rows: [] };
      if (params && params[1] === 'nonexistent-block') return { rows: [] };
      return { rows: this._rows };
    }

    if (sql.includes('UPDATE study_blocks') && sql.includes('RETURNING *')) {
      // Assert no INSERT and no upsert in the query
      assert.ok(!sql.includes('INSERT'), 'Start path must not INSERT');
      assert.ok(!sql.includes('ON CONFLICT'), 'Start path must not use ON CONFLICT upsert');
      assert.ok(sql.includes('user_id = $2'), 'UPDATE ownership must include user_id');
      
      const PROTECTED = ['title', 'subject', 'topic', 'planned_start', 'planned_end', 'planned_minutes', 'node_id', 'block_id', 'day_key'];
      for (const col of PROTECTED) {
        assert.ok(!sql.includes(`${col} =`), `Protected column ${col} must not be updated`);
      }

      const updateResult = this._updateRows ?? (this._rows.length ? [{
        ...this._rows[0],
        status:     'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }] : []);
      return { rows: updateResult };
    }

    if (sql === 'BEGIN')    return { rows: [] };
    if (sql === 'COMMIT')   { this.committed   = true; return { rows: [] }; }
    if (sql === 'ROLLBACK') { this.rolledBack  = true; return { rows: [] }; }
    return { rows: [] };
  }

  release() {}
}

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

const BLOCK_ID = '2026-07-13__0930__GS_2__1';
const DAY_KEY  = '2026-07-13';
const USER_ID  = 'moulika';

console.log('\n=== B1A Start Metadata Preservation Tests ===\n');

await test('blockId/dayKey-only request — GS-2 and 120m preserved', async () => {
  const persistedRow = makePersistedRow();
  const notifCalls   = [];
  const eventCalls   = [];
  const client = new FakeClient({ rows: [persistedRow] });

  await startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, {
    poolClient: client,
    sendNotification: async (uid, type, src, id, msg) => { notifCalls.push({ uid, type, msg }); },
    logStudyEvent:    async (args) => { eventCalls.push(args); },
    invalidateSuggestionsCache: () => {},
  });

  assert.equal(client.committed,  true);
  assert.equal(client.rolledBack, false);

  assert.equal(notifCalls.length, 1);
  assert.ok(notifCalls[0].msg.includes('GS-2'));
  assert.ok(notifCalls[0].msg.includes('120m'));

  assert.equal(eventCalls.length, 1);
  assert.equal(eventCalls[0].subject, 'GS-2');
  assert.equal(eventCalls[0].metadata.planned_minutes, 120);
});

await test('active block — idempotent return, zero events, zero notifications', async () => {
  const client = new FakeClient({ rows: [makePersistedRow({ status: 'active', started_at: new Date() })] });
  const notifCalls = [];
  const eventCalls = [];

  const result = await startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, {
    poolClient: client,
    sendNotification: async (...a) => { notifCalls.push(a); },
    logStudyEvent:    async (a) => { eventCalls.push(a); },
    invalidateSuggestionsCache: () => {},
  });

  assert.equal(result.status, 'active');
  assert.equal(notifCalls.length, 0);
  assert.equal(eventCalls.length,  0);
  assert.equal(client.committed,  true);
});

await test('paused block — rejected with USE_RESUME code', async () => {
  const client = new FakeClient({ rows: [makePersistedRow({ status: 'paused' })] });

  await assert.rejects(
    () => startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, { poolClient: client }),
    (err) => err.code === 'USE_RESUME'
  );
  assert.equal(client.rolledBack, true);
});

await test('terminal status — rejected with INVALID_TRANSITION', async () => {
  const client = new FakeClient({ rows: [makePersistedRow({ status: 'completed' })] });

  await assert.rejects(
    () => startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, { poolClient: client }),
    (err) => err.code === 'INVALID_TRANSITION'
  );
  assert.equal(client.rolledBack, true);
});

await test('wrong user_id — 404 NOT_FOUND, no commit', async () => {
  const client = new FakeClient({ rows: [makePersistedRow()] });

  await assert.rejects(
    () => startBlock('wrong_user', BLOCK_ID, DAY_KEY, {}, { poolClient: client }),
    (err) => err.code === 'NOT_FOUND'
  );
  assert.equal(client.committed,  false);
  assert.equal(client.rolledBack, true);
});

await test('unknown blockId — 404 NOT_FOUND, no commit, no notification', async () => {
  const client = new FakeClient({ rows: [] });
  const notifCalls = [];

  await assert.rejects(
    () => startBlock(USER_ID, 'nonexistent-block', DAY_KEY, {}, {
      poolClient: client,
      sendNotification: async (...a) => { notifCalls.push(a); },
    }),
    (err) => err.code === 'NOT_FOUND'
  );

  assert.equal(client.committed,   false);
  assert.equal(client.rolledBack,  true);
  assert.equal(notifCalls.length,  0);
});

await test('DB error before commit — rollback, no notification', async () => {
  const client = new FakeClient({
    rows: [makePersistedRow()],
    throwOnQuery: 'SET status',
  });
  const notifCalls = [];

  await assert.rejects(
    () => startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, {
      poolClient: client,
      sendNotification: async (...a) => { notifCalls.push(a); },
    }),
    (err) => err.message.includes('Simulated DB error')
  );

  assert.equal(client.committed,  false);
  assert.equal(client.rolledBack, true);
  assert.equal(notifCalls.length, 0);
});

await test('notification failure after commit — start committed, no rollback', async () => {
  const client = new FakeClient({ rows: [makePersistedRow()] });

  let committedBeforeNotif = false;
  const result = await startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, {
    poolClient: client,
    sendNotification: async () => {
      committedBeforeNotif = client.committed;
      throw new Error('Telegram network error');
    },
    logStudyEvent: async () => {},
    invalidateSuggestionsCache: () => {},
  });

  assert.equal(client.committed,       true);
  assert.equal(client.rolledBack,      false);
  assert.equal(committedBeforeNotif,   true);
  assert.equal(result.status,          'active');
});

await test('logStudyEvent failure after commit — start committed, no rollback, notification proceeds', async () => {
  const client = new FakeClient({ rows: [makePersistedRow()] });

  let notifFired = false;
  const result = await startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, {
    poolClient: client,
    logStudyEvent: async () => {
      throw new Error('Event log error');
    },
    sendNotification: async () => {
      notifFired = true;
    },
    invalidateSuggestionsCache: () => {},
  });

  assert.equal(client.committed,       true);
  assert.equal(client.rolledBack,      false);
  assert.equal(notifFired,             true);
  assert.equal(result.status,          'active');
});

await test('upcoming state — tested and supported', async () => {
  const client = new FakeClient({ rows: [makePersistedRow({ status: 'upcoming' })] });

  const result = await startBlock(USER_ID, BLOCK_ID, DAY_KEY, {}, {
    poolClient: client,
    logStudyEvent: async () => {},
    sendNotification: async () => {},
    invalidateSuggestionsCache: () => {},
  });

  assert.equal(client.committed, true);
  assert.equal(client.rolledBack, false);
  assert.equal(result.status, 'active');
});

await test('skipped_rescue state — tested and supported on same day', async () => {
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const client = new FakeClient({ rows: [makePersistedRow({ status: 'skipped_rescue', day_key: todayKey })] });

  const result = await startBlock(USER_ID, BLOCK_ID, todayKey, {}, {
    poolClient: client,
    logStudyEvent: async () => {},
    sendNotification: async () => {},
    invalidateSuggestionsCache: () => {},
  });

  assert.equal(client.committed, true);
  assert.equal(client.rolledBack, false);
  assert.equal(result.status, 'active');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
