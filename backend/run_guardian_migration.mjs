// backend/run_guardian_migration.mjs
import 'dotenv/config';
import { query } from './db/index.js';

async function migrate() {
  try {
    console.log('[Migration] Creating guardian_phone_usage_events table...');
    await query(`
      CREATE TABLE IF NOT EXISTS public.guardian_phone_usage_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        block_id TEXT NOT NULL,
        app_package TEXT NOT NULL,
        app_name TEXT NOT NULL,
        category TEXT DEFAULT 'distraction',
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        severity TEXT DEFAULT 'medium'
      );
    `);
    console.log('✅ guardian_phone_usage_events table created');

    console.log('[Migration] Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_guardian_phone_usage_user_block 
      ON public.guardian_phone_usage_events(user_id, block_id);
    `);
    console.log('✅ Indexes created successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
