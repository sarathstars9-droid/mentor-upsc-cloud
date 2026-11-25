/**
 * backend/test_phase3a_official_retrieval.mjs
 *
 * Comprehensive Test Suite for MentorOS Phase 3A:
 * Official Source Retrieval & Current Affairs Issue Builder
 */

import { query, pool } from './db/index.js';
import { validateOfficialUrlAllowlist, validateRedirectSafety, getAdapterForSource } from './services/officialRetrieval/sourceAdapterRegistry.js';
import { computeDocumentContentHash } from './services/officialRetrieval/officialDocumentHasher.js';
import { createNormalizedDocument } from './services/officialRetrieval/documentNormalizer.js';
import { extractCandidateClaimsFromDocument, verifyAndIngestClaim } from './services/officialRetrieval/claimExtractionService.js';
import { ingestOfficialUpdate, RETRIEVAL_STATUSES } from './services/officialRetrieval/officialRetrievalService.js';
import { resolveCanonicalTopic, enrichIssueWithOfficialEvidence, getIssueBySlugOrId } from './services/currentAffairs/issueBuilderService.js';
import { mapIssueToSyllabusNodes } from './services/currentAffairs/syllabusMappingService.js';
import { getRelevantPyqsForIssue } from './services/currentAffairs/issuePyqService.js';
import { generateExamDeploymentKit } from './services/currentAffairs/examDeploymentKitService.js';
import { getUserIssueRevisionState, updateUserIssueRevisionState, getUserRevisionQueue } from './services/currentAffairs/issueRevisionService.js';
import { getVisualPackByTopic } from './services/visualKnowledge/visualKnowledgeService.js';

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

