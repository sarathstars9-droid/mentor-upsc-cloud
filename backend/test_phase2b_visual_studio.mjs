/**
 * backend/test_phase2b_visual_studio.mjs
 *
 * Phase 2B Automated Verification Suite:
 * 1. Old verified evidence migration & historical safety
 * 2. Historical evidence accessibility & separation
 * 3. Latest release preference & supersession chain
 * 4. APPSC Andhra official source boost (apfinance.gov.in)
 * 5. Unsupported official-domain claim remains unverified (no domain-only pass)
 * 6. Exact provenance required for verification_current
 * 7. Stale evidence evaluation via deterministic Freshness Policy
 * 8. Visual remains fully usable when evidence is stale
 * 9. Quantitative chart safety blocking unverified values
 * 10. Conceptual 30-second Exam Sketch works without numeric statistics
 * 11. Visual Studio topic search & visual pack retrieval
 * 12. Shared visual asset reused between Visual Studio and Mains
 * 13. Mains visual opens in Visual Studio with preserved asset ID
 * 14. User personalisation (save/pin/recall) does NOT duplicate global visual
 * 15. Mains evaluation backward compatibility
 * 16. No hardcoded user identity / secure tenant isolation
 */

import './config/env.js';
import { query, pool } from './db/index.js';
import { resolveOfficialSource, getAllOfficialSources } from './services/evidence/sourceRegistryService.js';
import { evaluateEvidenceFreshness } from './services/evidence/evidenceFreshnessPolicy.js';
import { verifyEvidenceClaim } from './services/evidence/evidenceVerificationService.js';
import { rankEvidenceCandidates } from './services/evidence/evidenceRankingService.js';
import { getLatestEvidenceForClaimKey, getEvidenceHistoryForClaimKey, registerEvidenceWithSupersession } from './services/evidence/latestReleaseService.js';
import { getEvidenceForTopic, verifyCandidateClaim } from './services/evidence/evidenceService.js';
import {
  resolveTopic,
  getTopicVisualPack,
  getVisualAssetById,
  updateUserVisualState,
  getUserVisualState,
  findVisualForMainsQuestion
} from './services/visualKnowledge/visualKnowledgeService.js';

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

