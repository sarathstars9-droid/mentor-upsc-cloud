// Run migration for node_weakness table
import { query } from './db/index.js';

async function migrate() {
  try {
    await query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS node_weakness (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id               TEXT        NOT NULL,
        node_id               TEXT        NOT NULL,
        stage                 TEXT        DEFAULT 'prelims',
        subject               TEXT,
        attempts_count        INT         NOT NULL DEFAULT 0,
        correct_count         INT         NOT NULL DEFAULT 0,
        wrong_count           INT         NOT NULL DEFAULT 0,
        accuracy_percent      NUMERIC     NOT NULL DEFAULT 0,
        repeated_wrong_count  INT         NOT NULL DEFAULT 0,
        weakness_score        NUMERIC     NOT NULL DEFAULT 0,
        weakness_level        TEXT        NOT NULL DEFAULT 'stable',
        last_attempted_at     TIMESTAMPTZ,
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, node_id, stage)
      );
    `);
    console.log('✅ node_weakness table created');

    await query(`CREATE INDEX IF NOT EXISTS idx_node_weakness_user ON node_weakness (user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_node_weakness_user_score ON node_weakness (user_id, weakness_score DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_node_weakness_level ON node_weakness (user_id, weakness_level)`);
    console.log('✅ Indexes created');

    const cols = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'node_weakness'
      ORDER BY ordinal_position
    `);
    console.log('✅ node_weakness columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
