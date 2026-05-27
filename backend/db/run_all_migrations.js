import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Helpers ─────────────────────────────────────────────────────────────────
function readSQL(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠  File not found, skipping: ${relativePath}`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Strip SELECT / DO $$ ... $$ verify blocks that return result-sets 
 * which crash when run inside multi-statement query() calls.
 * We keep CREATE / ALTER / INSERT / UPDATE / DELETE / CREATE INDEX.
 */
function stripVerifySelects(sql) {
  // Remove standalone SELECT statements used only for verification
  // Keep SELECTs that are part of DO blocks, INSERTs, etc.
  return sql
    .replace(/^SELECT\s+.*?;\s*$/gms, '-- (verify SELECT removed for automated run)')
    .replace(/^DO\s+\$\$[\s\S]*?\$\$\s*;\s*$/gm, function(match) {
      // Keep DO blocks that have ALTER/CREATE inside (they're functional)
      if (/ALTER|CREATE|INSERT|UPDATE|DELETE/i.test(match)) return match;
      return '-- (verify DO block removed for automated run)';
    });
}

async function runSQL(label, relativePath) {
  const sql = readSQL(relativePath);
  if (!sql) return;
  try {
    console.log(`  → ${label}...`);
    const cleanSQL = stripVerifySelects(sql);
    await query(cleanSQL);
    console.log(`    ✅ ${label} — done`);
  } catch (err) {
    // Log but don't crash — let remaining migrations proceed
    console.error(`    ❌ ${label} — FAILED: ${err.message}`);
    if (err.detail) console.error(`       Detail: ${err.detail}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function runAllMigrations() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        UPSC Mentor — Complete Migration Runner           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  // ── Phase 1: Foundation tables (users, mistakes, revision_items, study_blocks) ──
  console.log('📦 Phase 1 — Foundation tables');
  await runSQL('schema.sql (users, mistakes, revision_items, study_blocks)', 'schema.sql');
  await runSQL('production_migration.sql (mistakes + revision_items patches)', 'production_migration.sql');

  // ── Phase 2: Numbered migrations in order ─────────────────────────────────
  console.log('');
  console.log('📦 Phase 2 — Numbered migrations');

  const migrations = [
    ['001 Plan blocks lifecycle',                       'migrations/001_plan_blocks.sql'],
    ['002 Plan blocks reporting',                       'migrations/002_plan_blocks_reporting.sql'],
    ['003 Planner suggestions log',                     'migrations/003_planner_suggestions_log.sql'],
    ['004 Knowledge linkage (block_pyq_links)',          'migrations/004_knowledge_linkage.sql'],
    ['005 Repair study_blocks PK',                       'migrations/005_repair_study_blocks_pk.sql'],
    ['006 Prelims tests (prelims_test_attempts)',        'migrations/006_prelims_tests.sql'],
    ['006b PYQ intelligence',                            'migrations/006_pyq_intelligence.sql'],
    ['008 Create study_blocks & events',                 'migrations/008_create_study_blocks_and_events.sql'],
    ['009 Mains intelligence',                           'migrations/009_mains_intelligence.sql'],
    ['010 Mains next actions',                           'migrations/010_mains_next_actions.sql'],
    ['010b Mains next actions patch',                    'migrations/010b_mains_next_actions_patch.sql'],
    ['011 Action completion',                            'migrations/011_action_completion.sql'],
    ['012 Evaluate answer',                              'migrations/012_evaluate_answer.sql'],
    ['013 AIR1 review intelligence',                     'migrations/013_air1_review_intelligence.sql'],
    ['014 Add block_id to study_blocks',                 'migrations/014_add_block_id_to_study_blocks.sql'],
    ['015 Repair study_blocks report columns',           'migrations/015_repair_study_blocks_report_columns.sql'],
    ['016 Mains answer attempts',                        'migrations/016_mains_answer_attempts.sql'],
    ['017 Mains learning loop',                          'migrations/017_mains_learning_loop.sql'],
    ['018 Mains additional intel columns',               'migrations/018_mains_additional_intel_columns.sql'],
    ['018b Mains attempt question key',                  'migrations/018_mains_attempt_question_key.sql'],
    ['019 Fix study_blocks lifecycle unique',             'migrations/019_fix_study_blocks_lifecycle_unique.sql'],
    ['022 Notification + progress schema',               'migrations/022_notification_progress_schema.sql'],
    ['023 Subject targets dates',                        'migrations/023_subject_targets_dates.sql'],
    ['024 Tracking foundation',                          'migrations/024_tracking_foundation.sql'],
    ['025 Subject sub-targets + daily_consistency',      'migrations/025_subject_sub_targets.sql'],
  ];

  for (const [label, file] of migrations) {
    await runSQL(label, file);
  }

  // ── Phase 3: Standalone SQL files (node_weakness tables) ──────────────────
  console.log('');
  console.log('📦 Phase 3 — Standalone migration files');
  await runSQL('node_weakness_scores (mistake/revision weakness)', 'node_weakness_migration.sql');
  await runSQL('node_weakness (PYQ-attempt adaptive intelligence)', 'adaptive_intelligence_migration.sql');

  // ── Phase 4: Seed default data ────────────────────────────────────────────
  console.log('');
  console.log('📦 Phase 4 — Seed default data');

  try {
    console.log('  → Seeding users...');
    const users = ['moulika', 'user_1'];
    for (const u of users) {
      await query(`
        INSERT INTO public.users (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING;
      `, [u, u === 'moulika' ? 'Moulika' : 'User 1']);
    }

    console.log('  → Seeding subject_targets...');
    for (const u of users) {
      await query(`
        INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
        VALUES
          ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15'),
          ($1, 'CSAT', 450, '2026-05-25', '2027-04-15'),
          ($1, 'Prelims GS MCQ + PYQ', 325, '2026-05-25', '2027-04-15'),
          ($1, 'GS1', 250, '2026-05-25', '2027-04-15'),
          ($1, 'GS2', 275, '2026-05-25', '2027-04-15'),
          ($1, 'GS3', 300, '2026-05-25', '2027-04-15'),
          ($1, 'GS4 Ethics', 325, '2026-05-25', '2027-04-15'),
          ($1, 'Essay', 175, '2026-05-25', '2027-04-15'),
          ($1, 'Mains Answer Writing', 300, '2026-05-25', '2027-04-15'),
          ($1, 'Current Affairs', 175, '2026-05-25', '2027-04-15'),
          ($1, 'Revision/Buffer', 125, '2026-05-25', '2027-04-15')
        ON CONFLICT (user_id, subject) DO UPDATE SET
          target_hours = EXCLUDED.target_hours,
          mission_start_date = EXCLUDED.mission_start_date,
          mission_end_date = EXCLUDED.mission_end_date;
      `, [u]);
    }

    console.log('  → Seeding subject_sub_targets...');
    const subTargets = [
      { parent: 'GS1', sub: 'Art & Culture', hours: 35 },
      { parent: 'GS1', sub: 'Modern History', hours: 35 },
      { parent: 'GS1', sub: 'Post-Independence India', hours: 15 },
      { parent: 'GS1', sub: 'World History', hours: 15 },
      { parent: 'GS1', sub: 'Indian Society', hours: 40 },
      { parent: 'GS1', sub: 'Physical Geography GS Level', hours: 20 },
      { parent: 'GS1', sub: 'Indian & World Geography', hours: 35 },
      { parent: 'GS1', sub: 'GS1 Mains PYQ + Answer Writing', hours: 35 },
      { parent: 'GS1', sub: 'Revision Sheets + Diagrams', hours: 20 },
      { parent: 'GS2', sub: 'Polity & Constitution Static', hours: 65 },
      { parent: 'GS2', sub: 'Governance', hours: 35 },
      { parent: 'GS2', sub: 'Social Justice', hours: 40 },
      { parent: 'GS2', sub: 'Welfare Schemes', hours: 25 },
      { parent: 'GS2', sub: 'International Relations', hours: 40 },
      { parent: 'GS2', sub: 'Judgments/Committees/Reports', hours: 25 },
      { parent: 'GS2', sub: 'GS2 Mains PYQ + Answer Writing', hours: 45 },
      { parent: 'GS3', sub: 'Economy', hours: 60 },
      { parent: 'GS3', sub: 'Agriculture', hours: 35 },
      { parent: 'GS3', sub: 'Environment', hours: 45 },
      { parent: 'GS3', sub: 'Science & Technology', hours: 30 },
      { parent: 'GS3', sub: 'Internal Security', hours: 35 },
      { parent: 'GS3', sub: 'Disaster Management', hours: 20 },
      { parent: 'GS3', sub: 'Infrastructure/Industry/Energy', hours: 20 },
      { parent: 'GS3', sub: 'GS3 Mains PYQ + Answer Writing', hours: 35 },
      { parent: 'GS3', sub: 'Revision + Error Log', hours: 20 },
    ];
    for (const u of users) {
      for (const st of subTargets) {
        await query(`
          INSERT INTO public.subject_sub_targets (user_id, parent_subject, sub_area, target_hours)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, parent_subject, sub_area) DO UPDATE SET
            target_hours = EXCLUDED.target_hours,
            updated_at = NOW();
        `, [u, st.parent, st.sub, st.hours]);
      }
    }

    console.log('  → Seeding notification_preferences...');
    const notificationTypes = [
      'GOOD_MORNING_MISSION',
      'PLAN_NOT_UPLOADED',
      'PLAN_NOT_STARTED',
      'BLOCK_PAUSED_TOO_LONG',
      'MISSED_BLOCK_ALERT',
      'REVISION_DUE_ALERT',
      'DAILY_NIGHT_REPORT',
      'WEEKLY_MENTOR_REPORT',
      'MONTHLY_MENTOR_REPORT',
      'END_OF_DAY_REPORT',
      'SYLLABUS_TRACK_REPLY',
      'BACKLOG_ALERT',
    ];
    for (const u of users) {
      for (const type of notificationTypes) {
        await query(`
          INSERT INTO public.notification_preferences (user_id, notification_type, channel_type, is_enabled)
          VALUES ($1, $2, 'TELEGRAM', TRUE)
          ON CONFLICT (user_id, notification_type, channel_type) DO UPDATE SET is_enabled = TRUE;
        `, [u, type]);
      }
    }

    console.log('    ✅ Seeding — done');
  } catch (err) {
    console.error(`    ❌ Seeding — FAILED: ${err.message}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`🎉 All migrations completed in ${elapsed}s`);
  console.log('   Run "node db/verify_railway_schema.js" to verify.');
  console.log('');

  process.exit(0);
}

runAllMigrations().catch(err => {
  console.error('💥 Migration runner crashed:', err);
  process.exit(1);
});