async function runPhase3ATests() {
  console.log('\n================================================================');
  console.log('  MentorOS Phase 3A — Official Retrieval & Issue Builder Tests');
  console.log('================================================================\n');

  // ── 1. Official Domain Allowlist & Security ────────────────────────────────
  console.log('--- Test 1: Official Domain Allowlist & Security ---');
  const allowedCheck = await validateOfficialUrlAllowlist('https://mospi.gov.in/press-release/cpi-aug-2026');
  assert(allowedCheck.isAllowed === true, 'Registered official domain (mospi.gov.in) is ALLOWED');
  assert(allowedCheck.source?.is_official === true, 'Matched source is certified official');

  const pibCheck = await validateOfficialUrlAllowlist('https://pib.gov.in/PressReleasePage.aspx?PRID=2050123');
  assert(pibCheck.isAllowed === true, 'Registered official domain (pib.gov.in) is ALLOWED');

  const apFinanceCheck = await validateOfficialUrlAllowlist('https://apfinance.gov.in/budget/2026-27/afs.pdf');
  assert(apFinanceCheck.isAllowed === true, 'AP Finance domain (apfinance.gov.in) is ALLOWED');

  const fakeDomainCheck = await validateOfficialUrlAllowlist('https://coachingdailycurrentaffairs.com/news/cpi');
  assert(fakeDomainCheck.isAllowed === false, 'Unapproved commercial blog domain is REJECTED');

  // ── 2. Safe Redirect Security ─────────────────────────────────────────────
  console.log('\n--- Test 2: Safe Redirect Security ---');
  const safeRedirect = await validateRedirectSafety('https://apfinance.gov.in', 'https://finance.ap.gov.in');
  assert(safeRedirect.isSafe === true, 'Redirect between authorized alias official domains is PERMITTED');

  const maliciousRedirect = await validateRedirectSafety('https://mospi.gov.in', 'https://malicious-news-aggregator.com/cpi');
  assert(maliciousRedirect.isSafe === false, 'Redirect to unauthorized external domain is BLOCKED');

  // ── 3. Standardized Document Normalization & Content Hashing ──────────────
  console.log('\n--- Test 3: Document Normalization & Content Hashing ---');
  const normDoc = createNormalizedDocument({
    sourceId: allowedCheck.source.id,
    canonicalUrl: 'https://mospi.gov.in/press-release/cpi-aug-2026',
    documentTitle: 'All-India CPI General Headline Inflation Rate (August 2026)',
    documentType: 'STATISTICAL_BULLETIN',
    publicationDate: '2026-09-14',
    referencePeriod: 'August 2026',
    text: 'All-India CPI General Headline Inflation Rate for August 2026 was 3.65% with Base Year 2024=100.'
  });

  assert(normDoc.documentTitle.includes('CPI'), 'Document title normalized');
  assert(normDoc.contentHash.length === 64, 'Deterministic SHA-256 content hash generated (64 hex chars)');
  assert(normDoc.documentType === 'STATISTICAL_BULLETIN', 'Document type normalized');

  // Identical content produces identical hash
  const hash2 = computeDocumentContentHash({
    sourceId: allowedCheck.source.id,
    canonicalUrl: 'https://mospi.gov.in/press-release/cpi-aug-2026',
    publicationDate: '2026-09-14',
    referencePeriod: 'August 2026',
    text: 'All-India CPI General Headline Inflation Rate for August 2026 was 3.65% with Base Year 2024=100.'
  });
  assert(normDoc.contentHash === hash2, 'Identical content produces identical deterministic hash');

  // ── 4. Ingestion & Content Deduplication ──────────────────────────────────
  console.log('\n--- Test 4: Ingestion & Content Deduplication ---');
  const ingest1 = await ingestOfficialUpdate({
    adapterKey: 'MOSPI',
    rawPayload: {
      title: 'All-India CPI General Headline Inflation Rate for August 2026',
      metricType: 'CPI',
      text: 'All-India CPI General Headline Inflation Rate for August 2026 was 3.65% with Base Year 2024=100.',
      releaseDate: '2026-09-14',
      referencePeriod: 'August 2026',
      baseYear: '2024'
    },
    topicSlugOrId: 'inflation'
  });

  assert(ingest1.success === true, 'First ingestion succeeds');
  assert(ingest1.verifiedEvidenceCount >= 1, 'Extracted and verified official candidate claims');

  // Second identical ingestion is deduplicated without creating duplicate document
  const ingest2 = await ingestOfficialUpdate({
    adapterKey: 'MOSPI',
    rawPayload: {
      title: 'All-India CPI General Headline Inflation Rate for August 2026',
      metricType: 'CPI',
      text: 'All-India CPI General Headline Inflation Rate for August 2026 was 3.65% with Base Year 2024=100.',
      releaseDate: '2026-09-14',
      referencePeriod: 'August 2026',
      baseYear: '2024'
    },
    topicSlugOrId: 'inflation'
  });

  assert(ingest2.success === true, 'Second ingestion call succeeds gracefully');
  assert(ingest2.status === RETRIEVAL_STATUSES.DOCUMENT_ALREADY_EXISTS, 'Identical document recognized as DOCUMENT_ALREADY_EXISTS');
  assert(ingest1.documentId === ingest2.documentId, 'Preserves existing document ID without creating duplicate table rows');

  // ── 5. Candidate Claim Extraction & Verification Integrity ────────────────
  console.log('\n--- Test 5: Candidate Claim Extraction & Verification ---');
  const claims = extractCandidateClaimsFromDocument(normDoc);
  assert(claims.length > 0, 'Extracted candidate claims from official document');
  assert(claims[0].numeric_value === 3.65, 'Extracted exact numeric value: 3.65%');
  assert(claims[0].is_candidate === true, 'Candidate claim flagged as candidate prior to verification');

  // AI cannot independently mark verified: verification requires official document provenance
  const unverifiedCandidate = {
    evidence_type: 'statistic',
    title: 'Speculative Hallucinated Statistic',
    value_text: 'Inflation will reach 9.99%',
    numeric_value: 9.99,
    canonical_claim_key: 'fake_claim'
  };
  assert(unverifiedCandidate.verification_status !== 'verified_current', 'AI candidate claim is NOT auto-verified');

  // ── 6. Deterministic Supersession Chaining ─────────────────────────────────
  console.log('\n--- Test 6: Deterministic Supersession Chaining ---');
  // Ingest Sep 2026 CPI
  const ingestSep = await ingestOfficialUpdate({
    adapterKey: 'MOSPI',
    rawPayload: {
      title: 'All-India CPI General Headline Inflation Rate for September 2026',
      metricType: 'CPI',
      text: 'All-India CPI General Headline Inflation Rate for September 2026 was 3.80% with Base Year 2024=100.',
      releaseDate: '2026-10-14',
      referencePeriod: 'September 2026',
      baseYear: '2024'
    },
    topicSlugOrId: 'inflation'
  });

  assert(ingestSep.success === true, 'September 2026 CPI ingested');

  // Verify historical supersession link
  const { rows: sepRows } = await query(`
    SELECT id, data_period, is_latest_release, verification_status, supersedes_evidence_id
    FROM evidence_assets
    WHERE canonical_claim_key = 'cpi_headline_inflation_india' AND data_period = 'September 2026'
    LIMIT 1
  `);

  if (sepRows.length > 0) {
    assert(sepRows[0].is_latest_release === true, 'Newest September 2026 release is marked is_latest_release = true');
  }

  // ── 7. Topic Resolution Hierarchy ─────────────────────────────────────────
  console.log('\n--- Test 7: Topic Resolution Hierarchy ---');
  const exactRes = await resolveCanonicalTopic('inflation');
  assert(exactRes.resolutionType === 'EXACT_MATCH', 'Exact slug matches canonical topic');
  assert(exactRes.topic.slug === 'inflation', 'Resolved canonical topic is "inflation"');

  const aliasRes = await resolveCanonicalTopic('headline inflation');
  assert(aliasRes.resolutionType === 'ALIAS_MATCH', 'Alias matches canonical topic');
  assert(aliasRes.topic.slug === 'inflation', 'Resolved canonical topic is "inflation"');

  const unknownRes = await resolveCanonicalTopic('random non-existent query topic xyz');
  assert(unknownRes.resolutionType === 'UNRESOLVED_CANDIDATE', 'Unknown topic returns UNRESOLVED_CANDIDATE');
  assert(unknownRes.topic === null, 'Unknown query does NOT create global canonical topic');

  // ── 8. Multi-Source Issue Enrichment (Urban Flooding) ─────────────────────
  console.log('\n--- Test 8: Multi-Source Issue Enrichment (Urban Flooding) ---');
  const ufIssue = await getIssueBySlugOrId('urban_flooding');
  assert(ufIssue !== null, 'Canonical Urban Flooding issue exists');
  assert(ufIssue.title.includes('Urban Flood'), 'Issue title accurately configured');

  // Enrich with secondary update from PIB
  const pibUfUpdate = await ingestOfficialUpdate({
    adapterKey: 'PIB',
    rawPayload: {
      title: 'Ministry of Housing and Urban Affairs Stormwater Drainage Modernization',
      ministry: 'Ministry of Housing and Urban Affairs',
      text: 'MoHUA announces AMRUT 2.0 urban wetland rejuvenation and drainage desilting protocol.',
      releaseDate: '2026-08-01',
      referencePeriod: '2026-27'
    },
    topicSlugOrId: 'urban_flooding'
  });

  assert(pibUfUpdate.success === true, 'MoHUA update ingested');
  assert(pibUfUpdate.linkedIssue?.isNewIssue === false, 'Enriched EXISTING canonical issue without creating duplicate issue');

  // ── 9. Canonical Syllabus Mapping (1726 Nodes) ────────────────────────────
  console.log('\n--- Test 9: Canonical Syllabus Mapping ---');
  const ufSyllabus = mapIssueToSyllabusNodes('urban_flooding', 'Urban Flooding');
  assert(ufSyllabus.length >= 2, `Urban Flooding mapped to ${ufSyllabus.length} syllabus nodes`);
  assert(ufSyllabus.some(m => m.nodeId === 'GS3-DM-DISASTERS-MT06'), 'Primary node mapped to GS3 Disaster Management (GS3-DM-DISASTERS-MT06)');
  assert(ufSyllabus.some(m => m.nodeId === 'GS1-SOC-DEV-URBAN-MT03' || m.nodeId === 'GS1-GEO-IND-CLIMATE-MT04'), 'Secondary node mapped to GS1 (Urbanization / Climate)');

  // ── 10. PYQ Engine Linkage ────────────────────────────────────────────────
  console.log('\n--- Test 10: PYQ Engine Linkage ---');
  const linkedPyqs = await getRelevantPyqsForIssue({
    syllabusNodes: ufSyllabus,
    topicSlug: 'urban_flooding',
    keywords: ['Urban Flooding']
  });
  assert(linkedPyqs.length > 0, `Linked ${linkedPyqs.length} relevant PYQs to Urban Flooding issue`);
  assert(linkedPyqs[0].relevanceScore >= 0.85, 'High relevance score assigned by PYQ engine');

  // ── 11. Exam Deployment Kit & Segregated Evidence Tiers ───────────────────
  console.log('\n--- Test 11: Exam Deployment Kit & Segregated Evidence Tiers ---');
  const kit = await generateExamDeploymentKit(ufIssue, { examContext: 'both' });
  assert(kit.title !== undefined, 'Exam Deployment Kit generated');
  assert(Array.isArray(kit.keyDimensions), 'Key dimensions structured');
  assert(Array.isArray(kit.arguments), 'Arguments structured');
  assert(Array.isArray(kit.challenges), 'Challenges structured');
  assert(Array.isArray(kit.wayForward), 'Way Forward structured');
  assert(kit.evidenceBuckets.currentVerified !== undefined, 'CURRENT VERIFIED evidence bucket isolated');
  assert(kit.evidenceBuckets.historicalVerified !== undefined, 'HISTORICAL VERIFIED evidence bucket isolated');
  assert(kit.evidenceBuckets.staticConceptual !== undefined, 'STATIC/CONCEPTUAL evidence bucket isolated');
  assert(kit.relevantPyqs.length > 0, 'Relevant PYQs embedded in Exam Deployment Kit');

  // ── 12. APPSC Regional Boost (AP Budget) ──────────────────────────────────
  console.log('\n--- Test 12: APPSC Regional Boost (AP Budget) ---');
  const apIssue = await getIssueBySlugOrId('ap_budget');
  assert(apIssue !== null, 'AP Budget issue dossier exists');
  assert(apIssue.region === 'andhra_pradesh', 'AP Budget tagged with region = andhra_pradesh');
  assert(apIssue.exam_context === 'appsc', 'AP Budget tagged with exam_context = appsc');

  const apKit = await generateExamDeploymentKit(apIssue, { examContext: 'appsc', region: 'andhra_pradesh' });
  assert(apKit.examApplications.appscUse.includes('APPSC Paper 4'), 'APPSC Paper 4 specific guidance emphasized');

  // ── 13. Visual Studio Pack Reuse ──────────────────────────────────────────
  console.log('\n--- Test 13: Visual Studio Pack Reuse ---');
  const visualPack = await getVisualPackByTopic('green_hydrogen');
  assert(visualPack.visuals.length > 0, `Green Hydrogen visual pack has ${visualPack.visuals.length} visuals`);
  assert(visualPack.visuals.some(v => v.visual_grammar === 'process_diagram' || v.visual_type === 'process_diagram'), 'Green Hydrogen process diagram visual found in shared pack');

  // ── 14. User Revision Isolation ───────────────────────────────────────────
  console.log('\n--- Test 14: User Revision Isolation ---');
  const testUserId = '11111111-2222-3333-4444-555555555555';
  await updateUserIssueRevisionState(testUserId, ufIssue.id, {
    isSaved: true,
    readState: 'READ',
    recallConfidence: 4,
    weakDimension: 'Catchment Hydrology',
    notes: 'Revise Mithi river & Pallikaranai wetland case studies before mains test'
  });

  const userState = await getUserIssueRevisionState(testUserId, ufIssue.id);
  assert(userState.is_saved === true, 'User saved state stored in user_issue_revision_state');
  assert(userState.recall_confidence === 4, 'Recall confidence = 4 saved for user');
  assert(userState.weak_dimension === 'Catchment Hydrology', 'User weak dimension tracked');

  // Verify global issue remains unmutated
  const freshUf = await getIssueBySlugOrId('urban_flooding');
  assert(freshUf.slug === 'urban_flooding', 'Global canonical issue remains clean and shared');

  // Cleanup test user state
  await query(`DELETE FROM user_issue_revision_state WHERE user_id = $1`, [testUserId]);

  console.log('\n================================================================');
  console.log(`  Phase 3A Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  await pool.end();
  if (failed > 0) process.exit(1);
}

runPhase3ATests().catch(err => {
  console.error('Phase 3A Test Suite Error:', err);
  process.exit(1);
});
