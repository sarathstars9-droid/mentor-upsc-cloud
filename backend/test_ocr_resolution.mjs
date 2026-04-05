/**
 * test_ocr_resolution.mjs
 *
 * Verification tests for the OCR block resolution logic.
 * Run: node test_ocr_resolution.mjs
 *
 * Expected outcomes for each test case documented inline.
 */

import { detectOcrStage } from './ocrMapping/stageDetector.js';
import { detectOcrMiscIntent } from './ocrMapping/miscIntentDetector.js';
import { splitOcrBlock } from './ocrMapping/ocrBlockSplitter.js';
import { cleanOcrText } from './ocrMapping/ocrSanitizer.js';

// ANSI colors
const OK  = '\x1b[32m✓\x1b[0m';
const ERR = '\x1b[31m✗\x1b[0m';
let pass = 0, fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ${OK} ${label}`); }
  else { fail++; console.log(`  ${ERR} ${label}\n      got:      ${JSON.stringify(got)}\n      expected: ${JSON.stringify(expected)}`); }
}

function checkContains(label, got, key, expected) {
  const actual = got?.[key];
  const ok = actual === expected;
  if (ok) { pass++; console.log(`  ${OK} ${label} [${key}=${actual}]`); }
  else { fail++; console.log(`  ${ERR} ${label}\n      ${key}: got=${actual}  expected=${expected}`); }
}

console.log('\n=== OCR Block Resolution Verification ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Stage Detection
// ─────────────────────────────────────────────────────────────────────────────
console.log('── Suite 1: Stage Detection ──');

{
  const r = detectOcrStage('Environment Ecology Biodiversity');
  checkContains('Environment Ecology Biodiversity → stage=general', r, 'stage', 'general');
  checkContains('No GS paper', r, 'gsPaper', null);
}

{
  const r = detectOcrStage('Economy Prelims Inflation');
  checkContains('Economy Prelims Inflation → stage=prelims', r, 'stage', 'prelims');
  checkContains('No GS paper', r, 'gsPaper', null);
}

{
  const r = detectOcrStage('Polity GS-2 Mains');
  checkContains('Polity GS-2 Mains → stage=mains', r, 'stage', 'mains');
  checkContains('GS-2 Mains → gsPaper=GS2', r, 'gsPaper', 'GS2');
}

{
  const r = detectOcrStage('History Mains GS-1');
  checkContains('History Mains GS-1 → stage=mains', r, 'stage', 'mains');
  checkContains('GS-1 → gsPaper=GS1', r, 'gsPaper', 'GS1');
}

{
  // PYQs alone must NOT force prelims
  const r = detectOcrStage('Economy PYQs');
  checkContains('Economy PYQs alone → stage=general (not prelims!)', r, 'stage', 'general');
}

{
  const r = detectOcrStage('History Prelims PYQs');
  checkContains('History Prelims PYQs → stage=prelims (explicit keyword)', r, 'stage', 'prelims');
}

{
  const r = detectOcrStage('GS3 Environment');
  checkContains('GS3 Environment → stage=mains', r, 'stage', 'mains');
  checkContains('GS3 → gsPaper=GS3', r, 'gsPaper', 'GS3');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: MISC-GEN Detection
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Suite 2: MISC-GEN Detection ──');

{
  const r = detectOcrMiscIntent('Environment Ecology Biodiversity');
  checkContains('Environment Ecology Biodiversity → NOT MISC', r, 'isMiscGen', false);
}

{
  const r = detectOcrMiscIntent('Economy Prelims Inflation');
  checkContains('Economy Prelims Inflation → NOT MISC', r, 'isMiscGen', false);
}

{
  const r = detectOcrMiscIntent('Current Affairs');
  checkContains('Current Affairs → IS MISC', r, 'isMiscGen', true);
}

{
  const r = detectOcrMiscIntent('Mock Analysis');
  checkContains('Mock Analysis → IS MISC', r, 'isMiscGen', true);
}

{
  const r = detectOcrMiscIntent('Polity Revision');
  checkContains('Polity Revision (has subject) → NOT MISC', r, 'isMiscGen', false);
}

{
  const r = detectOcrMiscIntent('Revision');
  checkContains('Revision alone (no subject) → IS MISC', r, 'isMiscGen', true);
}

{
  const r = detectOcrMiscIntent('Mock review');
  checkContains('Mock review → IS MISC', r, 'isMiscGen', true);
}

{
  const r = detectOcrMiscIntent('Admin planning');
  checkContains('Admin planning → IS MISC', r, 'isMiscGen', true);
}

{
  const r = detectOcrMiscIntent('Polity GS-2 Mains');
  checkContains('Polity GS-2 Mains → NOT MISC', r, 'isMiscGen', false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Mixed Block Split
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Suite 3: Mixed Block Split ──');

{
  // "PYQs History Prelims Economy" should split into History + Economy
  const r = splitOcrBlock('history prelims economy pyqs', { stage: 'prelims', gsPaper: null, minutes: 150 });
  if (r && r.subBlocks && r.subBlocks.length === 2) {
    pass++;
    console.log(`  ${OK} History+Economy split → 2 sub-blocks`);
    checkContains('Sub-block 0 subject', r.subBlocks[0], 'subjectSlug', 'history');
    checkContains('Sub-block 1 subject', r.subBlocks[1], 'subjectSlug', 'economy');
    checkContains('Sub-block 0 minutes = 75', r.subBlocks[0], 'minutes', 75);
    checkContains('Sub-block 1 minutes = 75', r.subBlocks[1], 'minutes', 75);
    checkContains('Sub-block 0 stage inherited', r.subBlocks[0], 'stage', 'prelims');
    checkContains('Sub-block 1 stage inherited', r.subBlocks[1], 'stage', 'prelims');
  } else {
    fail++;
    console.log(`  ${ERR} History+Economy should split into 2 sub-blocks, got: ${JSON.stringify(r)}`);
  }
}

{
  // Single subject should NOT split
  const r = splitOcrBlock('polity gs-2 mains', { stage: 'mains', gsPaper: 'GS2', minutes: 150 });
  check('Polity GS-2 Mains → no split (null)', r, null);
}

{
  // Ecology Biodiversity is ONE subject (environment) → should NOT split
  const r = splitOcrBlock('environment ecology biodiversity', { stage: 'general', minutes: 150 });
  check('Ecology Biodiversity → no split (single subject)', r, null);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: OCR Sanitizer — no corruption of topic phrases
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Suite 4: OCR Sanitizer Safety ──');

{
  const r = cleanOcrText('Environment Ecology Biodiversity');
  check('Ecology Biodiversity not corrupted', r.includes('ecology') && r.includes('biodiversity'), true);
}

{
  const r = cleanOcrText('Economy Prelims Inflation');
  check('Economy Prelims Inflation preserved', r.includes('economy') && r.includes('inflation'), true);
}

{
  const r = cleanOcrText('Polity GS-2 Mains');
  check('GS-2 preserved (not stripped)', r.includes('gs') && r.includes('2'), true);
}

{
  // "st" should NOT be replaced to "science tech" in context of "history"
  const r = cleanOcrText('History Prelims');
  check('History Prelims not corrupted', r.includes('history') && r.includes('prelims'), true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
if (fail === 0) {
  console.log('\x1b[32mAll tests passed! ✓\x1b[0m\n');
} else {
  console.log(`\x1b[31m${fail} test(s) failed!\x1b[0m\n`);
  process.exit(1);
}
