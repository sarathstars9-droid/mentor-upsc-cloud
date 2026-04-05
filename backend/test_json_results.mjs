/**
 * test_json_results.mjs
 * Writes results as clean JSON to stdout. No console styling.
 */
import { processOcrText } from './ocrMapping/index.js';
import { writeFileSync } from 'fs';

const results = [];

function test(label, condition, got, expected) {
  results.push({ label, pass: condition, got: String(got), expected: String(expected) });
}

// TEST 1
const r1 = processOcrText('Environment - Ecology Biodiversity', { minutes: 150 });
test('T1:stage=general', r1.stage === 'general', r1.stage, 'general');
test('T1:gsPaper=null', r1.gsPaper === null, r1.gsPaper, null);
test('T1:isMiscGen=false', r1.isMiscGen === false, r1.isMiscGen, false);
test('T1:source!=MISC-GEN', r1.mappingSource !== 'MISC-GEN', r1.mappingSource, '!= MISC-GEN');
test('T1:subjectId=GS3-ENV', r1.subjectId === 'GS3-ENV', r1.subjectId, 'GS3-ENV');
test('T1:isSplit=false', !r1.isSplit, r1.isSplit, false);

// TEST 2
const r2 = processOcrText('Economy - Prelims - Inflation', { minutes: 150 });
test('T2:stage=prelims', r2.stage === 'prelims', r2.stage, 'prelims');
test('T2:gsPaper=null', r2.gsPaper === null, r2.gsPaper, null);
test('T2:isMiscGen=false', r2.isMiscGen === false, r2.isMiscGen, false);
test('T2:source!=MISC-GEN', r2.mappingSource !== 'MISC-GEN', r2.mappingSource, '!= MISC-GEN');
test('T2:subjectId=GS3-ECO', r2.subjectId === 'GS3-ECO', r2.subjectId, 'GS3-ECO');
test('T2:isSplit=false', !r2.isSplit, r2.isSplit, false);

// TEST 3
const r3 = processOcrText('Polity - GS-2 Mains', { minutes: 150 });
test('T3:stage=mains', r3.stage === 'mains', r3.stage, 'mains');
test('T3:gsPaper=GS2', r3.gsPaper === 'GS2', r3.gsPaper, 'GS2');
test('T3:isMiscGen=false', r3.isMiscGen === false, r3.isMiscGen, false);
test('T3:source!=MISC-GEN', r3.mappingSource !== 'MISC-GEN', r3.mappingSource, '!= MISC-GEN');
test('T3:subjectId=GS2-POL', r3.subjectId === 'GS2-POL', r3.subjectId, 'GS2-POL');
test('T3:isSplit=false', !r3.isSplit, r3.isSplit, false);

// TEST 4
const r4 = processOcrText('PYQs - History Prelims Economy', { minutes: 150 });
test('T4:isMiscGen=false', r4.isMiscGen === false, r4.isMiscGen, false);
test('T4:isSplit=true', r4.isSplit === true, r4.isSplit, true);
test('T4:source=SPLIT', r4.mappingSource === 'SPLIT', r4.mappingSource, 'SPLIT');
test('T4:subBlocks.length=2', Array.isArray(r4.subBlocks) && r4.subBlocks.length === 2, r4.subBlocks?.length, 2);
if (Array.isArray(r4.subBlocks) && r4.subBlocks.length === 2) {
  const [sb0, sb1] = r4.subBlocks;
  const subjects = [sb0.subjectId, sb1.subjectId];
  test('T4:hasHistory', subjects.some(s => s && s.startsWith('GS1-HIS')), subjects, 'GS1-HIS present');
  test('T4:hasEconomy', subjects.some(s => s && s.startsWith('GS3-ECO')), subjects, 'GS3-ECO present');
  test('T4:sb0.stage=prelims', sb0.stage === 'prelims', sb0.stage, 'prelims');
  test('T4:sb1.stage=prelims', sb1.stage === 'prelims', sb1.stage, 'prelims');
  test('T4:sb0.splitMin=75', sb0.splitMinutes === 75, sb0.splitMinutes, 75);
  test('T4:sb1.splitMin=75', sb1.splitMinutes === 75, sb1.splitMinutes, 75);
  test('T4:sb0.isMiscGen=false', sb0.isMiscGen === false, sb0.isMiscGen, false);
  test('T4:sb1.isMiscGen=false', sb1.isMiscGen === false, sb1.isMiscGen, false);
}

// MISC-GEN tests
const miscCases = [
  { input: 'Current Affairs', expectMisc: true },
  { input: 'Mock Analysis', expectMisc: true },
  { input: 'Admin planning session', expectMisc: true },
  { input: 'Polity Revision', expectMisc: false },
  { input: 'Environment Prelims', expectMisc: false },
  { input: 'Economy Mains', expectMisc: false },
];
for (const { input, expectMisc } of miscCases) {
  const r = processOcrText(input);
  test(`MISC:${input}=>${expectMisc}`, r.isMiscGen === expectMisc, r.isMiscGen, expectMisc);
}

// Write full detail
const output = {
  summary: {
    pass: results.filter(r => r.pass).length,
    fail: results.filter(r => !r.pass).length,
    failures: results.filter(r => !r.pass).map(r => r.label),
  },
  results,
  raw: {
    test1_env: { stage: r1.stage, gsPaper: r1.gsPaper, subjectId: r1.subjectId, nodeId: r1.nodeId, nodeName: r1.nodeName, isMiscGen: r1.isMiscGen, source: r1.mappingSource, isSplit: r1.isSplit||false },
    test2_econ: { stage: r2.stage, gsPaper: r2.gsPaper, subjectId: r2.subjectId, nodeId: r2.nodeId, nodeName: r2.nodeName, isMiscGen: r2.isMiscGen, source: r2.mappingSource },
    test3_polity: { stage: r3.stage, gsPaper: r3.gsPaper, subjectId: r3.subjectId, nodeId: r3.nodeId, nodeName: r3.nodeName, isMiscGen: r3.isMiscGen, source: r3.mappingSource },
    test4_split: {
      isMiscGen: r4.isMiscGen, isSplit: r4.isSplit, source: r4.mappingSource,
      subBlocks: (r4.subBlocks||[]).map(sb => ({
        subjectId: sb.subjectId, subjectName: sb.subjectName,
        stage: sb.stage, splitMinutes: sb.splitMinutes, isMiscGen: sb.isMiscGen, nodeId: sb.nodeId,
      }))
    },
  }
};

writeFileSync('test_results_final.json', JSON.stringify(output, null, 2));
process.stdout.write(JSON.stringify(output.summary) + '\n');
if (output.summary.fail > 0) process.exit(1);
