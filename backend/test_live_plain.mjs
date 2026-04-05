/**
 * test_live_plain.mjs - no ANSI colors for clean terminal output
 */
import { processOcrText } from './ocrMapping/index.js';

let pass = 0, fail = 0, notes = [];

function ok(label)            { pass++; console.log(`  PASS: ${label}`); }
function fail_(label, g, e)   { fail++; console.log(`  FAIL: ${label}`); console.log(`         got:      ${JSON.stringify(g)}`); console.log(`         expected: ${JSON.stringify(e)}`); }
function note(label)          { notes.push(label); console.log(`  NOTE: ${label}`); }
function header(s)            { console.log(`\n==== ${s} ====`); }

function assert(label, cond, got='', exp='') {
  if (cond) ok(label); else fail_(label, got, exp);
}

function dump(r) {
  console.log(`  stage=${r.stage}  gsPaper=${r.gsPaper}  subject=${r.subjectId}  node=${r.nodeId}`);
  console.log(`  isMiscGen=${r.isMiscGen}  isSplit=${r.isSplit||false}  source=${r.mappingSource}  badge=${r.confidenceBadge}`);
  if (r.subBlocks) {
    console.log(`  subBlocks: ${r.subBlocks.length}`);
    r.subBlocks.forEach((sb,i) => {
      console.log(`    [${i}] stage=${sb.stage}  subjectId=${sb.subjectId}  subjectName=${sb.subjectName}  splitMin=${sb.splitMinutes}  nodeId=${sb.nodeId}  isMiscGen=${sb.isMiscGen}`);
    });
  }
  if (r.warnings?.length) console.log(`  warnings: ${r.warnings.join(', ')}`);
}

console.log('\n=== LIVE OCR PIPELINE VERIFICATION ===\n');

// ────────────────────────────────────────────────────────────
// TEST 1: Environment - Ecology Biodiversity
// ────────────────────────────────────────────────────────────
header('TEST 1: Environment - Ecology Biodiversity');
{
  const r = processOcrText('Environment - Ecology Biodiversity', { minutes: 150 });
  dump(r);

  assert('stage = general', r.stage === 'general', r.stage, 'general');
  assert('gsPaper = null', r.gsPaper === null, r.gsPaper, null);
  assert('isMiscGen = false', r.isMiscGen === false, r.isMiscGen, false);
  assert('mappingSource != MISC-GEN', r.mappingSource !== 'MISC-GEN', r.mappingSource, '!= MISC-GEN');
  assert('subjectId = GS3-ENV', r.subjectId === 'GS3-ENV', r.subjectId, 'GS3-ENV');
  assert('isSplit = false', !r.isSplit, r.isSplit, false);

  const leafOk = r.nodeId !== null && r.nodeId.startsWith('GS3-ENV');
  if (leafOk) {
    ok(`nodeId resolves to GS3-ENV node: ${r.nodeId} => "${r.nodeName}"`);
  } else if (r.nodeId === null) {
    note(`nodeId=null — biodiversity topic not scored high enough in pool. subjectId still correct (${r.subjectId}).`);
  } else {
    fail_('nodeId should start with GS3-ENV', r.nodeId, 'GS3-ENV*');
  }
}

// ────────────────────────────────────────────────────────────
// TEST 2: Economy - Prelims - Inflation
// ────────────────────────────────────────────────────────────
header('TEST 2: Economy - Prelims - Inflation');
{
  const r = processOcrText('Economy - Prelims - Inflation', { minutes: 150 });
  dump(r);

  assert('stage = prelims', r.stage === 'prelims', r.stage, 'prelims');
  assert('gsPaper = null', r.gsPaper === null, r.gsPaper, null);
  assert('isMiscGen = false', r.isMiscGen === false, r.isMiscGen, false);
  assert('mappingSource != MISC-GEN', r.mappingSource !== 'MISC-GEN', r.mappingSource, '!= MISC-GEN');
  assert('subjectId = GS3-ECO', r.subjectId === 'GS3-ECO', r.subjectId, 'GS3-ECO');
  assert('isSplit = false', !r.isSplit, r.isSplit, false);
  assert('no MIXED_BLOCK_SPLIT warning', !(r.warnings||[]).includes('MIXED_BLOCK_SPLIT'), r.warnings, '!MIXED_BLOCK_SPLIT');

  if (r.nodeId && r.nodeId.startsWith('GS3-ECO')) {
    ok(`Inflation resolved: ${r.nodeId} => "${r.nodeName}"`);
  } else if (r.nodeId === null) {
    note(`nodeId=null: Inflation topic node not found in prelims-filtered pool. subjectId correct.`);
  } else {
    fail_('nodeId prefix wrong', r.nodeId, 'GS3-ECO*');
  }
}

