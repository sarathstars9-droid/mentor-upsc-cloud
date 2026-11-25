/**
 * backend/test_phase2d_visual_grammar.mjs
 *
 * Phase 2D: MentorOS Visual Grammar Test Suite.
 * Validates geometric coordinate layout, semantic schema contracts,
 * multi-grammar topic rendering, recommendation engine, and recall masking.
 */

import './config/env.js';
import { query, pool } from './db/index.js';
import { resolveTopicByQuery, getTopicVisualPack } from './services/visualKnowledge/visualKnowledgeService.js';
import { recommendGrammarForDemand, VISUAL_GRAMMARS, GRAMMAR_DRAW_TIMES } from './services/visualKnowledge/visualGrammarSchemas.js';

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

async function runPhase2DTests() {
  console.log('\n================================================================');
  console.log('  MentorOS Phase 2D — Visual Grammar & Geometric Layout Tests');
  console.log('================================================================\n');

  // ── 1. Urban Flooding Multi-Grammar Proof ─────────────────────────────────
  console.log('--- Test 1: Urban Flooding 4+ Genuinely Different Visual Grammars ---');
  const ufTopic = await resolveTopicByQuery('Urban Flooding');
  assert(ufTopic !== null, 'Topic "Urban Flooding" resolved successfully');

  const ufPack = await getTopicVisualPack(ufTopic.id, { examContext: 'both' });
  assert(ufPack.visuals.length >= 4, `Urban Flooding visual pack has ${ufPack.visuals.length} visual assets (>= 4 expected)`);

  const grammarsFound = ufPack.visuals.map(v => v.visual_spec?.visualGrammar || v.visual_type);
  assert(grammarsFound.includes('hub_spoke'), 'Found genuine Hub & Spoke (Mind Map) visual');
  assert(grammarsFound.includes('cause_effect'), 'Found genuine Cause & Effect diagnostic visual');
  assert(grammarsFound.includes('stakeholder_map'), 'Found genuine Stakeholder & Actor Matrix visual');
  assert(grammarsFound.includes('cycle'), 'Found genuine Disaster Management Closed Loop Cycle visual');
  assert(grammarsFound.includes('map_sketch'), 'Found genuine India Hotspots Map Sketch visual');

  // Verify Hub & Spoke semantic schema geometry
  const hubVisual = ufPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'hub_spoke');
  assert(hubVisual.visual_spec?.center === 'URBAN FLOODING', 'Hub Spoke has central concept defined');
  assert(Array.isArray(hubVisual.visual_spec?.spokes) && hubVisual.visual_spec?.spokes.length >= 5, 'Hub Spoke has >= 5 radial spokes');

  // Verify Cause & Effect semantic schema geometry
  const causeVisual = ufPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'cause_effect');
  assert(Array.isArray(causeVisual.visual_spec?.causes) && causeVisual.visual_spec?.causes.length === 3, 'Cause Effect has 3 distinct root causes');
  assert(causeVisual.visual_spec?.issue === 'URBAN FLOODING', 'Cause Effect has central issue defined');
  assert(Array.isArray(causeVisual.visual_spec?.effects) && causeVisual.visual_spec?.effects.length === 3, 'Cause Effect has 3 distinct consequences');
  assert(Array.isArray(causeVisual.visual_spec?.responses) && causeVisual.visual_spec?.responses.length > 0, 'Cause Effect has mitigation solution response');

  // ── 2. Federalism Institutional Web Proof ─────────────────────────────────
  console.log('\n--- Test 2: Federalism Multi-Tier Institutional Web ---');
  const fedTopic = await resolveTopicByQuery('Indian Fiscal & Cooperative Federalism');
  assert(fedTopic !== null, 'Topic "Federalism" resolved successfully');

  const fedPack = await getTopicVisualPack(fedTopic.id, { examContext: 'both' });
  const fedVisual = fedPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'institutional_web');
  assert(fedVisual !== undefined, 'Found Institutional Web visual for Federalism');
  assert(fedVisual.visual_spec?.topTier === 'UNION GOVERNMENT', 'Institutional web has Union Government at top tier');
  assert(Array.isArray(fedVisual.visual_spec?.councils) && fedVisual.visual_spec?.councils.length === 3, 'Institutional web has 3 constitutional councils in middle tier');
  assert(fedVisual.visual_spec?.bottomTier === 'STATE GOVERNMENTS', 'Institutional web has State Governments tier');
  assert(fedVisual.visual_spec?.subTier?.includes('LOCAL BODIES'), 'Institutional web has Local Bodies sub-tier');

  // ── 3. Ethics Stakeholder Map + Decision Tree Proof ───────────────────────
  console.log('\n--- Test 3: Ethics Stakeholder Map & Decision Tree ---');
  const ethicsTopic = await resolveTopicByQuery('Ethical Dilemmas in Governance & Whistleblowing');
  assert(ethicsTopic !== null, 'Topic "Ethics Whistleblowing" resolved successfully');

  const ethicsPack = await getTopicVisualPack(ethicsTopic.id, { examContext: 'both' });
  const ethicsStakeholder = ethicsPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'stakeholder_map');
  const ethicsTree = ethicsPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'decision_tree');

  assert(ethicsStakeholder !== undefined, 'Found Stakeholder Map for Ethics case study');
  assert(ethicsStakeholder.visual_spec?.centralIssue?.includes('Dilemma'), 'Stakeholder map places Officer Dilemma at center');
  assert(ethicsStakeholder.visual_spec?.stakeholders?.length >= 5, 'Stakeholder map defines >= 5 institutional & civil actors');

  assert(ethicsTree !== undefined, 'Found Decision Tree for Ethics dilemma');
  assert(Array.isArray(ethicsTree.visual_spec?.branches) && ethicsTree.visual_spec?.branches.length === 3, 'Decision tree has 3 distinct option branches');
  assert(ethicsTree.visual_spec?.branches.some(b => b.verdictType === 'positive'), 'Decision tree contains positive ethical verdict leaf');
  assert(ethicsTree.visual_spec?.branches.some(b => b.verdictType === 'negative'), 'Decision tree contains negative verdict leaf');

  // ── 4. El Niño Atmospheric Geography Process Sketch Proof ─────────────────
  console.log('\n--- Test 4: Physical Geography Process Diagram (El Niño / Monsoon) ---');
  const geoTopic = await resolveTopicByQuery('El Niño & Indian Monsoon Walker Circulation');
  assert(geoTopic !== null, 'Topic "El Niño" resolved successfully');

  const geoPack = await getTopicVisualPack(geoTopic.id, { examContext: 'both' });
  const geoVisual = geoPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'geography_sketch');
  assert(geoVisual !== undefined, 'Found Physical Geography Process Diagram for El Niño');
  assert(geoVisual.visual_spec?.title?.includes('El Niño') || geoVisual.title?.includes('El Niño'), 'Process diagram covers El Niño Walker circulation');

  // ── 5. Grammar-Aware Visual Recommendation Engine ────────────────────────
  console.log('\n--- Test 5: Question Demand Grammar Recommendation Engine ---');
  const rec1 = recommendGrammarForDemand({ directive: 'Trace the evolution of constitutional acts from 1773 to 1935' });
  assert(rec1.recommendedGrammar === VISUAL_GRAMMARS.TIMELINE, 'Evolution prompt correctly recommends Timeline grammar');

  const rec2 = recommendGrammarForDemand({ directive: 'Compare the unitary vs federal features of Indian Constitution' });
  assert(rec2.recommendedGrammar === VISUAL_GRAMMARS.MATRIX, 'Compare prompt correctly recommends Matrix grammar');

  const rec3 = recommendGrammarForDemand({ questionText: 'Discuss the ethical dilemma and course of action available to the district magistrate' });
  assert(rec3.recommendedGrammar === VISUAL_GRAMMARS.DECISION_TREE, 'Dilemma course of action recommends Decision Tree grammar');

  const rec4 = recommendGrammarForDemand({ questionText: 'Explain the mechanism of El Niño and its impact on the Indian monsoon circulation' });
  assert(rec4.recommendedGrammar === VISUAL_GRAMMARS.GEOGRAPHY_SKETCH, 'Atmospheric mechanism recommends Geography Process Sketch');

  const rec5 = recommendGrammarForDemand({ questionText: 'Highlight the key institutional relationships between Centre, States, and GST Council' });
  assert(rec5.recommendedGrammar === VISUAL_GRAMMARS.INSTITUTIONAL_WEB, 'Centre-State institutional relationships recommend Institutional Web');

  const rec6 = recommendGrammarForDemand({ questionText: 'Identify the spatial vulnerability hotspots of coastal flooding across Indian mega cities' });
  assert(rec6.recommendedGrammar === VISUAL_GRAMMARS.MAP_SKETCH, 'Spatial vulnerability hotspots recommend Map Sketch');

  // ── 6. Draw Time Estimation Integrity ─────────────────────────────────────
  console.log('\n--- Test 6: Draw Time Estimation by Grammar ---');
  assert(GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.HUB_SPOKE] === 25, 'Hub Spoke target time is 25s');
  assert(GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.MAP_SKETCH] === 60, 'Map Sketch target time is 60s');
  assert(GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.INSTITUTIONAL_WEB] === 40, 'Institutional Web target time is 40s');
  assert(GRAMMAR_DRAW_TIMES[VISUAL_GRAMMARS.GEOGRAPHY_SKETCH] === 50, 'Geography Process Sketch target time is 50s');

  // ── 7. Evidence Provenance Integrity Audit ────────────────────────────────
  console.log('\n--- Test 7: No Manual SQL Verification Shortcuts in Application Services ---');
  const { rows: liveEvidence } = await query(`
    SELECT id, title, canonical_claim_key, provenance_origin, verification_status
    FROM evidence_assets
    WHERE verification_status = 'verified_current'
  `);
  assert(liveEvidence.length > 0, `Found ${liveEvidence.length} verified_current evidence records`);
  for (const ev of liveEvidence) {
    assert(
      ev.provenance_origin === 'live_official_retrieval' || ev.provenance_origin === 'manual_official_import',
      `Evidence "${ev.title}" has trusted official provenance origin (${ev.provenance_origin})`
    );
  }

  // ── 8. Process Diagram Schema & Green Hydrogen Proof ─────────────────────
  console.log('\n--- Test 8: Process Diagram Schema & Green Hydrogen Architecture ---');
  const ghTopic = await resolveTopicByQuery('Green Hydrogen');
  assert(ghTopic !== null, 'Topic "Green Hydrogen" resolved successfully');

  const ghPack = await getTopicVisualPack(ghTopic.id, { examContext: 'both' });
  const ghVisual = ghPack.visuals.find(v => (v.visual_spec?.visualGrammar || v.visual_type) === 'process_diagram');
  assert(ghVisual !== undefined, 'Found Process Diagram visual for Green Hydrogen');
  assert(Array.isArray(ghVisual.visual_spec?.inputs) && ghVisual.visual_spec?.inputs.length >= 2, 'Process diagram has >= 2 input streams');
  assert(Array.isArray(ghVisual.visual_spec?.stages) && ghVisual.visual_spec?.stages.length >= 2, 'Process diagram has transformation stages');
  assert(ghVisual.visual_spec?.stages[0]?.byproducts?.length > 0, 'Process diagram has byproduct split (O2 stream)');
  assert(Array.isArray(ghVisual.visual_spec?.outputs) && ghVisual.visual_spec?.outputs.length >= 3, 'Process diagram has >= 3 end-use market outputs');
  assert(Array.isArray(ghVisual.visual_spec?.feedback) && ghVisual.visual_spec?.feedback.length > 0, 'Process diagram includes grid feedback return loop');

  // ── 9. Universal Numeric & Evidence Safety Gate Across ALL Grammars ───────
  console.log('\n--- Test 9: Universal Numeric Claim Safety Gate Across Grammars ---');
  const { validateVisualSpecification } = await import('./services/visualGeneration/visualValidationService.js');

  // Case A: Unverified numeric claim in cause_effect -> REJECTED
  const invalidCauseEffect = {
    visualGrammar: 'cause_effect',
    issue: 'URBAN FLOODING',
    causes: ['Precipitation (>100mm/hr)', 'Wetland Encroachments'],
    effects: ['Economic Paralysis']
  };
  const resInvalidCause = validateVisualSpecification('cause_effect', invalidCauseEffect, []);
  assert(resInvalidCause.isValid === false, 'Unverified numeric claim in cause_effect (>100mm/hr) REJECTED');

  // Case B: Unverified numeric claim in geography_sketch -> REJECTED
  const invalidGeoSketch = {
    visualGrammar: 'geography_sketch',
    title: 'El Niño Warming',
    regions: ['West Pacific', '>30°C anomalous warming in East Pacific']
  };
  const resInvalidGeo = validateVisualSpecification('geography_sketch', invalidGeoSketch, []);
  assert(resInvalidGeo.isValid === false, 'Unverified numeric claim in geography_sketch (>30°C) REJECTED');

  // Case C: Conceptual replacement -> ACCEPTED
  const validCauseEffect = {
    visualGrammar: 'cause_effect',
    issue: 'URBAN FLOODING',
    causes: ['Extreme Heavy Precipitation', 'Wetland Encroachments'],
    effects: ['Economic Paralysis'],
    responses: ['Sponge Cities Drainage Masterplan']
  };
  const resValidCause = validateVisualSpecification('cause_effect', validCauseEffect, []);
  assert(resValidCause.isValid === true, 'Conceptual phrasing in cause_effect ACCEPTED');

  // Case D: Constitutional Articles and Amendments are NOT mistakenly blocked
  const validPolityWeb = {
    visualGrammar: 'institutional_web',
    topTier: 'UNION GOVERNMENT',
    councils: [
      { name: 'Finance Commission', art: 'Art 280 (Tax Devolution)' },
      { name: 'GST Council', art: 'Art 279A (Indirect Taxation)' }
    ],
    subTier: '73rd & 74th CAA Local Bodies'
  };
  const resPolityWeb = validateVisualSpecification('institutional_web', validPolityWeb, []);
  assert(resPolityWeb.isValid === true, 'Constitutional Article 280 & 73rd CAA are NOT mistakenly blocked');

  // Case E: Historical years & step numbers are NOT mistakenly blocked
  const validTimeline = {
    visualGrammar: 'timeline',
    events: [
      { title: 'Regulating Act', year: '1773' },
      { title: 'Government of India Act', year: '1858' },
      { title: 'Indian Independence Act', year: '1947' }
    ]
  };
  const resTimeline = validateVisualSpecification('timeline', validTimeline, []);
  assert(resTimeline.isValid === true, 'Historical timeline years (1773, 1858, 1947) are NOT mistakenly blocked');

  // Case F: Chemical formulas & step numbers in process_diagram are NOT mistakenly blocked
  const validProcess = {
    visualGrammar: 'process_diagram',
    inputs: [{ label: 'Renewable Electricity', subtext: 'Solar / Wind' }, { label: 'Water (H2O)' }],
    stages: [{ name: 'Step 1: PEM Electrolysis', byproducts: [{ label: 'O2 Gas' }] }],
    outputs: [{ label: 'Green Steel & Green Ammonia' }]
  };
  const resProcess = validateVisualSpecification('process_diagram', validProcess, []);
  assert(resProcess.isValid === true, 'Process diagram with H2O, O2, and Step 1 is NOT mistakenly blocked');

  // Case G: Historical numeric claim without verified evidence -> REJECTED
  const unverifiedHistSpec = {
    visualGrammar: 'flowchart',
    title: 'AP Budget FY 2025-26',
    isHistorical: true,
    nodes: ['Revenue Exp 78%', 'CapEx 22%']
  };
  const resUnverifiedHist = validateVisualSpecification('flowchart', unverifiedHistSpec, []);
  assert(resUnverifiedHist.isValid === false, 'Historical numeric claim without evidence (78% / 22%) REJECTED');

  // Case H: Historical numeric claim linked to verified_historical -> ACCEPTED
  const histEvidence312 = [{
    numeric_value: 312000,
    value_text: 'Rs. 3,12,000 Crore',
    is_official: true,
    verification_status: 'verified_historical',
    data_period: 'FY 2025-26'
  }];
  const verifiedHistSpec = {
    visualGrammar: 'flowchart',
    title: 'AP State Budget Allocation FY 2025-26 (Historical)',
    isHistorical: true,
    data_period: 'FY 2025-26',
    nodes: [
      'Total Outlay Rs 3.12 Lakh Cr',
      'Revenue Expenditure Outlay',
      'Capital Expenditure & Infrastructure',
      'Fiscal Deficit / FRBM Framework'
    ]
  };
  const resVerifiedHist = validateVisualSpecification('flowchart', verifiedHistSpec, histEvidence312);
  assert(resVerifiedHist.isValid === true, 'Historical numeric claim backed by verified_historical evidence ACCEPTED');

  // Case I: Current numeric claim CANNOT use verified_historical evidence
  const currentSpecWithHistEv = {
    visualGrammar: 'flowchart',
    title: 'Current AP Budget Flowchart',
    isHistorical: false,
    nodes: ['Total Outlay Rs 3.12 Lakh Cr']
  };
  const resCurrentWithHist = validateVisualSpecification('flowchart', currentSpecWithHistEv, histEvidence312);
  assert(resCurrentWithHist.isValid === false, 'Current numeric claim CANNOT use verified_historical evidence');

  // Case J: FY 2026-27 evidence CANNOT validate FY 2025-26 historical number
  const currentEv2026 = [{
    numeric_value: 312000,
    value_text: 'Rs. 3,12,000 Crore',
    is_official: true,
    verification_status: 'verified_current',
    data_period: 'FY 2026-27'
  }];
  const resMismatchPeriod = validateVisualSpecification('flowchart', verifiedHistSpec, currentEv2026);
  assert(resMismatchPeriod.isValid === false, 'FY 2026-27 evidence CANNOT validate FY 2025-26 historical visual');

  // Case K: Normalized FY 2025-26 period match succeeds (e.g. 2025-26 matches FY 2025-26)
  const normPeriodEvidence = [{
    numeric_value: 312000,
    value_text: 'Rs. 3,12,000 Crore',
    is_official: true,
    verification_status: 'verified_historical',
    data_period: '2025-26'
  }];
  const resNormPeriod = validateVisualSpecification('flowchart', verifiedHistSpec, normPeriodEvidence);
  assert(resNormPeriod.isValid === true, 'Normalized 2025-26 period match with FY 2025-26 succeeds');

  // Case L: Legacy verified_official status rejected
  const legacyEvidence = [{
    numeric_value: 312000,
    value_text: 'Rs. 3,12,000 Crore',
    is_official: true,
    verification_status: 'verified_official',
    data_period: 'FY 2025-26'
  }];
  const resLegacy = validateVisualSpecification('flowchart', verifiedHistSpec, legacyEvidence);
  assert(resLegacy.isValid === false, 'Legacy verified_official status is REJECTED');

  // Case M: Unsupported "FRBM Compliant" assertion rejected
  const frbmAssertionSpec = {
    visualGrammar: 'flowchart',
    title: 'AP Budget Historical',
    isHistorical: true,
    nodes: [
      'Revenue Expenditure Outlay',
      'Fiscal Deficit Management (FRBM Compliant)'
    ]
  };
  const resFrbmAssertion = validateVisualSpecification('flowchart', frbmAssertionSpec, []);
  assert(resFrbmAssertion.isValid === false, 'Unsupported "FRBM Compliant" assertion REJECTED');

  // Case N: "Fiscal Deficit / FRBM Framework" accepted as conceptual
  const frbmConceptualSpec = {
    visualGrammar: 'flowchart',
    title: 'AP Budget Historical',
    isHistorical: true,
    nodes: [
      'Revenue Expenditure Outlay',
      'Fiscal Deficit / FRBM Framework'
    ]
  };
  const resFrbmConceptual = validateVisualSpecification('flowchart', frbmConceptualSpec, []);
  assert(resFrbmConceptual.isValid === true, '"Fiscal Deficit / FRBM Framework" accepted as conceptual');

  // Case O: Unsupported "Amaravati Outlay" assertion rejected
  const amaravatiAssertionSpec = {
    visualGrammar: 'flowchart',
    title: 'AP Budget Historical',
    isHistorical: true,
    nodes: [
      'Revenue Expenditure Outlay',
      'Capital Expenditure & Amaravati Outlay'
    ]
  };
  const resAmaravatiAssertion = validateVisualSpecification('flowchart', amaravatiAssertionSpec, []);
  assert(resAmaravatiAssertion.isValid === false, 'Unsupported "Amaravati Outlay" assertion REJECTED');

  // Case P: Evidence-backed Amaravati allocation accepted if exact evidence exists
  const amaravatiEvidence = [{
    canonical_claim_key: 'amaravati_capital_outlay',
    title: 'Amaravati Capital City Allocation',
    value_text: 'Amaravati Outlay',
    verification_status: 'verified_historical',
    data_period: 'FY 2025-26'
  }];
  const resAmaravatiBacked = validateVisualSpecification('flowchart', amaravatiAssertionSpec, amaravatiEvidence);
  assert(resAmaravatiBacked.isValid === true, 'Evidence-backed Amaravati allocation ACCEPTED');

  // Case Q: Conceptual historical visual renders cleanly without numeric evidence
  const conceptualHistSpec = {
    visualGrammar: 'flowchart',
    title: 'Historical Fiscal Framework',
    isHistorical: true,
    nodes: [
      'Total Budget Outlay Envelope',
      'Revenue Expenditure Allocation',
      'Capital Outlay Priority',
      'Fiscal Deficit Target'
    ]
  };
  const resConceptualHist = validateVisualSpecification('flowchart', conceptualHistSpec, []);
  assert(resConceptualHist.isValid === true, 'Conceptual historical visual renders without numeric evidence');

  // ── 10. Safe Deterministic Seed Reconciliation ────────────────────────────
  console.log('\n--- Test 10: Safe Deterministic Seed Reconciliation ---');
  // Insert a test AI-generated visual asset
  const insertAiRes = await query(`
    INSERT INTO visual_assets (
      topic_id, title, visual_type, visual_spec, origin,
      target_draw_seconds, is_canonical, is_published, created_at, updated_at
    )
    VALUES ($1, 'User Generated Mindmap Test Asset', 'hub_spoke', '{"center":"TEST"}'::jsonb, 'ai_generated', 25, FALSE, TRUE, NOW(), NOW())
    RETURNING id
  `, [ghTopic.id]);
  const testAiId = insertAiRes.rows[0].id;

  // Run seed function
  const { seedVisualKnowledgeDev } = await import('./scripts/seed_visual_knowledge_dev.js');
  await seedVisualKnowledgeDev();

  // Verify test AI generated asset was NOT deleted
  const checkAiRes = await query(`SELECT id FROM visual_assets WHERE id = $1`, [testAiId]);
  assert(checkAiRes.rows.length === 1, 'Development seed reconciliation PRESERVED ai_generated visual asset');

  // Cleanup test-specific fixture
  await query(`DELETE FROM visual_assets WHERE id = $1`, [testAiId]);

  console.log('\n================================================================');
  console.log(`  Phase 2D.1 Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  await pool.end();
  if (failed > 0) process.exit(1);
}

runPhase2DTests().catch(err => {
  console.error('Test Suite Unhandled Exception:', err);
  process.exit(1);
});
