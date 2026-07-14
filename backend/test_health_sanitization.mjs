import assert from 'node:assert/strict';
import { healthMonitor } from './services/healthMonitor.js';
import { isProduction, rejectInProduction } from './utils/productionGuard.js';

// ── Forbidden keys at any depth in a response body ───────────────────────────
const FORBIDDEN_KEYS = new Set([
  'activeDbHost', 'activeDbPort', 'activeDbSsl', 'activeDbSource',
  'lastSuccessfulDbQueryTime', 'lastSuccessfulSchedulerRun',
  'lastSuccessfulTelegramSend', 'lastSuccessfulNotification',
  'recentFailureCount', 'unsentHeartbeatAlert',
  'commit', 'mountPath', 'storage', 'env', 'message', 'error',
]);

function forbiddenKeysPresent(obj, path = '') {
  if (obj === null || typeof obj !== 'object') return [];
  const hits = [];
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(k)) hits.push(`${path}.${k}`);
    hits.push(...forbiddenKeysPresent(obj[k], `${path}.${k}`));
  }
  return hits;
}

// ── Helper: build a minimal fake req/res pair ────────────────────────────────
function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json   = (body) => { res._body = body; return res; };
  return res;
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

console.log('\n=== Health Endpoint Sanitization Tests ===\n');

// Wrap real health monitor stubbing
async function withStubbedHealth(stubbedResult, fn) {
  const original = healthMonitor.getHealthStatus;
  healthMonitor.getHealthStatus = async () => stubbedResult;
  try {
    await fn();
  } finally {
    healthMonitor.getHealthStatus = original;
  }
}

const mockHealthyFull = {
  database: 'Healthy',
  scheduler: 'Healthy',
  telegram: 'Healthy',
  lastSuccessfulDbQueryTime: new Date(),
  lastSuccessfulSchedulerRun: new Date(),
  lastSuccessfulTelegramSend: new Date(),
  lastSuccessfulNotification: null,
  recentFailureCount: 0,
  unsentHeartbeatAlert: null,
  activeDbHost: 'secret-host.railway.internal',
  activeDbPort: '5432',
  activeDbSsl: 'true',
  activeDbSource: 'private',
};

// ── Tests ────────────────────────────────────────────────────────────────────

await test('toPublicSummary() is a projection of getHealthStatus() — all healthy', async () => {
  await withStubbedHealth(mockHealthyFull, async () => {
    const pub = await healthMonitor.toPublicSummary();
    assert.equal(pub.database, 'Healthy');
    assert.equal(pub.scheduler, 'Healthy');
    assert.equal(pub.telegram, 'Healthy');
    assert.equal(pub.status, 'healthy');
  });
});

await test('toPublicSummary() status=degraded when DB fails', async () => {
  await withStubbedHealth({ ...mockHealthyFull, database: 'Failed' }, async () => {
    const pub = await healthMonitor.toPublicSummary();
    assert.equal(pub.database, 'Failed');
    assert.equal(pub.status, 'degraded');
  });
});

await test('toPublicSummary() response contains exactly 4 keys and no forbidden keys', async () => {
  await withStubbedHealth(mockHealthyFull, async () => {
    const pub = await healthMonitor.toPublicSummary();
    const keys = Object.keys(pub).sort();
    assert.deepEqual(keys, ['database', 'scheduler', 'status', 'telegram'].sort());
    
    const hits = forbiddenKeysPresent(pub);
    assert.equal(hits.length, 0, `Forbidden keys found: ${hits.join(', ')}`);
  });
});

// Guard tests helper
async function withEnv(envObj, fn) {
  const original = {};
  for (const k of Object.keys(envObj)) {
    original[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
    process.env[k] = envObj[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(envObj)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

await test('rejectInProduction returns 404 when NODE_ENV=production', async () => {
  await withEnv({ NODE_ENV: 'production' }, async () => {
    assert.equal(isProduction(), true);
    const res = makeRes();
    let nextCalled = false;
    rejectInProduction({}, res, () => { nextCalled = true; });
    assert.equal(res._status, 404);
    assert.equal(nextCalled, false);
  });
});

await test('rejectInProduction returns 404 when RAILWAY_ENVIRONMENT_NAME=production', async () => {
  await withEnv({ RAILWAY_ENVIRONMENT_NAME: 'production' }, async () => {
    assert.equal(isProduction(), true);
    const res = makeRes();
    let nextCalled = false;
    rejectInProduction({}, res, () => { nextCalled = true; });
    assert.equal(res._status, 404);
    assert.equal(nextCalled, false);
  });
});

await test('rejectInProduction returns 404 when RAILWAY_ENVIRONMENT=production', async () => {
  await withEnv({ RAILWAY_ENVIRONMENT: 'production' }, async () => {
    assert.equal(isProduction(), true);
    const res = makeRes();
    let nextCalled = false;
    rejectInProduction({}, res, () => { nextCalled = true; });
    assert.equal(res._status, 404);
    assert.equal(nextCalled, false);
  });
});

await test('rejectInProduction calls next() in non-production', async () => {
  // Clear any existing markers that might leak from true runtime env
  await withEnv({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'development', RAILWAY_ENVIRONMENT: 'development' }, async () => {
    assert.equal(isProduction(), false);
    const res = makeRes();
    let nextCalled = false;
    rejectInProduction({}, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
