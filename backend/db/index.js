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
// Railway Postgres always requires SSL. Detect Railway by checking NODE_ENV=production
// OR by checking if the URL is a Railway private/public URL.
// We also honour DB_SSL=true for explicit local SSL testing.
const isRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||         // set automatically by Railway
  process.env.RAILWAY_PROJECT_ID ||          // set automatically by Railway
  (DATABASE_URL && (DATABASE_URL.includes("railway.app") || DATABASE_URL.includes("rlwy.net") || DATABASE_URL.includes("railway.internal")))
);
const isProduction = process.env.NODE_ENV === "production" || isRailway;
const isRailwayPublic = DATABASE_URL && (DATABASE_URL.includes("railway.app") || DATABASE_URL.includes("rlwy.net"));
export const sslConfig = (process.env.DB_SSL === "true" || isRailwayPublic)
  ? { rejectUnauthorized: false }   // Public Railway proxy requires SSL
  : false;

export let activeDbSsl = sslConfig !== false ? "enabled" : "disabled";

console.log("[DB INIT]", {
  DATABASE_URL: DATABASE_URL ? DATABASE_URL.replace(/:\/\/[^@]+@/, "://<redacted>@") : "MISSING",
  ssl: activeDbSsl,
  activeDbHost,
  activeDbPort,
  activeDbSsl,
  activeDbSource,
  isRailway,
  isProduction,
  pool_max: Number(process.env.DB_POOL_MAX || 10),
});

// ── Pool ────────────────────────────────────────────────────────────────────
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("[POSTGRES POOL ERROR]", {
    message: err.message,
    code: err.code,
    detail: err.detail,
  });
});

// ── Startup connectivity check ───────────────────────────────────────────────
// Runs once when this module is first imported. Logs clearly on success/failure.
(async () => {
  if (!DATABASE_URL) return; // already logged above
  try {
    const res = await pool.query("SELECT NOW() AS now");
    console.log("[DB CONNECTED] Postgres is live. Server time:", res.rows[0].now);
  } catch (err) {
    console.error("[DB CONNECTION FAILED]", {
      message: err.message || "(empty message)",
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      stack: err.stack,
    });
    console.error(
      "[DB HINT] Check: (1) DATABASE_URL is correct in Railway Variables, " +
      "(2) the Postgres plugin is active, (3) DB_SSL is not blocking the connection."
    );
  }
})();

// ── Query helper ─────────────────────────────────────────────────────────────
export async function query(text, params = []) {
  try {
    const res = await pool.query(text, params);
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbSuccess();
    } catch (e) {}
    return res;
  } catch (err) {
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbFailure();
    } catch (e) {}
    throw err;
  }
}

// ── Transaction helper ────────────────────────────────────────────────────────
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbSuccess();
    } catch (e) {}
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    try {
      const { healthMonitor } = await import("../services/healthMonitor.js");
      healthMonitor.recordDbFailure();
    } catch (e) {}
    throw err;
  } finally {
    client.release();
  }
}

// ── Named export for health/debug checks ─────────────────────────────────────
export async function testConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0].now;
}
