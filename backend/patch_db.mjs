import { query } from './db/index.js';
async function run() {
  try {
    console.log('\n--- Patching Railway DB Schema ---');
    await query(`
      ALTER TABLE public.guardian_daily_phone_usage
      ADD COLUMN IF NOT EXISTS device_id VARCHAR(255) DEFAULT 'default_device';
    `);
    
    await query(`
      UPDATE public.guardian_daily_phone_usage
      SET device_id = 'default_device'
      WHERE device_id IS NULL;
    `);

    await query(`DROP INDEX IF EXISTS uniq_guardian_daily_phone_usage;`);
    await query(`DROP INDEX IF EXISTS uniq_guardian_daily_phone_usage_v2;`);
    
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_guardian_daily_phone_usage_v2
      ON public.guardian_daily_phone_usage (user_id, device_id, date, app_package);
    `);

    console.log('✅ DB Schema patched successfully.');

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

  } catch (e) {
    console.error('Failed to patch schema:', e);
  } finally {
    process.exit(0);
  }
}
run();
