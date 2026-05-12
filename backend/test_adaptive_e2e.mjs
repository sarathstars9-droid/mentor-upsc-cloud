/**
 * Adaptive Intelligence Layer — E2E Verification
 * 
 * 1. POST /api/pyq-intelligence/attempts/bulk  (wrong answers)
 * 2. SELECT node_weakness table
 * 3. GET  /api/adaptive/next-actions
 */

import { query } from './db/index.js';

const BASE = 'http://localhost:8787';
const USER_ID = 'user_1';

// ── 1. POST bulk wrong attempts ───────────────────────────────────────────────
const ATTEMPTS = [
  { questionId: 'pyq_test_q1', nodeId: 'GS1-HIS-MOD-001', subjectId: 'modern_history', stage: 'prelims', year: 2020, selectedAnswer: 'A', correctAnswer: 'B', isCorrect: false, timeTakenSec: 45 },
  { questionId: 'pyq_test_q2', nodeId: 'GS1-HIS-MOD-001', subjectId: 'modern_history', stage: 'prelims', year: 2021, selectedAnswer: 'C', correctAnswer: 'D', isCorrect: false, timeTakenSec: 30 },
  { questionId: 'pyq_test_q3', nodeId: 'GS1-HIS-MOD-001', subjectId: 'modern_history', stage: 'prelims', year: 2022, selectedAnswer: 'B', correctAnswer: 'A', isCorrect: false, timeTakenSec: 50 },
  // Repeated wrong — same questionId wrong again
  { questionId: 'pyq_test_q1', nodeId: 'GS1-HIS-MOD-001', subjectId: 'modern_history', stage: 'prelims', year: 2020, selectedAnswer: 'C', correctAnswer: 'B', isCorrect: false, timeTakenSec: 20 },
  // Second node — polity
  { questionId: 'pyq_pol_q1',  nodeId: 'GS2-POL-PARL-001', subjectId: 'polity',          stage: 'prelims', year: 2019, selectedAnswer: 'D', correctAnswer: 'A', isCorrect: false, timeTakenSec: 40 },
  { questionId: 'pyq_pol_q2',  nodeId: 'GS2-POL-PARL-001', subjectId: 'polity',          stage: 'prelims', year: 2020, selectedAnswer: 'B', correctAnswer: 'C', isCorrect: false, timeTakenSec: 35 },
];

async function postBulkAttempts() {
  console.log('\n── STEP 1: POST bulk wrong attempts ──────────────────────────────');
  const resp = await fetch(`${BASE}/api/pyq-intelligence/attempts/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER_ID, testId: 'adaptive_e2e_test', attempts: ATTEMPTS }),
  });
  const json = await resp.json();
  console.log(`Status: ${resp.status}`, json);
  if (!json.success) throw new Error('Bulk attempt POST failed');
  console.log(`✅  Saved ${json.saved} attempt rows`);
}

async function checkNodeWeaknessTable() {
  console.log('\n── STEP 2: SELECT node_weakness ──────────────────────────────────');
  const r = await query(
    `SELECT node_id, stage, subject, attempts_count, correct_count, wrong_count,
            accuracy_percent, repeated_wrong_count, weakness_score, weakness_level,
            last_attempted_at, updated_at
     FROM node_weakness
     WHERE user_id = $1
     ORDER BY weakness_score DESC`,
    [USER_ID]
  );
  if (r.rows.length === 0) {
    console.log('⚠️  No rows found in node_weakness — weakness scoring may not have run');
  } else {
    console.log(`✅  ${r.rows.length} node(s) found in node_weakness:`);
    r.rows.forEach(row => {
      console.log(`  node_id=${row.node_id}  level=${row.weakness_level}  score=${row.weakness_score}  wrong=${row.wrong_count}  repeated=${row.repeated_wrong_count}  accuracy=${row.accuracy_percent}%`);
    });
  }
  return r.rows;
}

async function getAdaptiveNextActions() {
  console.log('\n── STEP 3: GET /api/adaptive/next-actions ────────────────────────');
  const resp = await fetch(
    `${BASE}/api/adaptive/next-actions?userId=${USER_ID}&stage=prelims&limit=5`
  );
  const json = await resp.json();
  console.log(`Status: ${resp.status}  ok=${json.ok}  count=${json.recommendations?.length ?? 0}`);
  if (json.ok && Array.isArray(json.recommendations)) {
    json.recommendations.forEach((r, i) => {
      console.log(`  [${i+1}] nodeId=${r.nodeId}  level=${r.weaknessLevel}  score=${r.weaknessScore}  type=${r.recommendationType}`);
      console.log(`       action="${r.actionText}"`);
    });
    console.log('\n✅  Adaptive recommendations returned');
  } else {
    console.log('⚠️  No recommendations returned (node_weakness may be empty or all stable)');
  }
  return json;
}

async function run() {
  try {
    await postBulkAttempts();
    // Small delay so async weakness upsert completes
    await new Promise(r => setTimeout(r, 800));
    const rows = await checkNodeWeaknessTable();
    await getAdaptiveNextActions();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅  ADAPTIVE INTELLIGENCE E2E TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('❌  E2E test failed:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}
run();
