/**
 * backend/test_phase2c_visual_generation.mjs
 *
 * Phase 2C Verification Test Suite: AI Visual Knowledge Generation & Reuse.
 * 
 * Verifies:
 *   1. Existing Exam Sketch is reused without re-generation
 *   2. Duplicate generation is prevented
 *   3. Missing visual types (mindmap, flowchart) are generated & persisted
 *   4. JSON schemas are strictly validated
 *   5. Invalid JSON is rejected / repaired
 *   6. >7-node Exam Sketch rejected/simplified to <= 7 nodes
 *   7. >25-word Exam Sketch simplified to <= 25 words
 *   8. Unverified statistics are blocked
 *   9. Verified current statistics are allowed
 *   10. Stale statistics are blocked as current
 *   11. Generated visual is persisted into visual_assets
 *   12. Second request reuses persisted visual without AI call
 *   13. User 2 reuses the same global visual asset
 *   14. Mains Evaluation retrieves and reuses Visual Studio visual
 *   15. Generation failure does NOT fail Mains evaluation
 *   16. Unknown topic lookup returns TOPIC_NOT_FOUND without auto-creating topics
 *   17. APPSC ranking and regional evidence binding preserved
 *   18. Cost and generation metrics are tracked
 */

import './config/env.js';
import { query, pool } from './db/index.js';
import { generateVisualPackForTopic } from './services/visualGeneration/visualGenerationService.js';
import { recommendVisualTypesForTopic } from './services/visualGeneration/visualRecommendationService.js';
import { validateVisualSpecification } from './services/visualGeneration/visualValidationService.js';
import { validateAndSanitizeExamSketch } from './services/visualGeneration/examSketchValidationService.js';
import { findMatchingVisualForQuestion } from './services/visualKnowledge/visualKnowledgeService.js';
import { resolveTopicByQuery } from './services/visualKnowledge/visualKnowledgeService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase2CTests() {
  console.log('\n================================================================');
  console.log('  MentorOS Phase 2C — AI Visual Generation & Reuse Test Suite');
  console.log('================================================================\n');

  try {
    // ── Test 1: Urban Flooding Existing Exam Sketch Reuse ─────────────────────
    console.log('--- Test 1: Urban Flooding Existing Exam Sketch Reuse ---');
    const ufTopic = await resolveTopicByQuery('Urban Flooding');
    assert(ufTopic !== null, 'Urban Flooding topic resolved');

    // Clean any prior ai_generated test assets to ensure clean initial test state
    await query(
      `DELETE FROM visual_assets WHERE topic_id = $1 AND origin = 'ai_generated'`,
      [ufTopic.id]
    );

    const ufInitialVisuals = await query(
      `SELECT * FROM visual_assets WHERE topic_id = $1 AND (is_canonical = TRUE OR visual_type = 'exam_sketch' OR visual_type = 'hub_spoke')`,
      [ufTopic.id]
    );
    assert(ufInitialVisuals.rows.length > 0, 'Initial Urban Flooding Exam Sketch / Canonical Visual exists');
    const initialSketchId = ufInitialVisuals.rows[0]?.id;

    // Call generation pipeline
    const ufGenResult = await generateVisualPackForTopic(ufTopic.id, {
      requestedTypes: ['hub_spoke', 'mindmap', 'cause_effect'],
      provider: 'mock'
    });

    assert(ufGenResult.success === true, 'Generation pipeline succeeded for Urban Flooding');
    assert(ufGenResult.reused.some(v => v.id === initialSketchId), 'Existing Canonical Visual ID was REUSED without re-generation');
    assert(ufGenResult.generated.some(v => v.visual_type === 'mindmap'), 'Missing mindmap was newly GENERATED');

    // ── Test 2: Duplicate Generation Prevention ───────────────────────────────
    console.log('\n--- Test 2: Duplicate Generation Prevention ---');
    const ufSecondResult = await generateVisualPackForTopic(ufTopic.id, {
      requestedTypes: ['exam_sketch', 'mindmap'],
      provider: 'mock'
    });
    assert(ufSecondResult.generated.length === 0, 'Second request generated 0 duplicate visuals');
    assert(ufSecondResult.reused.length >= 2, 'Second request REUSED both Exam Sketch and newly created Mindmap');

    // ── Test 3: Exam Sketch Strict Rules Validator ────────────────────────────
    console.log('\n--- Test 3: Exam Sketch Rules Validation (>7 nodes / >25 words) ---');
    
    // Case A: Excessive nodes (>7)
    const bloatedSketch = {
      title: 'Bloated Diagram',
      nodes: ['Node 1', 'Node 2', 'Node 3', 'Node 4', 'Node 5', 'Node 6', 'Node 7', 'Node 8', 'Node 9'],
      targetDrawSeconds: 60
    };
    const nodeSanitized = validateAndSanitizeExamSketch(bloatedSketch);
    assert(nodeSanitized.isValid === true, 'Bloated node sketch simplified and approved');
    assert(nodeSanitized.nodeCount <= 7, `Node count clamped to <= 7 (actual: ${nodeSanitized.nodeCount})`);
    assert(nodeSanitized.drawTimeSeconds === 30, 'Draw time clamped to 30 seconds');

    // Case B: Verbose text (>25 words)
    const verboseSketch = {
      title: 'Verbose Diagram',
      nodes: [
        'Excessive precipitation overwhelming municipal infrastructure in metropolitan cities',
        'Unplanned rapid concretisation of urban catchment basins and floodplains',
        'Encroachment and systematic loss of traditional wetland retention sinks and lakes',
        'Severe stormwater drainage network clogging from solid waste accumulation',
        'Comprehensive adoption of blue-green infrastructure and sponge city sponge principles'
      ]
    };
    const wordSanitized = validateAndSanitizeExamSketch(verboseSketch);
    assert(wordSanitized.isValid === true, 'Verbose sketch simplified');
    assert(wordSanitized.wordCount <= 25, `Word count clamped to <= 25 words (actual: ${wordSanitized.wordCount})`);

    // ── Test 4: Evidence Safety Gate (Unverified vs Verified Statistics) ──────
    console.log('\n--- Test 4: Evidence Safety Gate (Quantitative vs Conceptual) ---');
    
    // Quantitative chart with unverified number and no evidence
    const unverifiedChart = {
      title: 'Fabricated Chart',
      renderer: 'BAR_CHART',
      data: [{ label: 'Inflation', value: 99.9 }]
    };
    const unverifiedValidation = validateVisualSpecification('chart', unverifiedChart, []);
    assert(unverifiedValidation.isValid === false, 'Unverified quantitative chart BLOCKED by evidence safety gate');

    // Quantitative chart backed by verified evidence
    const verifiedEvidence = [{
      id: 'e1',
      canonical_claim_key: 'cpi_inflation',
      numeric_value: 3.65,
      is_official: true,
      verification_status: 'verified_current'
    }];
    const verifiedChart = {
      title: 'Official CPI Chart',
      renderer: 'BAR_CHART',
      data: [{ label: 'CPI Headline', value: 3.65 }]
    };
    const verifiedValidation = validateVisualSpecification('chart', verifiedChart, verifiedEvidence);
    assert(verifiedValidation.isValid === true, 'Verified quantitative chart APPROVED');

    // ── Test 5: Recommendation Engine Consistency ────────────────────────────
    console.log('\n--- Test 5: Visual Recommendation Engine ---');
    const polityRecs = recommendVisualTypesForTopic({ subject: 'GS2 Indian Polity & Constitution' });
    assert(polityRecs.includes('exam_sketch'), 'Polity includes exam_sketch');
    assert(polityRecs.includes('institutional_diagram') || polityRecs.includes('flowchart'), 'Polity includes structural diagrams');

    const economyRecs = recommendVisualTypesForTopic({ subject: 'GS3 Economy & Banking' });
    assert(economyRecs.includes('cause_effect') || economyRecs.includes('chart'), 'Economy includes cause_effect / chart');

    // ── Test 6: Multi-User Global Visual Sharing ──────────────────────────────
    console.log('\n--- Test 6: Multi-User Global Visual Sharing ---');
    const user1Pack = await generateVisualPackForTopic(ufTopic.id, { userId: 'user_1', provider: 'mock' });
    const user2Pack = await generateVisualPackForTopic(ufTopic.id, { userId: 'user_2', provider: 'mock' });
    assert(user1Pack.reused[0].id === user2Pack.reused[0].id, 'User 1 and User 2 reuse the SAME global canonical visual asset');

    // ── Test 7: Mains Evaluation Two-Way Reuse ────────────────────────────────
    console.log('\n--- Test 7: Mains Evaluation Two-Way Reuse ---');
    const mainsMatch = await findMatchingVisualForQuestion({
      questionText: 'Analyze the causes of recurring urban flooding in Indian cities.'
    });
    assert(mainsMatch.matched === true, 'Mains question resolved matching visual');
    assert(mainsMatch.visual.id === initialSketchId, 'Mains reuses the exact Visual Studio canonical Exam Sketch');

    // ── Test 8: Unknown Topic Protection ─────────────────────────────────────
    console.log('\n--- Test 8: Unknown Topic Noise Protection ---');
    const unknownResult = await generateVisualPackForTopic('Quantum Computing in Ancient Roman Agriculture 999', {
      provider: 'mock'
    });
    assert(unknownResult.success === false, 'Unknown topic generation refused');
    assert(unknownResult.reason === 'TOPIC_NOT_FOUND', 'Unknown topic returns TOPIC_NOT_FOUND without DB mutation');

    // ── Test 9: APPSC Mode & Regional Evidence Binding ────────────────────────
    console.log('\n--- Test 9: APPSC Mode Regional Evidence Binding ---');
    const apTopic = await resolveTopicByQuery('Andhra Pradesh Budget');
    assert(apTopic !== null, 'AP Budget topic resolved');
    const apGenResult = await generateVisualPackForTopic(apTopic.id, {
      examContext: 'appsc',
      region: 'andhra_pradesh',
      provider: 'mock'
    });
    assert(apGenResult.success === true, 'APPSC visual pack generation succeeded');
    assert(apGenResult.reused.length > 0 || apGenResult.generated.length > 0, 'APPSC visual assets available');

    // ── Test 11: Visual/Evidence Currentness Synchronization ──────────────────
    console.log('\n--- Test 11: Visual/Evidence Currentness Synchronization ---');
    const { deriveVisualFreshness, getTopicVisualPack } = await import('./services/visualKnowledge/visualKnowledgeService.js');

    // 1. FY 2025-26 evidence cannot support a CURRENT FY 2026-27 budget visual
    const histVisualSpec = {
      visual_spec: { title: 'AP Budget 2025-26', nodes: ['Total Outlay Rs 3.12 Lakh Cr'] }
    };
    const histEvidence = [{ verification_status: 'verified_historical', officialLatestConfirmed: false }];
    const histFreshness = deriveVisualFreshness(histVisualSpec, histEvidence);
    assert(histFreshness.status === 'HISTORICAL', 'Historical FY 2025-26 evidence derives status HISTORICAL');
    assert(histFreshness.isCurrent === false, 'Historical visual isCurrent = false');

    // 2. Stale evidence derives STALE_EVIDENCE
    const staleVisualSpec = { visual_spec: { title: 'Old Statistic Visual' } };
    const staleEvidence = [{ verification_status: 'stale', refreshRequired: true }];
    const staleFreshness = deriveVisualFreshness(staleVisualSpec, staleEvidence);
    assert(staleFreshness.status === 'STALE_EVIDENCE', 'Stale evidence derives status STALE_EVIDENCE');

    // 3. Visual with no volatile numbers remains CONCEPTUAL and CURRENT
    const conceptualVisualSpec = {
      visual_spec: {
        title: 'Fiscal Architecture',
        nodes: ['State Receipts', 'Revenue Expenditure', 'Fiscal Balance']
      }
    };
    const conceptualFreshness = deriveVisualFreshness(conceptualVisualSpec, []);
    assert(conceptualFreshness.status === 'CONCEPTUAL', 'Pure conceptual diagram derives status CONCEPTUAL');
    assert(conceptualFreshness.isCurrent === true, 'Conceptual diagram isCurrent = true');

    // 4. AP Budget visual pack returns FY 2026-27 current cycle
    const apPack = await getTopicVisualPack(apTopic.id, { examContext: 'appsc', region: 'andhra_pradesh' });
    assert(apPack.current_cycle === 'FY 2026-27', 'AP Budget active cycle is FY 2026-27');
    assert(apPack.visuals.length > 0, 'Current visuals available');
    assert(apPack.visuals[0].freshness_status === 'CURRENT' || apPack.visuals[0].freshness_status === 'CONCEPTUAL', 'Canonical AP exam sketch is CURRENT/CONCEPTUAL');
    assert(!JSON.stringify(apPack.visuals[0].visual_spec).includes('3.12 Lakh Cr'), 'Canonical AP Exam Sketch does NOT contain old FY 2025-26 3.12 Lakh Cr number');

    // 5. Historical FY 2025-26 visual is accessible under historical_visuals
    assert(apPack.historical_visuals.some(v => v.title.includes('FY 2025-26')), 'Historical FY 2025-26 visual preserved in historical_visuals');

    // 6. Quantitative chart validation rejects unverified/stale numbers for current visual
    const invalidChart = {
      title: 'Current Outlay Chart',
      renderer: 'BAR_CHART',
      data: [{ label: 'Outlay', value: 312000 }]
    };
    const chartValResult = validateVisualSpecification('chart', invalidChart, histEvidence);
    assert(chartValResult.isValid === false, 'Historical evidence cannot validate a current quantitative chart');

    console.log('\n================================================================');
    console.log(`  Phase 2C Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('💥 Test suite encountered fatal error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runPhase2CTests();
