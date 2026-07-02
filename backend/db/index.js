import "dotenv/config";

// Delete standard pg env vars to prevent pg module from overriding DATABASE_URL with private/internal defaults injected by Railway
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;

import pg from "pg";

const { Pool } = pg;

// ── Startup validation ──────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "[DB FATAL] DATABASE_URL is not set. " +
    "In Railway: go to Variables → add DATABASE_URL from your Postgres plugin. " +
    "Locally: ensure .env contains DATABASE_URL."
  );
  // Don't crash the process here so /health can still respond, but all DB calls will fail.
}

// Parse active host/port from DATABASE_URL
export let activeDbHost = "";
export let activeDbPort = "";
export let activeDbSource = "DATABASE_URL";

if (DATABASE_URL) {
  try {
    const parsed = new URL(DATABASE_URL);
    activeDbHost = parsed.hostname;
    activeDbPort = parsed.port || "5432";
  } catch (e) {
    activeDbHost = "Failed to parse DATABASE_URL";
  }
}

// ── SSL config ──────────────────────────────────────────────────────────────
const isRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PROJECT_ID ||
  (DATABASE_URL && (DATABASE_URL.includes("railway.app") || DATABASE_URL.includes("rlwy.net") || DATABASE_URL.includes("railway.internal")))
);
const isProduction = process.env.NODE_ENV === "production" || isRailway;
const isRailwayPublic = DATABASE_URL && (DATABASE_URL.includes("railway.app") || DATABASE_URL.includes("rlwy.net"));

const mainScript = process.argv[1] || '';
const isReadOnlySchemaVerify = mainScript.includes('verify_railway_schema') && process.env.ALLOW_PROD_SCHEMA_VERIFY === 'true';
const isTestRunnerScript = /(test_|verify_|seed_|cleanup_)/i.test(mainScript) && !isReadOnlySchemaVerify;

if (isTestRunnerScript && isRailway && process.env.ALLOW_PROD_TEST_WRITE !== 'true') {
  console.error(`💥 [SAFETY GUARD FATAL] Test script "${mainScript}" attempted to connect to Production Railway DB! Aborting.`);
  process.exit(1);
}

export const sslConfig = (process.env.DB_SSL === "true" || isRailwayPublic)
  ? { rejectUnauthorized: false }
  : false;

export let activeDbSsl = sslConfig !== false ? "enabled" : "disabled";

console.log("[DB INIT]", {
  DATABASE_URL: DATABASE_URL ? DATABASE_URL.replace(/:\/\/[^@]+@/, "://<redacted>@") : "MISSING",
  ssl: activeDbSsl,
  activeDbHost,
  activeDbPort,
  pool_max: 5,
});

// ── Pool ────────────────────────────────────────────────────────────────────
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  max: 5, // max pool size 5 as requested
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // connectionTimeoutMillis 5000 as requested
  statement_timeout: 8000, // statement_timeout 8000 as requested
  query_timeout: 10000, // query_timeout 10000 as requested
});

pool.on("error", (err) => {
  console.error("[POSTGRES POOL ERROR]", {
    message: err.message,
    code: err.code,
    detail: err.detail,
  });
});

// ── Circuit Breaker State ───────────────────────────────────────────────────
let circuitOpen = false;
let circuitOpenTimestamp = 0;
let consecutiveFailures = 0;
const CIRCUIT_OPEN_DURATION_MS = 30000;
const MAX_FAILURES = 3;

function isTransientError(err) {
  const codes = ['08003', '08006', '08001', '08004', '08P01', '57P01', '57P02', '57P03'];
  if (err.code && codes.includes(err.code)) return true;
  if (err.message && (
    err.message.includes('timeout') ||
    err.message.includes('connection refused') ||
    err.message.includes('Connection terminated') ||
    err.message.includes('terminating connection') ||
    err.message.includes('socket hung up') ||
    err.message.includes('Client was closed')
  )) {
    return true;
  }
  return false;
}

export function recordSuccess() {
  consecutiveFailures = 0;
  if (circuitOpen) {
    console.log("[DB CIRCUIT BREAKER] Circuit closed (recovered). DB operations normal.");
    circuitOpen = false;
  }
}

export function recordFailure(err) {
  if (isTransientError(err)) {
    consecutiveFailures++;
    console.warn(`[DB CIRCUIT BREAKER] Transient failure recorded (${consecutiveFailures}/${MAX_FAILURES}): ${err.message}`);
    if (consecutiveFailures >= MAX_FAILURES && !circuitOpen) {
      circuitOpen = true;
      circuitOpenTimestamp = Date.now();
      console.error(`[DB CIRCUIT BREAKER] Circuit OPENED due to ${consecutiveFailures} consecutive failures. Non-critical DB operations suspended for 30s.`);
    }
  }
}

export function isDbCircuitOpen() {
  if (circuitOpen) {
    const elapsed = Date.now() - circuitOpenTimestamp;
    if (elapsed > CIRCUIT_OPEN_DURATION_MS) {
      console.log("[DB CIRCUIT BREAKER] Half-open state. Will attempt queries.");
      circuitOpen = false;
      consecutiveFailures = 0; // reset to try again
      return false;
    }
    return true;
  }
  return false;
}

// ── Startup connectivity check ───────────────────────────────────────────────
(async () => {
  if (!DATABASE_URL) return;
  try {
    const res = await pool.query("SELECT NOW() AS now");
    console.log("[DB CONNECTED] Postgres is live. Server time:", res.rows[0].now);
  } catch (err) {
    console.error("[DB CONNECTION FAILED]", {
      message: err.message || "(empty message)",
      code: err.code,
    });
  }
})();

// ── Query helpers ─────────────────────────────────────────────────────────────
export async function query(text, params = []) {
  if (isDbCircuitOpen()) {
    throw Object.assign(
      new Error(`[DB CIRCUIT OPEN] Query skipped to prevent DB storm.`),
      { code: 'CIRCUIT_OPEN', isTransient: true }
    );
  }
  
  try {
    const res = await pool.query(text, params);
    recordSuccess();
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbSuccess();
    } catch (e) {}
    return res;
  } catch (err) {
    recordFailure(err);
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbFailure();
    } catch (e) {}
    throw err;
  }
}

export async function criticalQuery(text, params = []) {
  try {
    const res = await pool.query(text, params);
    recordSuccess();
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbSuccess();
    } catch (e) {}
    return res;
  } catch (err) {
    recordFailure(err);
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbFailure();
    } catch (e) {}
    throw err;
  }
}

export async function withTransaction(callback) {
  if (isDbCircuitOpen()) {
    throw Object.assign(
      new Error(`[DB CIRCUIT OPEN] Transaction skipped to prevent DB storm.`),
      { code: 'CIRCUIT_OPEN', isTransient: true }
    );
  }
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    recordSuccess();
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbSuccess();
    } catch (e) {}
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    recordFailure(err);
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbFailure();
    } catch (e) {}
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0].now;
}