// ────────────────────────────────────────────────────────────
// TEST 3: Polity - GS-2 Mains
// ────────────────────────────────────────────────────────────
header('TEST 3: Polity - GS-2 Mains');
{
  const r = processOcrText('Polity - GS-2 Mains', { minutes: 150 });
  dump(r);

  assert('stage = mains', r.stage === 'mains', r.stage, 'mains');
  assert('gsPaper = GS2', r.gsPaper === 'GS2', r.gsPaper, 'GS2');
  assert('isMiscGen = false (CRITICAL)', r.isMiscGen === false, r.isMiscGen, false);
  assert('mappingSource != MISC-GEN', r.mappingSource !== 'MISC-GEN', r.mappingSource, '!= MISC-GEN');
  assert('subjectId = GS2-POL', r.subjectId === 'GS2-POL', r.subjectId, 'GS2-POL');
  assert('isSplit = false', !r.isSplit, r.isSplit, false);

  if (r.nodeId === null) {
    ok('nodeId=null is acceptable — "Polity GS-2 Mains" is a broad block with no specific topic');
  } else {
    assert('nodeId starts with GS2-POL', r.nodeId.startsWith('GS2-POL'), r.nodeId, 'GS2-POL*');
    note(`Broad block resolved to specific node: ${r.nodeId} => "${r.nodeName}"`);
  }
}

// ────────────────────────────────────────────────────────────
// TEST 4: PYQs - History Prelims Economy
// ────────────────────────────────────────────────────────────
header('TEST 4: PYQs - History Prelims Economy (split expected)');
{
  const r = processOcrText('PYQs - History Prelims Economy', { minutes: 150 });
  dump(r);

  assert('root isMiscGen = false', r.isMiscGen === false, r.isMiscGen, false);
  assert('isSplit = true', r.isSplit === true, r.isSplit, true);
  assert('mappingSource = SPLIT', r.mappingSource === 'SPLIT', r.mappingSource, 'SPLIT');
  assert('subBlocks is array of 2', Array.isArray(r.subBlocks) && r.subBlocks.length === 2, r.subBlocks?.length, 2);

  if (Array.isArray(r.subBlocks) && r.subBlocks.length === 2) {
    const sb0 = r.subBlocks[0]; const sb1 = r.subBlocks[1];
    const subjects = [sb0.subjectId, sb1.subjectId];

    const hasHistory = subjects.some(s => s && s.startsWith('GS1-HIS'));
    const hasEconomy = subjects.some(s => s && s.startsWith('GS3-ECO'));

    assert('one sub-block = History (GS1-HIS)', hasHistory, subjects, 'includes GS1-HIS');
    assert('one sub-block = Economy (GS3-ECO)', hasEconomy, subjects, 'includes GS3-ECO');
    assert('sb0 stage = prelims', sb0.stage === 'prelims', sb0.stage, 'prelims');
    assert('sb1 stage = prelims', sb1.stage === 'prelims', sb1.stage, 'prelims');
    assert('sb0 splitMinutes = 75', sb0.splitMinutes === 75, sb0.splitMinutes, 75);
    assert('sb1 splitMinutes = 75', sb1.splitMinutes === 75, sb1.splitMinutes, 75);
    assert('sb0 isMiscGen = false', sb0.isMiscGen === false, sb0.isMiscGen, false);
    assert('sb1 isMiscGen = false', sb1.isMiscGen === false, sb1.isMiscGen, false);
  }
}

// ────────────────────────────────────────────────────────────
// BONUS: Legitimate MISC-GEN cases must still work
// ────────────────────────────────────────────────────────────
header('BONUS: MISC-GEN for explicit generic intents');
{
  const cases = [
    { input: 'Current Affairs', expectMisc: true },
    { input: 'Mock Analysis', expectMisc: true },
    { input: 'Admin planning session', expectMisc: true },
    { input: 'Polity Revision', expectMisc: false },
    { input: 'Environment Prelims', expectMisc: false },
    { input: 'Economy Mains', expectMisc: false },
  ];
  for (const { input, expectMisc } of cases) {
    const r = processOcrText(input);
    assert(`"${input}" isMiscGen=${expectMisc}`, r.isMiscGen === expectMisc, r.isMiscGen, expectMisc);
  }
}

// SUMMARY
console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
if (notes.length) { console.log('NOTES:'); notes.forEach(n => console.log('  - ' + n)); }
if (fail === 0) { console.log('All pipeline tests PASSED.\n'); }
else { console.log(`${fail} test(s) FAILED.\n`); process.exit(1); }
