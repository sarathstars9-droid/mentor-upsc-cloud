/**
 * backend/test_phase2b_currentness.mjs
 *
 * Dedicated Phase 2B Currentness & Release Expectation Regression Test Suite.
 * 
 * Verifies:
 * TEST 1: August 2024 CPI in Oct 2026 -> NOT verified_current, NOT fresh, NOT officialLatestConfirmed
 * TEST 2: August 2026 CPI (release 14 Sep 2026, Oct 2026 date) -> eligible for verified_current
 * TEST 3: AP Budget FY 2025-26 in Oct 2026 -> verified_historical or stale, NOT current
 * TEST 4: AP Budget FY 2026-27 with exact AP Finance provenance -> eligible for verified_current
 * TEST 5: development_seed row -> cannot automatically become verified_current
 * TEST 6: unknown provenance -> cannot automatically become verified_current
 * TEST 7: manual_official_import with missing document provenance -> cannot become verified_current
 * TEST 8: Urban Flooding diagram -> no unsupported NDMA numeric fact, conceptual diagram remains valid
 */

import './config/env.js';
import { query } from './db/index.js';
import { findSourceByUrl, seedOfficialSources } from './services/evidence/sourceRegistryService.js';
import { evaluateEvidenceFreshness, checkOfficialLatestReleaseExpectation, FRESHNESS_CLASSES } from './services/evidence/evidenceFreshnessPolicy.js';
import { registerEvidenceWithSupersession, getLatestEvidenceForClaimKey, enrichEvidenceMetadata } from './services/evidence/latestReleaseService.js';
import { verifyEvidenceClaim, validateVisualEvidenceIntegrity } from './services/evidence/evidenceVerificationService.js';
import { getTopicVisualPack } from './services/visualKnowledge/visualKnowledgeService.js';

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