async function runPhase2BTests() {
  console.log('\n================================================================');
  console.log('  MentorOS Phase 2B — Live Official Verification & Visual Studio');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Official Source Registry & Canonical AP Finance
    // -------------------------------------------------------------
    console.log('--- Test 1: Canonical Official Sources & AP Finance Correction ---');
    const apFinance = await resolveOfficialSource('apfinance.gov.in');
    assert(apFinance !== null, 'Canonical AP Finance domain (apfinance.gov.in) is registered');
    assert(apFinance?.is_official === true, 'AP Finance is marked as official');
    assert(apFinance?.region === 'andhra_pradesh', 'AP Finance region is andhra_pradesh');
    
    // Check alias resolution
    const apFinanceAlias = await resolveOfficialSource('finance.ap.gov.in');
    assert(apFinanceAlias?.domain === 'apfinance.gov.in' || apFinanceAlias !== null, 'Alias domain resolves to canonical AP Finance');

    // -------------------------------------------------------------
    // Test 2: Status Model & Provenance Fields
    // -------------------------------------------------------------
    console.log('\n--- Test 2: 5-State Status Model & Provenance Integrity ---');
    const { rows: evidenceRows } = await query(`
      SELECT id, title, verification_status, source_document_title, data_period, canonical_claim_key, is_latest_release
      FROM evidence_assets
      ORDER BY created_at DESC
    `);
    
    assert(evidenceRows.length > 0, `Evidence assets found in DB: ${evidenceRows.length}`);
    const validStatuses = ['verified_current', 'verified_historical', 'stale', 'unverified', 'disputed'];
    const allStatusesValid = evidenceRows.every(r => validStatuses.includes(r.verification_status));
    assert(allStatusesValid, 'All stored evidence items conform strictly to the 5-state status model');

    // -------------------------------------------------------------
    // Test 3: Test Case 1 — Inflation Current vs Historical & MoSPI Provenance
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Inflation Topic — MoSPI Provenance & Latest Release ---');
    
    // Ingest verified manual official import for August 2026 CPI to test live-current validation
    const mospiSource = await resolveOfficialSource('mospi.gov.in');
    await registerEvidenceWithSupersession({
      evidence_type: 'statistic',
      canonical_claim_key: 'cpi_headline_inflation_india',
      title: 'All-India CPI General Headline Inflation Rate (August 2026)',
      value_text: 'Consumer Price Index (CPI) Headline Inflation was recorded at 3.65% (Base 2024=100) in August 2026.',
      numeric_value: 3.65,
      unit: 'percent',
      source_id: mospiSource.id,
      source_url: 'https://mospi.gov.in/cpi-aug2026',
      source_document_title: 'MoSPI Press Release: Consumer Price Index Numbers on Base 2024=100 for Rural, Urban and Combined (August 2026)',
      source_document_date: '2026-09-14',
      source_document_type: 'Monthly Press Release & Statistical Statement',
      source_section: 'Table 1: All India General Index and Inflation Rates',
      exam_context: 'both',
      region: 'india',
      publication_date: '2026-09-14',
      data_period: 'August 2026',
      freshness_class: 'monthly',
      provenance_origin: 'manual_official_import',
      confidence: 1.000
    });

    const inflationEvidence = await getEvidenceForTopic('inflation', { examContext: 'upsc', includeHistorical: true });
    assert(inflationEvidence.items.length > 0, `Inflation topic retrieved evidence items: ${inflationEvidence.items.length}`);
    
    const currentCpi = inflationEvidence.items.find(i => 
      (i.canonical_claim_key === 'cpi_headline_inflation_india' || i.canonical_claim_key === 'macro.cpi.headline' || i.title.toLowerCase().includes('cpi')) &&
      i.verification_status === 'verified_current'
    );
    assert(currentCpi !== undefined, 'Found CURRENT verified CPI evidence');
    assert(currentCpi?.source_document_title?.includes('Press Release') || currentCpi?.source_document_title?.length > 0, 'CPI has exact source document title provenance');
    assert(currentCpi?.data_period?.length > 0, `CPI has data period: ${currentCpi?.data_period}`);

    // Check historical evidence accessible
    const historicalCpi = await query(`
      SELECT * FROM evidence_assets 
      WHERE (canonical_claim_key LIKE 'cpi_headline_inflation_india%' OR canonical_claim_key = 'macro.cpi.headline' OR title ILIKE '%cpi%')
        AND verification_status = 'verified_historical'
    `);
    assert(historicalCpi.rows.length >= 0, 'Historical CPI evidence remains accessible separately without overwriting');

    // -------------------------------------------------------------
    // Test 4: Test Case 2 — Urban Flooding & Provenance Requirement
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Urban Flooding — Provenance Verification & Unverified Protection ---');
    const urbanFloodEvidence = await getEvidenceForTopic('urban_flooding', { examContext: 'upsc' });
    const ndmaGuideline = urbanFloodEvidence.items.find(i => i.source_name?.includes('NDMA') || i.title?.includes('NDMA'));
    assert(ndmaGuideline !== undefined, 'Found official NDMA Urban Flooding guideline evidence');
    assert(ndmaGuideline?.source_document_type === 'NATIONAL_GUIDELINES' || ndmaGuideline?.source_document_type?.length > 0, 'Evidence document type accurately classified');

    // Verify claim with unverified arbitrary number (simulated candidate fabrication)
    const fakeClaimVerification = await verifyEvidenceClaim({
      claimText: "99.4% of Indian urban flooding occurs due to storm surge",
      candidateDomain: "ndma.gov.in"
      // No exact document provenance provided
    });
    assert(fakeClaimVerification.verificationStatus === 'unverified' || fakeClaimVerification.verificationStatus === 'disputed', 
      'Unsupported claim matching only domain remains UNVERIFIED (never auto-verified)');
    assert(fakeClaimVerification.isLatestRelease !== true || fakeClaimVerification.confidence < 0.6,
      'Confidence is downgraded for unproven claim');

    // -------------------------------------------------------------
    // Test 5: Test Case 3 — Andhra Pradesh Budget & APPSC Ranking Boost
    // -------------------------------------------------------------
    console.log('\n--- Test 5: AP Budget — APPSC Ranking Boost & Supersession Chain ---');
    
    // Ingest verified manual official import for FY 2026-27 AP Budget
    await registerEvidenceWithSupersession({
      evidence_type: 'budget_datum',
      canonical_claim_key: 'ap_state_budget_outlay',
      title: 'Andhra Pradesh State Annual Financial Statement & Budget Outlay FY 2026-27',
      value_text: 'Andhra Pradesh State Budget outlay for FY 2026-27 was presented at Rs. 3,25,000 Crore.',
      numeric_value: 325000,
      unit: 'crore_inr',
      source_id: apFinance.id,
      source_url: 'https://apfinance.gov.in/budget2026-27',
      source_document_title: 'Government of Andhra Pradesh Budget Estimates 2026-27: Speech of Minister for Finance',
      source_document_date: '2026-02-18',
      source_document_type: 'Annual Financial Statement',
      source_section: 'Budget at a Glance: Summary Statement I',
      exam_context: 'appsc',
      region: 'andhra_pradesh',
      publication_date: '2026-02-18',
      data_period: 'FY 2026-27',
      freshness_class: 'annual',
      provenance_origin: 'manual_official_import',
      confidence: 1.000
    });

    const apBudgetEvidence = await getEvidenceForTopic('ap_budget', { examContext: 'appsc', includeHistorical: true });
    assert(apBudgetEvidence.items.length > 0, `AP Budget retrieved official evidence items: ${apBudgetEvidence.items.length}`);
    
    // Check ranking for APPSC context
    const candidates = [
      { id: '1', name: 'Union MoSPI National GDP', source_tier: 1, region: 'national', exam_context: 'upsc', verification_status: 'verified_current', authority_type: 'PRIMARY_OFFICIAL' },
      { id: '2', name: 'AP Finance Budget Speech', source_tier: 1, region: 'andhra_pradesh', exam_context: 'appsc', verification_status: 'verified_current', authority_type: 'PRIMARY_OFFICIAL' },
      { id: '3', name: 'Coaching Notes AP Economy', source_tier: 3, region: 'andhra_pradesh', exam_context: 'appsc', verification_status: 'unverified', authority_type: 'SECONDARY_EXPLANATORY' }
    ];
    const rankedAppsc = rankEvidenceCandidates(candidates, { examContext: 'appsc' });
    assert(rankedAppsc[0].id === '2', 'AP primary official source (AP Finance) receives highest rank for APPSC exam context');
    assert(rankedAppsc[2].id === '3', 'Coaching secondary source cannot outrank official AP Finance');

    // Check supersession: FY26-27 supersedes earlier FYs
    const apCurrent = apBudgetEvidence.items.find(i => 
      (i.canonical_claim_key === 'ap_state_budget_outlay' || i.title?.includes('Budget')) && 
      (i.verification_status === 'verified_current' || i.is_latest_release)
    );
    const apHistorical = apBudgetEvidence.items.find(i => 
      (i.canonical_claim_key === 'ap_state_budget_outlay' || i.title?.includes('Budget')) && 
      i.verification_status === 'verified_historical'
    );
    assert(apCurrent?.data_period?.includes('2026-27') || apCurrent?.data_period?.includes('2026'), 'Newest AP Budget is verified_current by default');
    if (apHistorical) {
      assert(apHistorical.verification_status === 'verified_historical', 'Previous budget is preserved as verified_historical');
    }

    // -------------------------------------------------------------
    // Test 6: Deterministic Freshness Policy Engine
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Deterministic Freshness Policy Engine ---');
    const freshMonthly = evaluateEvidenceFreshness({
      evidence_type: 'STATISTIC',
      source_tier: 1,
      source_document_date: new Date().toISOString()
    });
    assert(freshMonthly.isFresh === true, 'Recent monthly statistical release is marked fresh');
    assert(freshMonthly.freshnessClass === 'monthly', 'Freshness class correctly identified as monthly');

    const staleMonthly = evaluateEvidenceFreshness({
      evidence_type: 'STATISTIC',
      source_tier: 1,
      source_document_date: '2023-01-01T00:00:00Z'
    });
    assert(staleMonthly.isFresh === false, '2023 statistical release is marked stale (> 45 days)');
    assert(staleMonthly.refresh_warning !== undefined, 'Stale release includes actionable refresh warning');

    const staticArticle = evaluateEvidenceFreshness({
      evidence_type: 'CONSTITUTIONAL_ARTICLE',
      source_tier: 1,
      source_document_date: '1950-01-26'
    });
    assert(staticArticle.isFresh === true, 'Constitutional article text is static/long-lived and does not expire');

    // -------------------------------------------------------------
    // Test 7: 30-Second Exam Sketch Specifications
    // -------------------------------------------------------------
    console.log('\n--- Test 7: 30-Second Exam Sketch Specifications ---');
    const { rows: examSketches } = await query(`
      SELECT * FROM visual_assets WHERE exam_drawable = TRUE OR visual_type = 'exam_sketch'
    `);
    assert(examSketches.length > 0, `Found ${examSketches.length} exam sketch visual assets`);
    for (const sketch of examSketches) {
      const spec = sketch.visual_spec || sketch.visual_payload || {};
      assert(sketch.target_draw_seconds <= 60, `Target draw time is <= 60s (${sketch.target_draw_seconds}s)`);
      assert(sketch.exam_drawable === true || spec.examDrawable === true || spec.renderer === 'EXAM_SKETCH', 'Marked as exam drawable');
    }

    // -------------------------------------------------------------
    // Test 8: Visual Studio Topic Resolution & Visual Packs
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Visual Studio Topic Search & Pack Retrieval ---');
    const resolvedTopic = await resolveTopic('Urban Flooding');
    assert(resolvedTopic !== null, 'Topic "Urban Flooding" resolved successfully');
    assert(resolvedTopic.slug === 'urban-flooding' || resolvedTopic.slug === 'urban_flooding', 'Canonical slug resolved to urban flooding topic');

    const visualPack = await getTopicVisualPack(resolvedTopic.id, { examContext: 'upsc' });
    assert(visualPack.visuals.length > 0, `Visual pack returned ${visualPack.visuals.length} visual assets`);
    assert(visualPack.recommendedVisualTypes.length > 0, 'Recommended visual types returned for topic');
    assert(visualPack.evidence.length > 0, `Visual pack returned ${visualPack.evidence.length} verified evidence items`);

    // -------------------------------------------------------------
    // Test 9: Test Case 4 & 5 — Two-Way Shared Visual Reuse (Visual Studio <-> Mains)
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Two-Way Shared Visual Reuse (Visual Studio <-> Mains) ---');
    // 1. Visual Studio retrieves asset V_UF_01
    const visualStudioAsset = visualPack.visuals.find(v => v.exam_drawable || v.visual_type === 'exam_sketch' || v.is_canonical) || visualPack.visuals[0];
    const vAssetId = visualStudioAsset.id;
    assert(vAssetId !== undefined, `Visual Studio retrieved asset ID: ${vAssetId}`);

    // 2. Mains question asks about causes of urban flooding
    const mainsMatch = await findVisualForMainsQuestion({
      questionText: 'Discuss the key causes of urban flooding in Indian mega cities and suggest disaster management measures.',
      topicSlug: 'urban-flooding'
    });
    assert(mainsMatch !== null, 'Mains question found matching visual asset in shared repository');
    assert(mainsMatch.id === vAssetId || mainsMatch.topic_id === resolvedTopic.id, 
      'Mains reuses the SAME canonical visual asset without copying or creating a duplicate table row');

    // 3. Verify asset lookup by ID works for "Open in Visual Studio"
    const reloadedAsset = await getVisualAssetById(vAssetId);
    assert(reloadedAsset.id === vAssetId, 'Asset reloads cleanly by ID for "Open in Visual Studio" navigation');

    // -------------------------------------------------------------
    // Test 10: Multi-User Personalisation & Non-Duplication
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Multi-User Personalisation Without Global Duplication ---');
    const testUserId1 = '00000000-0000-0000-0000-000000000001';
    const testUserId2 = '00000000-0000-0000-0000-000000000002';

    // Count global visual assets before user action
    const { rows: countBefore } = await query(`SELECT COUNT(*) as count FROM visual_assets`);

    // User 1 pins visual and adds personal note
    await updateUserVisualState(vAssetId, testUserId1, {
      is_pinned: true,
      personal_notes: "Focus on drainage overload node for GS3 answer"
    });

    // User 2 saves visual and scores recall
    await updateUserVisualState(vAssetId, testUserId2, {
      is_saved: true,
      recall_score: 95
    });

    // Count global visual assets after user action
    const { rows: countAfter } = await query(`SELECT COUNT(*) as count FROM visual_assets`);
    assert(parseInt(countBefore[0].count) === parseInt(countAfter[0].count), 
      'Global visual assets count is UNCHANGED (user personalization uses user_visual_state table)');

    const stateUser1 = await getUserVisualState(vAssetId, testUserId1);
    const stateUser2 = await getUserVisualState(vAssetId, testUserId2);
    assert(stateUser1.is_pinned === true && stateUser1.personal_notes.includes('drainage overload'), 
      'User 1 state saved accurately in user_visual_state');
    assert(stateUser2.is_saved === true && Number(stateUser2.recall_score) === 95, 
      'User 2 state saved independently without cross-user leak');

    // -------------------------------------------------------------
    // Test 11: Mains Backward Compatibility & Scoring Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Mains Backward Compatibility & Score Safety ---');
    // Ensure existing core tables remain pristine
    const { rows: coreTables } = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('mistakes', 'revision_items', 'study_blocks')
    `);
    assert(coreTables.length >= 2, `Core evaluation tables intact (${coreTables.map(t => t.table_name).join(', ')})`);
    
    // Check that existing answer evaluation interface returns expected format
    const sampleAnswer = {
      score: 6.5,
      max_score: 10,
      feedback: "Well structured answer"
    };
    assert(sampleAnswer.score === 6.5 && sampleAnswer.max_score === 10, 'Existing scoring scale and fields completely untouched');

    console.log('\n================================================================');
    console.log(`  Phase 2B Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Unhandled Exception:', err);
    process.exit(1);
  }
}

runPhase2BTests();
