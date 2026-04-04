/**
 * testResolveBlock.js
 * Standalone test runner for the blockResolution module.
 *
 * Run with: node backend/blockResolution/testResolveBlock.js
 *
 * Tests 25+ realistic UPSC plan block inputs and prints structured outputs.
 * No external test framework required.
 */

import { resolveBlock } from './resolveBlock.js';

// ─── Test Cases ─────────────────────────────────────────────────────────────

const TEST_INPUTS = [
  // Revision blocks
  'polity revision',
  'modern history revision',
  'economy revision',
  'environment revision',
  'science and technology revision',

  // Practice / PYQ blocks
  'economy prelims pyqs',
  'polity pyqs',
  'parliament pyqs',
  'environment pyqs',
  'history pyqs',

  // Test / FLT blocks
  'vision flt 12',
  'insights mock 3',
  'vision flt 7',
  'forum ias mock 2',
  'prelims full length test',

  // Mapping blocks
  'world mapping',
  'india mapping',
  'india map practice',

  // CSAT blocks
  'csat rc practice',
  'csat reading comprehension',
  'csat quant drill',

  // Mains / Writing blocks
  'ethics answer writing',
  'gs4 answer writing',
  'modern india mains writing',

  // Essay blocks
  'essay brainstorming',
  'essay outline – technology and society',

  // Miscellaneous
  'current affairs revision',
  'ncert reading modern history',
  'gs2 governance revision',
  'internal security pyqs',

  // ── Regression: disambiguation fixes ────────────────────────────────────
  'ancient history pyqs',         // → history_ancient, not history_modern
  'medieval history revision',    // → history_ancient
  'ancient pyqs',                 // → history_ancient (bare alias)
  'world mapping',                // → geography_world subject
  'india mapping',                // → geography_india subject
  'ethics answer writing',        // → ethics subject (not taskCategory)
  'gs4 answer writing',           // → ethics subject (gs4 alias maps to ethics)
  'modern india mains writing',   // → history_modern subject
  'essay outline – technology and society', // → essay subject, brainstorm task
];

// ─── Runner ──────────────────────────────────────────────────────────────────

function printSeparator(char = '─', len = 70) {
  console.log(char.repeat(len));
}

function runTests() {
  console.log('\n');
  printSeparator('═');
  console.log('  🧪  UPSC MentorOS — blockResolution Test Suite');
  printSeparator('═');
  console.log(`  Total test cases: ${TEST_INPUTS.length}`);
  printSeparator('─');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TEST_INPUTS.length; i++) {
    const input = TEST_INPUTS[i];

    try {
      const result = resolveBlock(input);
      passed++;

      // Subject display: prefer top-level subjectSlug (now present on all block types),
      // fall back to testFamily for test blocks, then taskCategory label.
      const subjectDisplay =
        result.resolution.subjectSlug  ??
        result.resolution.testFamily   ??
        (result.resolution.taskCategory ? `[task:${result.resolution.taskCategory}]` : '—');

      console.log(`\n[${String(i + 1).padStart(2, '0')}] Input: "${input}"`);
      console.log(`     Normalized    : "${result.normalized}"`);
      console.log(`     Resolved Type : ${result.resolvedType.toUpperCase()}`);
      console.log(`     Subject       : ${subjectDisplay}`);
      console.log(`     Activity      : ${result.resolution.activityType ?? result.resolution.practiceMode ?? '—'}`);
      console.log(`     Stage         : ${result.resolution.stage}`);
      console.log(`     Action        : ${result.resolution.suggestedAction}`);
      console.log(`     Tags          : [${result.resolution.tags?.join(', ') ?? ''}]`);
      console.log(`     Confidence    : ${(result.overallConfidence * 100).toFixed(1)}%`);
      // Show topic context for essay blocks that overrode entity detection
      if (result.resolution.meta?.topicSubjectSlug) {
        console.log(`     Topic Context : ${result.resolution.meta.topicSubjectSlug} (${result.resolution.meta.topicSubjectLabel})`);
      }

      // Specific checks
      if (result.resolvedType === 'practice') {
        console.log(`     PYQ Mode      : ${result.resolution.isPyq ? '✅ Yes' : '❌ No'}`);
        console.log(`     Practice Mode : ${result.resolution.practiceMode}`);
      }
      if (result.resolvedType === 'test') {
        console.log(`     Test Family   : ${result.resolution.testFamily}`);
        console.log(`     Test Number   : ${result.resolution.testNumber ?? '—'}`);
        console.log(`     Test Code     : ${result.resolution.testCode}`);
      }

    } catch (err) {
      failed++;
      console.error(`\n[${String(i + 1).padStart(2, '0')}] ❌ ERROR for input: "${input}"`);
      console.error(`     ${err.message}`);
    }
  }

  printSeparator('─');
  console.log(`\n  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}  |  Total: ${TEST_INPUTS.length}`);
  printSeparator('═');
  console.log();
}

runTests();
