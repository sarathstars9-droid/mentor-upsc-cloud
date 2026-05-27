// backend/verify_moulika_smoke_test.mjs
// Phase 2A smoke test verifier — separates GAS blocks from OCR/uploaded_plan blocks.
// Mapping completeness is computed only for source_type = 'uploaded_plan'.
//
// Usage:
//   node verify_moulika_smoke_test.mjs
//   node verify_moulika_smoke_test.mjs --since 30    (last 30 minutes only)

import { query } from './db/index.js';

const TEST_USER = 'moulika';

// Parse --since N flag
const sinceIdx = process.argv.indexOf('--since');
const sinceMinutes = sinceIdx !== -1 ? Number(process.argv[sinceIdx + 1]) || 30 : null;
const sinceLabel = sinceMinutes ? ` (last ${sinceMinutes} min)` : '';

function sep(label = '') {
  const pad = label ? ` ${label} ` : '';
  const line = '─'.repeat(Math.max(0, 64 - pad.length));
  console.log(`\n${'─'.repeat(4)}${pad}${line}`);
}

function shortMeta(json) {
  if (!json) return '—';
  const s = JSON.stringify(json);
  return s.length > 90 ? s.slice(0, 87) + '...' : s;
}

async function run() {
  console.log('\n================================================================');
  console.log('      MentorOS Moulika Live DB Smoke Test — Phase 2A           ');
  console.log('================================================================');
  if (sinceMinutes) {
    console.log(`  Filter: rows created in the last ${sinceMinutes} minutes`);
  }

  // ── Time filter clause ─────────────────────────────────────────────────────
  const timeClause = sinceMinutes
    ? `AND created_at >= NOW() - INTERVAL '${sinceMinutes} minutes'`
    : '';

  // ── 1. GAS / Google Sheets blocks ─────────────────────────────────────────
  // source_type IS NULL or empty = came through mergeLifecycleIntoGasBlocks
  const gasRes = await query(`
    SELECT id, block_id, day_key, subject, topic,
           syllabus_node_id, mode, status, source_type,
           planned_minutes, mapping_confidence, raw_text,
           created_at
    FROM public.study_blocks
    WHERE user_id = $1
      AND (source_type IS NULL OR source_type = '')
      ${timeClause}
    ORDER BY created_at DESC
    LIMIT 10
  `, [TEST_USER]);

  // ── 2. Uploaded plan / OCR blocks ─────────────────────────────────────────
  const ocrRes = await query(`
    SELECT id, block_id, day_key, subject, topic,
           syllabus_node_id, mode, status, source_type,
           planned_minutes, mapping_confidence, raw_text, output_expected, subtopic,
           created_at
    FROM public.study_blocks
    WHERE user_id = $1
      AND source_type = 'uploaded_plan'
      ${timeClause}
    ORDER BY created_at DESC
    LIMIT 20
  `, [TEST_USER]);

  // ── 3. Study events ────────────────────────────────────────────────────────
  const eventsRes = await query(`
    SELECT event_type, syllabus_node_id, metadata_json, created_at
    FROM public.study_events
    WHERE user_id = $1
      ${timeClause}
    ORDER BY created_at DESC
    LIMIT 20
  `, [TEST_USER]);

  // ── 4. Syllabus node progress ──────────────────────────────────────────────
  const progressRes = await query(`
    SELECT syllabus_node_id, status, planned_minutes, actual_minutes,
           pyq_seen_count, readiness_score, next_action, updated_at
    FROM public.syllabus_node_progress
    WHERE user_id = $1
      ${sinceMinutes ? `AND updated_at >= NOW() - INTERVAL '${sinceMinutes} minutes'` : ''}
    ORDER BY updated_at DESC
    LIMIT 10
  `, [TEST_USER]);

  // ── Metrics — uploaded_plan only ──────────────────────────────────────────
  const ocrBlocks = ocrRes.rows;
  const totalOcr        = ocrBlocks.length;
  const ocrWithNode     = ocrBlocks.filter(b => b.syllabus_node_id && b.syllabus_node_id.trim()).length;
  const ocrMissingNode  = totalOcr - ocrWithNode;
  const ocrBlankMode    = ocrBlocks.filter(b => !b.mode || !b.mode.trim()).length;
  const ocrBlankRawText = ocrBlocks.filter(b => !b.raw_text || !b.raw_text.trim()).length;
  const mappingPct      = totalOcr > 0 ? ((ocrWithNode / totalOcr) * 100).toFixed(1) : 'N/A';

  const genericTerms = ["pyq", "pyqs", "revision", "the hindu", "news", "current affairs", "ca", "day revision", "practice", "mcq", "newspaper", "daily"];
  let overSpecificCount = 0;
  
  const ocrRows = ocrBlocks.map(r => {
    const isGenericText = genericTerms.some(t => (r.raw_text || '').toLowerCase().includes(t)) && (r.raw_text || '').split(" ").length <= 5;
    const isSpecificNode = r.syllabus_node_id && (r.syllabus_node_id.includes('-MT') || r.syllabus_node_id.split('-').length >= 4);
    const isLowMedConf = r.mapping_confidence === 'low' || r.mapping_confidence === 'medium';
    
    const isOverSpecific = isGenericText && isSpecificNode && isLowMedConf;
    if (isOverSpecific) overSpecificCount++;

    return {
      'Day Key'     : r.day_key,
      'Subject'     : r.subject,
      'Mode'        : r.mode || '❌ BLANK',
      'Node ID'     : r.syllabus_node_id ? r.syllabus_node_id.slice(0, 28) : '❌ NULL',
      'Raw Text'    : r.raw_text ? r.raw_text.slice(0, 22) + '…' : '❌ BLANK',
      'Out Expected': r.output_expected ? '✔' : '—',
      'Confidence'  : r.mapping_confidence || '—',
      'Warning'     : isOverSpecific ? '⚠ Over-specific' : '—'
    };
  });

  const events = eventsRes.rows;
  const planAcceptedCount = events.filter(e => e.event_type === 'PLAN_ACCEPTED').length;
  const pyqSeenCount      = events.filter(e => e.event_type === 'PYQ_SEEN').length;
  const progressCount     = progressRes.rows.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A — SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  sep('A. Summary Metrics' + sinceLabel);

  console.log('\n  ── Uploaded Plan / OCR blocks ──────────────────────────────');
  console.log(`     Total uploaded_plan blocks : ${totalOcr}`);
  console.log(`     Mapping completeness       : ${mappingPct}%  (${ocrWithNode}/${totalOcr} have syllabus_node_id)`);
  console.log(`     Missing syllabus_node_id   : ${ocrMissingNode}`);
  console.log(`     Blank mode                 : ${ocrBlankMode}`);
  console.log(`     Blank raw_text             : ${ocrBlankRawText}`);
  console.log(`     Over-specific warnings     : ${overSpecificCount}`);
  console.log(`     PLAN_ACCEPTED events        : ${planAcceptedCount}`);
  console.log(`     PYQ_SEEN events             : ${pyqSeenCount}`);
  console.log(`     syllabus_node_progress rows : ${progressCount}`);

  console.log('\n  ── Google Sheets / GAS blocks ──────────────────────────────');
  console.log(`     Total GAS blocks (latest 10): ${gasRes.rows.length}`);
  console.log(`     Note: GAS blocks are not counted in mapping completeness.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — GAS BLOCKS
  // ═══════════════════════════════════════════════════════════════════════════
  sep('B. Google Sheets / GAS Blocks (latest 10)');
  if (gasRes.rows.length > 0) {
    console.table(gasRes.rows.map(r => ({
      'Day Key' : r.day_key,
      'Subject' : r.subject,
      'Topic'   : (r.topic || '').slice(0, 30),
      'Status'  : r.status,
      'Mins'    : r.planned_minutes,
      'Source'  : r.source_type || 'GAS',
    })));
  } else {
    console.log('  No GAS blocks found' + sinceLabel + '.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C — UPLOADED PLAN / OCR BLOCKS
  // ═══════════════════════════════════════════════════════════════════════════
  sep('C. Uploaded Plan / OCR Blocks (latest 20)' + sinceLabel);
  if (ocrRows.length > 0) {
    console.table(ocrRows);
  } else {
    console.log('  No uploaded_plan blocks found' + sinceLabel + '.');
    if (sinceMinutes) {
      console.log(`  (Uploaded blocks may exist outside the --since ${sinceMinutes} min window.)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D — STUDY EVENTS
  // ═══════════════════════════════════════════════════════════════════════════
  sep('D. Study Events (latest 20)' + sinceLabel);
  if (events.length > 0) {
    console.table(events.map(r => ({
      'Event Type'  : r.event_type,
      'Node ID'     : r.syllabus_node_id ? r.syllabus_node_id.slice(0, 26) : '—',
      'Metadata'    : shortMeta(r.metadata_json),
      'Logged At'   : r.created_at.toISOString().slice(0, 19).replace('T', ' '),
    })));
  } else {
    console.log('  No study events found' + sinceLabel + '.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E — SYLLABUS NODE PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════
  sep('E. Syllabus Node Progress' + sinceLabel);
  if (progressRes.rows.length > 0) {
    console.table(progressRes.rows.map(r => ({
      'Node ID'    : r.syllabus_node_id.slice(0, 30),
      'Status'     : r.status,
      'PYQ Seen'   : r.pyq_seen_count,
      'Readiness'  : `${r.readiness_score}%`,
      'Next Action': r.next_action || '—',
      'Updated'    : r.updated_at.toISOString().slice(0, 19).replace('T', ' '),
    })));
  } else {
    console.log('  No syllabus_node_progress records found' + sinceLabel + '.');
  }

  console.log('\n================================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Error running smoke test:', err.message);
  process.exit(1);
});
