// backend/cleanup_test_rows.mjs
// Safe cleanup of Phase 2A test/legacy rows for moulika on a specific date.
//
// Modes:
//   1. Default (no extra flag):
//      Deletes rows WHERE source_type = 'uploaded_plan'
//
//   2. --include-legacy-empty flag:
//      ALSO deletes rows WHERE:
//        (source_type IS NULL OR source_type = '')
//        AND (mode IS NULL OR mode = '')
//        AND (syllabus_node_id IS NULL OR syllabus_node_id = '')
//      These are pre-Phase-2A legacy blank blocks.
//      Prints them before deleting and requires the explicit flag.
//
// Column types (verified from information_schema):
//   study_blocks.id       = uuid   ← PK used to join dependents
//   study_blocks.block_id = text   ← stable string ID (display only)
//   study_blocks.day_key  = text
//   block_logs.block_id   = uuid   → matches study_blocks.id
//   study_events.block_id = uuid   → matches study_blocks.id
//   backlog_items         → no block_id; delete by user+date
//   revision_items        → source_id is text; skipped (no safe relation)
//
// Safety:
//   - All deletes in one BEGIN/COMMIT with ROLLBACK on error
//   - subject_targets: never touched
//   - revision_items: never touched
//   - Other dates: never touched
//
// Usage:
//   node cleanup_test_rows.mjs 2026-05-26
//   node cleanup_test_rows.mjs 2026-05-26 --include-legacy-empty

import { pool } from './db/index.js';

const TEST_USER  = 'moulika';
const TEST_DATE  = process.argv[2] || new Date().toISOString().slice(0, 10);
const INCLUDE_LEGACY = process.argv.includes('--include-legacy-empty');

// ── helpers ──────────────────────────────────────────────────────────────────

function printBlocks(label, blocks) {
  if (!blocks.length) {
    console.log(`  (none)`);
    return;
  }
  for (const b of blocks) {
    console.log(`  uuid: ${b.id}`);
    console.log(`  block_id: ${b.block_id}`);
    console.log(`  ${b.subject || '(no subject)'} / "${b.topic || ''}"  mode=${b.mode || 'null'}  node=${b.syllabus_node_id || 'null'}  source=${b.source_type || 'null'}`);
    console.log('');
  }
}

