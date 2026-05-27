import { query } from './index.js';

// ── Tables the app requires ─────────────────────────────────────────────────
const REQUIRED_TABLES = [
  'users',
  'study_blocks',
  'mistakes',
  'revision_items',
  'prelims_test_attempts',
  'prelims_test_responses',
  'node_weakness',
  'node_weakness_scores',
  'subject_targets',
  'notification_channels',
  'notification_preferences',
  'notification_events',
  'subject_sub_targets',
  'daily_consistency',
  'plan_block_events',
  'mains_answers',
  'pyq_explanations',
  'planner_suggestions_log',
  'block_logs',
  'study_events',
  'syllabus_node_progress',
  'backlog_items',
];

async function verifySchema() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       UPSC Mentor — Railway Schema Verification          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // 1. Check connectivity
    const timeRes = await query('SELECT NOW() AS now');
    console.log(`🔗 Connected to database. Server time: ${timeRes.rows[0].now}`);
    console.log('');

    // 2. Fetch all tables in public schema
    const tableRes = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = new Set(tableRes.rows.map(r => r.table_name));

    console.log(`📊 Found ${existingTables.size} tables in public schema:`);
    for (const t of [...existingTables].sort()) {
      console.log(`   • ${t}`);
    }
    console.log('');

    // 3. Verify required tables
    let missing = 0;
    let present = 0;

    console.log('🔍 Checking required tables:');
    for (const table of REQUIRED_TABLES) {
      if (existingTables.has(table)) {
        console.log(`   ✅ ${table}`);
        present++;
      } else {
        console.log(`   ❌ ${table} — MISSING`);
        missing++;
      }
    }

    // 4. Row counts for key tables
    console.log('');
    console.log('📈 Row counts for key tables:');
    for (const table of REQUIRED_TABLES) {
      if (!existingTables.has(table)) continue;
      try {
        const countRes = await query(`SELECT COUNT(*) AS cnt FROM public."${table}"`);
        console.log(`   ${table}: ${countRes.rows[0].cnt} rows`);
      } catch (err) {
        console.log(`   ${table}: (count failed — ${err.message})`);
      }
    }

    // 5. Summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    if (missing === 0) {
      console.log(`✅ ALL ${present} required tables exist. Schema is complete.`);
    } else {
      console.log(`❌ ${missing} required table(s) MISSING out of ${REQUIRED_TABLES.length}.`);
      console.log(`   Run "node db/run_all_migrations.js" to create them.`);
    }
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    process.exit(missing > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Verification failed — cannot connect to database:', err.message);
    if (err.hint) console.error('   Hint:', err.hint);
    process.exit(1);
  }
}

verifySchema();
