import { query } from './db/index.js';

async function clearLocks() {
  console.log("Terminating dangling backends...");
  const res = await query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid != pg_backend_pid() AND datname='mentoros'`);
  console.log(res.rows);
}

clearLocks().then(() => process.exit(0)).catch(console.error);