async function deleteRelated(client, label, blockUuids, testDate, testUser) {
  // block_logs: block_id is uuid = study_blocks.id
  const blRes = await client.query(
    `DELETE FROM public.block_logs WHERE block_id = ANY($1::uuid[])`,
    [blockUuids]
  );
  console.log(`🗑  [${label}] block_logs deleted:   ${blRes.rowCount}`);

  // study_events: block_id is uuid; also catch NULL-block overall PLAN_ACCEPTED for this date
  const evRes = await client.query(
    `DELETE FROM public.study_events
     WHERE user_id = $1
       AND (
         block_id = ANY($2::uuid[])
         OR (
           block_id IS NULL
           AND event_type = 'PLAN_ACCEPTED'
           AND (metadata_json->>'date') = $3
         )
       )`,
    [testUser, blockUuids, testDate]
  );
  console.log(`🗑  [${label}] study_events deleted: ${evRes.rowCount}`);

  // backlog_items: no block_id, delete by user+date
  const biRes = await client.query(
    `DELETE FROM public.backlog_items
     WHERE user_id = $1 AND DATE(created_at) = $2::date`,
    [testUser, testDate]
  );
  console.log(`🗑  [${label}] backlog_items deleted: ${biRes.rowCount}`);

  // syllabus_node_progress: delete for affected nodes only on this date
  // (only if uuids came with mapped nodes — safe to skip if none)
  return { blRes, evRes, biRes };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function cleanupTestRows() {
  const client = await pool.connect();
  try {
    console.log(`\n🧹 Cleanup target: user=${TEST_USER}, date=${TEST_DATE}`);
    if (INCLUDE_LEGACY) {
      console.log('   Mode: uploaded_plan rows  +  legacy blank rows (--include-legacy-empty)');
    } else {
      console.log('   Mode: uploaded_plan rows only');
      console.log('   Tip:  Add --include-legacy-empty to also clean pre-Phase-2A blank rows.');
    }
    console.log('');

    // ── Fetch uploaded_plan blocks ──────────────────────────────────────────
    const { rows: uploadedBlocks } = await client.query(
      `SELECT id, block_id, subject, topic, mode, syllabus_node_id, source_type
       FROM public.study_blocks
       WHERE user_id     = $1
         AND day_key     = $2
         AND source_type = 'uploaded_plan'`,
      [TEST_USER, TEST_DATE]
    );

    // ── Fetch legacy blank blocks (only if flag set) ─────────────────────────
    let legacyBlocks = [];
    if (INCLUDE_LEGACY) {
      const { rows } = await client.query(
        `SELECT id, block_id, subject, topic, mode, syllabus_node_id, source_type
         FROM public.study_blocks
         WHERE user_id = $1
           AND day_key = $2
           AND (source_type IS NULL OR source_type = '')
           AND (mode IS NULL OR mode = '')
           AND (syllabus_node_id IS NULL OR syllabus_node_id = '')`,
        [TEST_USER, TEST_DATE]
      );
      legacyBlocks = rows;
    }

    // ── Print preview ────────────────────────────────────────────────────────
    const totalToDelete = uploadedBlocks.length + legacyBlocks.length;

    console.log(`── uploaded_plan blocks (${uploadedBlocks.length}) ─────────────────`);
    printBlocks('uploaded_plan', uploadedBlocks);

    if (INCLUDE_LEGACY) {
      console.log(`── legacy blank blocks (${legacyBlocks.length}) ──────────────────`);
      printBlocks('legacy-empty', legacyBlocks);
    }

    if (totalToDelete === 0) {
      console.log('✔ Nothing to delete. DB is already clean for this date.');
      await pool.end();
      return;
    }

    // ── BEGIN TRANSACTION ────────────────────────────────────────────────────
    await client.query('BEGIN');

    let totalBlocksDeleted = 0;

    // ── Delete uploaded_plan group ───────────────────────────────────────────
    if (uploadedBlocks.length > 0) {
      const uuids = uploadedBlocks.map(b => b.id);
      await deleteRelated(client, 'uploaded_plan', uuids, TEST_DATE, TEST_USER);

      const sbRes = await client.query(
        `DELETE FROM public.study_blocks
         WHERE user_id     = $1
           AND day_key     = $2
           AND source_type = 'uploaded_plan'`,
        [TEST_USER, TEST_DATE]
      );
      console.log(`🗑  [uploaded_plan] study_blocks deleted: ${sbRes.rowCount}`);
      totalBlocksDeleted += sbRes.rowCount;
    }

    // ── Delete legacy blank group ─────────────────────────────────────────────
    if (INCLUDE_LEGACY && legacyBlocks.length > 0) {
      const uuids = legacyBlocks.map(b => b.id);
      await deleteRelated(client, 'legacy-empty', uuids, TEST_DATE, TEST_USER);

      const sbRes = await client.query(
        `DELETE FROM public.study_blocks
         WHERE user_id = $1
           AND day_key = $2
           AND (source_type IS NULL OR source_type = '')
           AND (mode IS NULL OR mode = '')
           AND (syllabus_node_id IS NULL OR syllabus_node_id = '')`,
        [TEST_USER, TEST_DATE]
      );
      console.log(`🗑  [legacy-empty] study_blocks deleted: ${sbRes.rowCount}`);
      totalBlocksDeleted += sbRes.rowCount;
    }

    // ── COMMIT ───────────────────────────────────────────────────────────────
    await client.query('COMMIT');

    console.log(`\n✅ Cleanup committed.`);
    console.log(`   Total study_blocks deleted: ${totalBlocksDeleted}`);
    console.log(`   subject_targets: NOT touched`);
    console.log(`   revision_items:  NOT touched (no safe relation)`);
    console.log(`   Other dates:     NOT touched\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Cleanup FAILED — transaction rolled back.');
    console.error('   Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupTestRows();
