/**
 * backend/test_phase3a1_live_and_pyq_integrity.mjs
 *
 * Test Suite for Phase 3A.1:
 * - Live Official Retrieval & Provenance Hardening
 * - PYQ Metadata Integrity & Stage/Paper Verification
 * - Canonical 1726-Node Syllabus Validation
 * - RBI 2026 Policy Repo Rate (5.25%) & Metric Separation
 * - Exact Source Document Titles & Deduplication
 */

import { pool, query } from './db/index.js';
import { getNodeById, searchUnifiedNodes, UNIFIED_NODES_BY_ID } from './brain/unifiedSyllabusIndex.js';
import { getPyqById } from './brain/pyqLinkEngine.js';
import { getRelevantPyqsForIssue, QUESTION_KINDS } from './services/currentAffairs/issuePyqService.js';
import { mapIssueToSyllabusNodes, MAPPING_TYPES } from './services/currentAffairs/syllabusMappingService.js';
import { validateOfficialUrlAllowlist, validateRedirectSafety, getAdapterForSource } from './services/officialRetrieval/sourceAdapterRegistry.js';
import { extractCandidateClaimsFromDocument, verifyAndIngestClaim } from './services/officialRetrieval/claimExtractionService.js';
import { ingestOfficialUpdate, retrieveFromOfficialSourceLive, RETRIEVAL_STATUSES } from './services/officialRetrieval/officialRetrievalService.js';
import { generateExamDeploymentKit } from './services/currentAffairs/examDeploymentKitService.js';
import { getIssueBySlug, enrichIssueWithOfficialEvidence } from './services/currentAffairs/issueBuilderService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║        MENTOROS PHASE 3A.1 — LIVE RETRIEVAL & PYQ INTEGRITY TESTS     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: MIGRATION 060 CANONICAL RUNNER VERIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('📦 PART 1: Migration 060 Canonical Registration');
  try {
    const { rows: tableCheck } = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN (
        'retrieved_official_documents',
        'current_affairs_issues',
        'issue_evidence_links',
        'issue_syllabus_mappings',
        'issue_pyq_links',
        'user_issue_revision_state'
      )
    `);
    assert(tableCheck.length === 6, `All 6 Phase 3A tables exist in schema (found: ${tableCheck.length})`);
  } catch (err) {
    assert(false, `Schema check failed: ${err.message}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: PYQ INTEGRITY & PAPER ATTRIBUTION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n📝 PART 2: PYQ Metadata Integrity & Stage/Paper Verification');

  // A. Urban Flooding 2020 Question is GS1
  const pyqUrban = getPyqById('MAINS_GS1_GEO_2020_006') || getPyqById('MAINS_GS1_2020_015');
  assert(
    pyqUrban !== null && (pyqUrban.paper === 'GS1' || pyqUrban.physicalPaper === 'MAINS_GS1'),
    `Urban Flooding 2020 question correctly attributes to GS1 paper (Found: ${pyqUrban?.paper || pyqUrban?.physicalPaper})`
  );
  assert(
    pyqUrban?.year === 2020,
    `Urban Flooding 2020 question year is 2020 (Found: ${pyqUrban?.year})`
  );
  assert(
    pyqUrban?.question?.includes('Hyderabad and Pune'),
    'Urban Flooding question contains authentic text ("smart ones like Hyderabad and Pune")'
  );

  // B. 2023 GS3 Q17 is Wetlands / Ramsar Sites, NOT Green Hydrogen
  const pyqWetlands = getPyqById('GS3_ENV_2023_02') || getPyqById('MAINS_GS3_2023_017');
  assert(
    pyqWetlands !== null,
    'UPSC Mains 2023 GS3 Q17 exists in canonical master index'
  );
  assert(
    pyqWetlands?.question?.includes('National Wetland Conservation Programme') || pyqWetlands?.question?.includes('Ramsar Sites'),
    'UPSC Mains 2023 GS3 Q17 concerns National Wetland Conservation Programme / Ramsar sites'
  );
  assert(
    !pyqWetlands?.question?.toLowerCase().includes('green hydrogen'),
    'UPSC Mains 2023 GS3 Q17 does NOT mention Green Hydrogen'
  );

  // C. Green Hydrogen appeared in UPSC Prelims 2023
  const pyqGreenHydro = getPyqById('ENV_CLI_2023_Q42');
  assert(
    pyqGreenHydro !== null,
    'UPSC Prelims 2023 Green Hydrogen statement question exists in pyq_master_index (ENV_CLI_2023_Q42)'
  );
  assert(
    pyqGreenHydro?.year === 2023,
    `Green Hydrogen Prelims question year is 2023 (Found: ${pyqGreenHydro?.year})`
  );
  assert(
    pyqGreenHydro?.question?.includes('fuel cell') && pyqGreenHydro?.question?.includes('natural gas'),
    'Green Hydrogen Prelims question contains authentic statement text'
  );

  // D. Issue PYQ Linker returns authentic questions without fake IDs
  const urbanPyqLinks = await getRelevantPyqsForIssue({ topicSlug: 'urban_flooding' });
  assert(
    urbanPyqLinks.some(q => q.paper === 'GS1' && q.year === 2020),
    'Urban Flooding issue links authentic GS1 2020 question'
  );
  assert(
    !urbanPyqLinks.some(q => q.pyqId === 'UPSC-2020-GS3-Q13'),
    'Urban Flooding does NOT link fabricated PYQ ID UPSC-2020-GS3-Q13'
  );

  const greenHydroPyqLinks = await getRelevantPyqsForIssue({ topicSlug: 'green_hydrogen' });
  assert(
    greenHydroPyqLinks.some(q => q.stage === 'prelims' && q.year === 2023),
    'Green Hydrogen issue links authentic Prelims 2023 questions'
  );
  assert(
    !greenHydroPyqLinks.some(q => q.pyqId === 'UPSC-2023-GS3-Q17'),
    'Green Hydrogen does NOT link fabricated Mains PYQ ID UPSC-2023-GS3-Q17'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: CANONICAL 1726-NODE SYLLABUS INTEGRITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n📚 PART 3: Canonical 1726-Node Unified Syllabus Mapping');

  const demoTopics = ['inflation', 'ap_budget', 'urban_flooding', 'green_hydrogen'];
  for (const topic of demoTopics) {
    const mappings = mapIssueToSyllabusNodes(topic);
    assert(mappings.length > 0, `Issue "${topic}" mapped to at least one syllabus node (found: ${mappings.length})`);
    for (const m of mappings) {
      const node = getNodeById(m.nodeId);
      assert(
        node !== null && node.syllabusNodeId === m.nodeId,
        `Node "${m.nodeId}" exists in 1726-node unifiedSyllabusIndex (${node?.subject || 'N/A'} - ${node?.microTheme || node?.topic || 'N/A'})`
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: PROVENANCE ISOLATION & ALLOWLIST SECURITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n🛡 PART 4: Provenance Isolation & Allowlist Security');

  // Allowlist & Redirect Safety
  const allowedCheck = await validateOfficialUrlAllowlist('https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx');
  assert(allowedCheck.isAllowed === true, 'rbi.org.in is in official sources allowlist');

  const unauthorizedCheck = await validateOfficialUrlAllowlist('https://randomnewsblog.com/article/123');
  assert(unauthorizedCheck.isAllowed === false, 'randomnewsblog.com is strictly rejected by allowlist');

  const safeRedirect = await validateRedirectSafety('https://rbi.org.in', 'https://www.rbi.org.in/rates');
  assert(safeRedirect.isSafe === true, 'Official subdomain redirect is allowed');

  const unsafeRedirect = await validateRedirectSafety('https://rbi.org.in', 'https://maliciousphishing.com/leak');
  assert(unsafeRedirect.isSafe === false, 'Redirect to external unapproved domain is rejected');

  // Provenance Stamps
  const testDoc = {
    sourceId: '4e6c8ac6-c3ab-402a-a1d2-54a5ca8b38e7',
    canonicalUrl: 'https://rbi.org.in/test-release',
    documentTitle: 'Test MPC Statement',
    documentType: 'POLICY_GUIDELINE',
    publicationDate: '2026-09-01',
    referencePeriod: 'September 2026',
    retrievedAt: new Date().toISOString(),
    contentHash: 'hash_test_fixture_123',
    text: 'The Policy Repo Rate is 5.25%.',
    metadata: { authority: 'RBI' }
  };

  const fixtureResult = await verifyAndIngestClaim({
    candidateClaim: {
      evidence_type: 'statistic',
      canonical_claim_key: 'test_rbi_repo_fixture',
      numeric_value: 5.25,
      unit: '%',
      supporting_text: 'Policy Repo Rate is 5.25%'
    },
    normalizedDoc: testDoc,
    provenanceOrigin: 'test_fixture'
  });

  assert(
    fixtureResult.provenanceOrigin === 'test_fixture',
    `Fixture test sets provenance_origin = 'test_fixture' (Found: ${fixtureResult.provenanceOrigin})`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // PART 5: RBI 2026 POLICY REPO RATE & METRIC IDENTIFIERS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n🏦 PART 5: RBI Policy Repo Rate (5.25%) & Metric Separation');

  const rbiAdapter = getAdapterForSource('RBI');
  assert(rbiAdapter !== null, 'RBI adapter is registered');
  assert(typeof rbiAdapter.fetchLive === 'function', 'RBI adapter supports live fetching');

  // Verify explicit metric extraction
  const mockRbiNormalized = rbiAdapter.normalize({
    sourceId: '4e6c8ac6-c3ab-402a-a1d2-54a5ca8b38e7',
    title: 'Current Policy Rates',
    text: 'Policy Repo Rate: 5.25%. Standing Deposit Facility Rate: 5.00%. Bank Rate: 5.50%. Marginal Standing Facility Rate: 5.50%.',
    releaseDate: '2026-10-01',
    referencePeriod: 'CY 2026',
    url: 'https://www.rbi.org.in/',
    metadata: {
      extractedMetrics: {
        rbi_policy_repo_rate: { label: 'Policy Repo Rate', value: 5.25, unit: '%' },
        rbi_sdf_rate: { label: 'Standing Deposit Facility (SDF) Rate', value: 5.00, unit: '%' },
        rbi_msf_rate: { label: 'Marginal Standing Facility (MSF) Rate', value: 5.50, unit: '%' },
        rbi_bank_rate: { label: 'Bank Rate', value: 5.50, unit: '%' }
      }
    }
  });

  const extractedClaims = extractCandidateClaimsFromDocument(mockRbiNormalized);
  assert(
    extractedClaims.some(c => c.canonical_claim_key.includes('rbi_policy_repo_rate') && c.numeric_value === 5.25),
    'RBI Policy Repo Rate extracted explicitly as 5.25% under rbi_policy_repo_rate'
  );
  assert(
    extractedClaims.some(c => c.canonical_claim_key.includes('rbi_bank_rate') && c.numeric_value === 5.50),
    'Bank Rate extracted separately as 5.50% and not conflated with repo rate'
  );
  assert(
    extractedClaims.some(c => c.canonical_claim_key.includes('rbi_sdf_rate') && c.numeric_value === 5.00),
    'SDF Rate extracted separately as 5.00%'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // PART 6: EXAM DEPLOYMENT KIT SEPARATION & EXACT TITLES
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n📋 PART 6: Exam Deployment Kit Segregation & Exact Titles');

  const inflationIssue = await getIssueBySlug('inflation');
  assert(inflationIssue !== null, 'Inflation canonical issue exists');

  const kit = await generateExamDeploymentKit(inflationIssue, { examContext: 'upsc' });
  assert(kit !== null, 'Exam Deployment Kit generated successfully');
  assert(
    Array.isArray(kit.evidenceBuckets.currentVerified),
    'Kit contains segregated currentVerified evidence bucket'
  );
  assert(
    Array.isArray(kit.evidenceBuckets.historicalVerified),
    'Kit contains segregated historicalVerified evidence bucket'
  );
  assert(
    kit.relevantPyqs.length > 0,
    `Kit includes ${kit.relevantPyqs.length} authentic PYQ links`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`🏁 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════════');

  await pool.end();
  return failed === 0;
}

runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