async function runCurrentnessTests() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║       Phase 2B: Evidence Currentness & Cadence Regression Tests   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  await seedOfficialSources();
  const mospi = await findSourceByUrl('mospi.gov.in');
  const apFinance = await findSourceByUrl('apfinance.gov.in') || await findSourceByUrl('finance.ap.gov.in');

  const OCT_2026 = new Date('2026-10-01T10:00:00Z');

  // ── TEST 1: August 2024 CPI in October 2026 ────────────────────────────────
  console.log('📦 TEST 1: August 2024 CPI in October 2026 (Monthly Cadence)');
  const cpi2024Item = {
    evidence_type: 'statistic',
    canonical_claim_key: 'cpi_headline_inflation_india',
    title: 'All-India CPI General Headline Inflation Rate (August 2024)',
    data_period: 'August 2024',
    source_document_date: '2024-09-12',
    publication_date: '2024-09-12',
    freshness_class: 'monthly',
    provenance_origin: 'manual_official_import',
    source_document_title: 'MoSPI Monthly Release August 2024',
    source_url: 'https://mospi.gov.in/cpi-2024'
  };

  const cpi2024Freshness = evaluateEvidenceFreshness(cpi2024Item, OCT_2026);
  assert(cpi2024Freshness.isFresh === false, 'August 2024 CPI is NOT fresh in October 2026');
  assert(cpi2024Freshness.officialLatestConfirmed === false, 'August 2024 CPI is NOT officialLatestConfirmed');
  assert(cpi2024Freshness.refreshRequired === true, 'August 2024 CPI flags refreshRequired = true');

  const enriched2024 = enrichEvidenceMetadata({
    ...cpi2024Item,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enriched2024.verificationStatus !== 'verified_current', 'August 2024 CPI is demoted from verified_current (becomes stale or verified_historical)');
  assert(enriched2024.officialLatestConfirmed === false, 'August 2024 CPI enriched officialLatestConfirmed = false');

  // ── TEST 2: August 2026 CPI in October 2026 ────────────────────────────────
  console.log('\n📦 TEST 2: August 2026 CPI in October 2026 (14 Sep 2026 Release Date)');
  const cpi2026Item = {
    evidence_type: 'statistic',
    canonical_claim_key: 'cpi_headline_inflation_india',
    title: 'All-India CPI General Headline Inflation Rate (August 2026)',
    data_period: 'August 2026',
    source_document_date: '2026-09-14',
    publication_date: '2026-09-14',
    freshness_class: 'monthly',
    provenance_origin: 'manual_official_import',
    source_document_title: 'MoSPI Press Release: CPI Numbers Base 2024=100 (August 2026)',
    source_url: 'https://mospi.gov.in/cpi-aug2026'
  };

  const cpi2026Freshness = evaluateEvidenceFreshness(cpi2026Item, OCT_2026);
  assert(cpi2026Freshness.isFresh === true, 'August 2026 CPI is fresh in October 2026 (released 14 Sep 2026)');
  assert(cpi2026Freshness.officialLatestConfirmed === true, 'August 2026 CPI officialLatestConfirmed = true');

  const enriched2026 = enrichEvidenceMetadata({
    ...cpi2026Item,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enriched2026.verificationStatus === 'verified_current', 'August 2026 CPI with full provenance qualifies for verified_current');
  assert(enriched2026.refreshRequired === false, 'August 2026 CPI does not require refresh');

  // ── TEST 3: AP Budget FY 2025-26 in October 2026 ───────────────────────────
  console.log('\n📦 TEST 3: AP Budget FY 2025-26 in October 2026 (Annual Cadence)');
  const ap2025Item = {
    evidence_type: 'budget_datum',
    canonical_claim_key: 'ap_state_budget_outlay',
    title: 'Andhra Pradesh State Budget Outlay (FY 2025-26)',
    data_period: 'FY 2025-26',
    source_document_date: '2025-02-28',
    publication_date: '2025-02-28',
    freshness_class: 'annual',
    provenance_origin: 'manual_official_import',
    source_document_title: 'Government of Andhra Pradesh Budget Estimates 2025-26',
    source_url: 'https://apfinance.gov.in/budget2025-26'
  };

  const ap2025Freshness = evaluateEvidenceFreshness(ap2025Item, OCT_2026);
  assert(ap2025Freshness.officialLatestConfirmed === false, 'FY 2025-26 AP Budget is NOT officialLatestConfirmed in FY 2026-27 cycle');
  assert(ap2025Freshness.refreshRequired === true, 'FY 2025-26 AP Budget flags refreshRequired = true');

  const enrichedAp2025 = enrichEvidenceMetadata({
    ...ap2025Item,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enrichedAp2025.verificationStatus !== 'verified_current', 'FY 2025-26 AP Budget is not verified_current in October 2026');

  // ── TEST 4: AP Budget FY 2026-27 with Exact Provenance ─────────────────────
  console.log('\n📦 TEST 4: AP Budget FY 2026-27 with Exact AP Finance Provenance');
  const ap2026Item = {
    evidence_type: 'budget_datum',
    canonical_claim_key: 'ap_state_budget_outlay',
    title: 'Andhra Pradesh State Annual Financial Statement & Budget Outlay FY 2026-27',
    data_period: 'FY 2026-27',
    source_document_date: '2026-02-18',
    publication_date: '2026-02-18',
    freshness_class: 'annual',
    provenance_origin: 'manual_official_import',
    source_document_title: 'Government of Andhra Pradesh Budget Estimates 2026-27: Speech of Minister for Finance',
    source_url: 'https://apfinance.gov.in/budget2026-27'
  };

  const ap2026Freshness = evaluateEvidenceFreshness(ap2026Item, OCT_2026);
  assert(ap2026Freshness.isFresh === true, 'FY 2026-27 AP Budget is fresh in October 2026');
  assert(ap2026Freshness.officialLatestConfirmed === true, 'FY 2026-27 AP Budget officialLatestConfirmed = true');

  const enrichedAp2026 = enrichEvidenceMetadata({
    ...ap2026Item,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enrichedAp2026.verificationStatus === 'verified_current', 'FY 2026-27 AP Budget qualifies for verified_current');

  // ── TEST 5: Development Seed Row Cannot Become verified_current ────────────
  console.log('\n📦 TEST 5: development_seed Provenance Behavior');
  const devSeedItem = {
    evidence_type: 'statistic',
    canonical_claim_key: 'cpi_headline_inflation_india',
    title: 'CPI Rate Seed Record',
    data_period: 'August 2026',
    source_document_date: '2026-09-14',
    freshness_class: 'monthly',
    provenance_origin: 'development_seed',
    source_document_title: 'MoSPI Dev Seed',
    source_url: 'https://mospi.gov.in'
  };

  const enrichedDevSeed = enrichEvidenceMetadata({
    ...devSeedItem,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enrichedDevSeed.verificationStatus !== 'verified_current', 'development_seed provenance CANNOT become verified_current');
  assert(enrichedDevSeed.officialLatestConfirmed === false, 'development_seed officialLatestConfirmed = false');

  // ── TEST 6: Unknown Provenance Cannot Become verified_current ──────────────
  console.log('\n📦 TEST 6: unknown Provenance Behavior');
  const unknownItem = {
    evidence_type: 'statistic',
    canonical_claim_key: 'cpi_headline_inflation_india',
    title: 'Unauthenticated Import',
    data_period: 'August 2026',
    source_document_date: '2026-09-14',
    freshness_class: 'monthly',
    provenance_origin: 'unknown',
    source_document_title: 'Unattributed Document',
    source_url: 'https://unknown-domain.gov.in'
  };

  const enrichedUnknown = enrichEvidenceMetadata({
    ...unknownItem,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enrichedUnknown.verificationStatus !== 'verified_current', 'unknown provenance CANNOT become verified_current');
  assert(enrichedUnknown.officialLatestConfirmed === false, 'unknown provenance officialLatestConfirmed = false');

  // ── TEST 7: Missing Document Provenance Cannot Become verified_current ─────
  console.log('\n📦 TEST 7: manual_official_import with Missing Document Provenance');
  const missingDocItem = {
    evidence_type: 'statistic',
    canonical_claim_key: 'cpi_headline_inflation_india',
    title: 'Incomplete Import without Doc Title or Date',
    freshness_class: 'monthly',
    provenance_origin: 'manual_official_import',
    source_document_title: null, // missing
    source_document_date: null,  // missing
    source_url: null            // missing
  };

  const enrichedMissingDoc = enrichEvidenceMetadata({
    ...missingDocItem,
    is_latest_release: true,
    verification_status: 'verified_current'
  });
  assert(enrichedMissingDoc.verificationStatus !== 'verified_current', 'manual_official_import missing document provenance CANNOT become verified_current');

  // ── TEST 8: Urban Flooding Conceptual Diagram (No Unsupported Numbers) ─────
  console.log('\n📦 TEST 8: Urban Flooding Exam Sketch Verification');
  const { rows: ufTopic } = await query(`SELECT id FROM knowledge_topics WHERE slug = 'urban_flooding'`);
  if (ufTopic.length > 0) {
    const pack = await getTopicVisualPack(ufTopic[0].id);
    const sketch = pack.visuals.find(v => v.visual_type === 'exam_sketch' || v.exam_drawable || v.visual_spec?.visualGrammar === 'hub_spoke') || pack.visuals[0];
    
    assert(Boolean(sketch), 'Urban Flooding exam sketch exists in visual pack');
    if (sketch) {
      const specNodes = sketch.visual_spec?.nodes || sketch.visual_spec?.spokes || [];
      const specText = JSON.stringify(sketch.visual_spec);
      
      const has50YrNumber = specText.includes('50-Yr') || specText.includes('50-year') || specText.includes('50 Yr');
      assert(!has50YrNumber, 'Exam sketch does NOT contain unsupported "50-Yr" statistical claim');
      
      const hasConceptualFlow = specText.includes('Precipitation') || specText.includes('Rainfall') || specText.includes('Drainage') || specText.includes('Sponge');
      assert(hasConceptualFlow, 'Exam sketch retains valid, robust conceptual cause-solution flow');
      assert(sketch.exam_drawable === true, 'Exam sketch is marked exam_drawable = true');
      assert(sketch.target_draw_seconds <= 60, 'Exam sketch target draw time <= 60 seconds');
    }
  } else {
    assert(false, 'Urban Flooding topic not found');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`Currentness Verification Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCurrentnessTests().catch(err => {
  console.error('💥 Test suite crashed:', err);
  process.exit(1);
});
