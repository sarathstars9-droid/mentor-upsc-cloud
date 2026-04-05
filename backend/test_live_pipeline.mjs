/**
 * test_live_pipeline.mjs
 *
 * LIVE pipeline verification against real OCR data.
 * Tests exactly the 4 scenarios requested.
 *
 * Run: node test_live_pipeline.mjs
 */

import { processOcrText } from './ocrMapping/index.js';

// ANSI color helpers
const G = '\x1b[32m'; const R = '\x1b[31m'; const Y = '\x1b[33m';
const B = '\x1b[36m'; const W = '\x1b[1m'; const X = '\x1b[0m';

let pass = 0, fail = 0, warn = 0;

function ok(label)  { pass++; console.log(`  ${G}✓${X} ${label}`); }
function err(label, got, exp) {
  fail++;
  console.log(`  ${R}✗${X} ${label}`);
  console.log(`      got:      ${JSON.stringify(got)}`);
  console.log(`      expected: ${JSON.stringify(exp)}`);
}
function note(label) { console.log(`  ${Y}→${X} ${label}`); }
function head(s) { console.log(`\n${W}${B}── ${s} ──${X}`); }

function assert(label, condition, got = '', exp = '') {
  if (condition) ok(label);
  else err(label, got, exp);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: dump a compact result block
// ─────────────────────────────────────────────────────────────────────────────
function dump(label, r) {
  console.log(`\n  ${W}${label}${X}`);
  console.log(`  stage=       ${r.stage}`);
  console.log(`  gsPaper=     ${r.gsPaper}`);
  console.log(`  subjectId=   ${r.subjectId}`);
  console.log(`  subjectName= ${r.subjectName}`);
  console.log(`  nodeId=      ${r.nodeId}`);
  console.log(`  nodeName=    ${r.nodeName}`);
  console.log(`  isMiscGen=   ${r.isMiscGen}`);
  console.log(`  isSplit=     ${r.isSplit || false}`);
  console.log(`  source=      ${r.mappingSource}`);
  console.log(`  badge=       ${r.confidenceBadge}`);
  if (r.subBlocks) {
    console.log(`  subBlocks:   ${r.subBlocks.length} blocks`);
    r.subBlocks.forEach((sb, i) => {
      console.log(`    [${i}] stage=${sb.stage}  subject=${sb.subjectId}  subject=${sb.subjectName}  splitMin=${sb.splitMinutes}  nodeId=${sb.nodeId}`);
    });
  }
  if (r.warnings?.length) console.log(`  warnings=    ${r.warnings.join(', ')}`);
  console.log('');
}

// =============================================================================
console.log(`\n${W}${B}=== LIVE OCR PIPELINE VERIFICATION ===${X}\n`);

// =============================================================================
// TEST 1: "Environment - Ecology Biodiversity"
// Expected:
//   - subject = GS3-ENV (Environment)
//   - node resolves to biodiversity leaf (not null if data exists)
//   - stage = general (no explicit prelims/mains)
//   - isMiscGen = false
//   - mappingSource ≠ MISC-GEN
// =============================================================================
head('TEST 1: Environment - Ecology Biodiversity');
{
  const r = processOcrText('Environment - Ecology Biodiversity', { minutes: 150 });
  dump('Result', r);

  assert('stage = general (no prelims/mains keyword)',
    r.stage === 'general', r.stage, 'general');

  assert('gsPaper = null',
    r.gsPaper === null, r.gsPaper, null);

  assert('isMiscGen = false (syllabus block, never MISC-GEN)',
    r.isMiscGen === false, r.isMiscGen, false);

  assert('mappingSource ≠ MISC-GEN',
    r.mappingSource !== 'MISC-GEN', r.mappingSource, '!= MISC-GEN');

  assert('subjectId = GS3-ENV (Environment resolved)',
    r.subjectId === 'GS3-ENV', r.subjectId, 'GS3-ENV');

  const isBiodiversityLeaf = (
    r.nodeId !== null &&
    typeof r.nodeName === 'string' &&
    (r.nodeName.toLowerCase().includes('biodiversity') ||
     r.nodeName.toLowerCase().includes('ecology') ||
     (r.nodeId && r.nodeId.startsWith('GS3-ENV')))
  );
  assert('nodeId resolves to environment/biodiversity node (not null)',
    isBiodiversityLeaf, `nodeId=${r.nodeId} nodeName=${r.nodeName}`, 'GS3-ENV biodiversity node');

  assert('isSplit = false (single subject)',
    !r.isSplit, r.isSplit, false);
}

// =============================================================================
// TEST 2: "Economy - Prelims - Inflation"
// Expected:
//   - stage = prelims
//   - subject = GS3-ECO
//   - nodeId resolves to inflation leaf (if exists in prelims pool)
//   - isMiscGen = false
//   - subjectResolvedWithPrelimsFilter = true (mains nodes suppressed)
// =============================================================================
head('TEST 2: Economy - Prelims - Inflation');
{
  const r = processOcrText('Economy - Prelims - Inflation', { minutes: 150 });
  dump('Result', r);

  assert('stage = prelims',
    r.stage === 'prelims', r.stage, 'prelims');

  assert('gsPaper = null (no GS number specified)',
    r.gsPaper === null, r.gsPaper, null);

  assert('isMiscGen = false',
    r.isMiscGen === false, r.isMiscGen, false);

  assert('subjectId = GS3-ECO (Economy)',
    r.subjectId === 'GS3-ECO', r.subjectId, 'GS3-ECO');

  assert('mappingSource ≠ MISC-GEN',
    r.mappingSource !== 'MISC-GEN', r.mappingSource, '!= MISC-GEN');

  // stageLock must be prelims — verify no mains-only warning
  assert('no MIXED_BLOCK_SPLIT warning (single subject)',
    !(r.warnings || []).includes('MIXED_BLOCK_SPLIT'), r.warnings, '!includes MIXED_BLOCK_SPLIT');

  if (r.nodeId) {
    assert('nodeId is an Economy node (GS3-ECO prefix)',
      r.nodeId.startsWith('GS3-ECO'), r.nodeId, 'starts with GS3-ECO');
    note(`Inflation resolved to: ${r.nodeId} → "${r.nodeName}"`);
  } else {
    note(`nodeId=null — topic node for Inflation not found in pool (stage filter may have narrowed it). subjectId still correct.`);
    warn++;
  }
}

// =============================================================================
// TEST 3: "Polity - GS-2 Mains"
// Expected:
//   - stage = mains
//   - gsPaper = GS2
//   - subjectId = GS2-POL
//   - nodeId may be null (broad block, no specific topic)
//   - isMiscGen = false  ← critical
//   - mappingSource ≠ MISC-GEN
// =============================================================================
head('TEST 3: Polity - GS-2 Mains');
{
  const r = processOcrText('Polity - GS-2 Mains', { minutes: 150 });
  dump('Result', r);

  assert('stage = mains',
    r.stage === 'mains', r.stage, 'mains');

  assert('gsPaper = GS2',
    r.gsPaper === 'GS2', r.gsPaper, 'GS2');

  assert('isMiscGen = false (MUST NEVER BE MISC-GEN)',
    r.isMiscGen === false, r.isMiscGen, false);

  assert('mappingSource ≠ MISC-GEN',
    r.mappingSource !== 'MISC-GEN', r.mappingSource, '!= MISC-GEN');

  assert('subjectId = GS2-POL (Polity)',
    r.subjectId === 'GS2-POL', r.subjectId, 'GS2-POL');

  // nodeId is allowed to be null for a broad GS2 Polity block (no specific topic)
  if (r.nodeId === null) {
    ok('nodeId=null is acceptable for broad "Polity GS-2 Mains" block (no specific topic provided)');
  } else {
    assert('nodeId starts with GS2-POL',
      r.nodeId.startsWith('GS2-POL'), r.nodeId, 'starts with GS2-POL');
    note(`Resolved to: ${r.nodeId} → "${r.nodeName}"`);
  }

  assert('isSplit = false',
    !r.isSplit, r.isSplit, false);
}

// =============================================================================
// TEST 4: "PYQs - History Prelims Economy"
// Expected:
//   - isSplit = true
//   - 2 sub-blocks: History + Economy
//   - each sub-block: stage = prelims
//   - each sub-block: 75 min (equal split of 150)
//   - isMiscGen = false at root level
//   - no sub-block should be MISC-GEN
// =============================================================================
head('TEST 4: PYQs - History Prelims Economy (mixed split)');
{
  const r = processOcrText('PYQs - History Prelims Economy', { minutes: 150 });
  dump('Result', r);

  assert('root isMiscGen = false',
    r.isMiscGen === false, r.isMiscGen, false);

  assert('isSplit = true (mixed subjects detected)',
    r.isSplit === true, r.isSplit, true);

  assert('subBlocks exists and has 2 entries',
    Array.isArray(r.subBlocks) && r.subBlocks.length === 2,
    r.subBlocks?.length, 2);

  if (Array.isArray(r.subBlocks) && r.subBlocks.length >= 2) {
    const sb0 = r.subBlocks[0];
    const sb1 = r.subBlocks[1];

    // Sub-block subjects
    const subjectSlugs = [sb0.subjectId, sb1.subjectId].sort();

    const hasHistory = subjectSlugs.includes('GS1-HIS') || 
      [sb0.subjectId, sb1.subjectId].some(s => s && s.startsWith('GS1-HIS'));
    const hasEconomy = subjectSlugs.includes('GS3-ECO') ||
      [sb0.subjectId, sb1.subjectId].some(s => s && s.startsWith('GS3-ECO'));

    assert('sub-block 0: History subject (GS1-HIS)',
      hasHistory, `sb0=${sb0.subjectId} sb1=${sb1.subjectId}`, 'one of them = GS1-HIS');

    assert('sub-block 1: Economy subject (GS3-ECO)',
      hasEconomy, `sb0=${sb0.subjectId} sb1=${sb1.subjectId}`, 'one of them = GS3-ECO');

    assert('sub-block 0: stage = prelims',
      sb0.stage === 'prelims', sb0.stage, 'prelims');

    assert('sub-block 1: stage = prelims',
      sb1.stage === 'prelims', sb1.stage, 'prelims');

    assert('sub-block 0: splitMinutes = 75',
      sb0.splitMinutes === 75, sb0.splitMinutes, 75);

    assert('sub-block 1: splitMinutes = 75',
      sb1.splitMinutes === 75, sb1.splitMinutes, 75);

    assert('sub-block 0: isMiscGen = false',
      sb0.isMiscGen === false, sb0.isMiscGen, false);

    assert('sub-block 1: isMiscGen = false',
      sb1.isMiscGen === false, sb1.isMiscGen, false);

    assert('mappingSource = SPLIT (not MISC-GEN)',
      r.mappingSource === 'SPLIT', r.mappingSource, 'SPLIT');

    note(`Sub-block 0: ${sb0.subjectId} "${sb0.subjectName}" ${sb0.splitMinutes}min  nodeId=${sb0.nodeId}`);
    note(`Sub-block 1: ${sb1.subjectId} "${sb1.subjectName}" ${sb1.splitMinutes}min  nodeId=${sb1.nodeId}`);
  }
}

// =============================================================================
// BONUS: Verify MISC-GEN still works for legitimate use cases
// =============================================================================
head('BONUS: MISC-GEN for explicit generic intents (must still work)');
{
  const cases = [
    { input: 'Current Affairs', expectMisc: true },
    { input: 'Mock Analysis GS3', expectMisc: true },
    { input: 'Admin planning session', expectMisc: true },
    { input: 'Polity Revision', expectMisc: false },
    { input: 'Environment Prelims', expectMisc: false },
  ];
  for (const { input, expectMisc } of cases) {
    const r = processOcrText(input);
    assert(`"${input}" → isMiscGen=${expectMisc}`,
      r.isMiscGen === expectMisc, r.isMiscGen, expectMisc);
  }
}

// =============================================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`${W}RESULTS: ${G}${pass} passed${X}  ${R}${fail} failed${X}  ${Y}${warn} notes${X}`);
if (fail === 0) {
  console.log(`${G}${W}All pipeline tests passed! ✓${X}\n`);
} else {
  console.log(`${R}${W}${fail} test(s) FAILED — see above for details.${X}\n`);
  process.exit(1);
}
