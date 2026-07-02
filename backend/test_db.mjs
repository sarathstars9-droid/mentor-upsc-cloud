import { query } from './db/index.js';
async function run() {
  try {
    console.log('\n--- Columns in guardian_daily_phone_usage ---');
    const cols = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'guardian_daily_phone_usage';
    `);
    console.table(cols.rows);

    console.log('\n--- Indexes in guardian_daily_phone_usage ---');
    const idxs = await query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'guardian_daily_phone_usage';
    `);
    console.table(idxs.rows);

    console.log('\n--- Latest 20 usage rows for moulika ---');
    const rows = await query(`
      SELECT user_id, device_id, date, app_package, duration_seconds, updated_at
      FROM public.guardian_daily_phone_usage
      WHERE user_id = 'moulika'
      ORDER BY updated_at DESC
      LIMIT 20;
    `);
    console.table(rows.rows);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
