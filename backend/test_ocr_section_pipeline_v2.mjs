/**
 * test_ocr_section_pipeline_v2.mjs
 *
 * Full V2 test runner — 10 canonical + 3 ambiguous context tests.
 * Run from backend/:
 *   node test_ocr_section_pipeline_v2.mjs
 */

import { runOcrSectionPipeline } from "./blockResolution/ocrSectionPipeline.js";

const SEP = "=".repeat(72);

// ─── CANONICAL TEST CASES ────────────────────────────────────────────────────

const CANONICAL = [
  {
    id: 1,
    label: "Polity — Fundamental Rights",
    input: "fundamental rights article 19 reasonable restrictions writ jurisdiction",
    expected: { subject: "Polity", section: "Fundamental Rights" },
  },
  {
    id: 2,
    label: "Economy — Monetary Policy",
    input: "repo rate mpc inflation rbi liquidity",
    expected: { subject: "Economy", section: "Monetary Policy and RBI" },
  },
  {
    id: 3,
    label: "Environment — Biodiversity",
    input: "biodiversity hotspot endemic species protected area",
    expected: { subject: "Environment", section: "Biodiversity" },
  },
  {
    id: 4,
    label: "Science & Technology — Space",
    input: "isro satellite launch geostationary orbit",
    expected: { subject: "Science & Technology", section: "Space" },
  },
  {
    id: 5,
    label: "Medieval History — Delhi Sultanate",
    input: "delhi sultanate iqta administration",
    expected: { subject: "Medieval Indian History", section: "Delhi Sultanate" },
  },
  {
    id: 6,
    label: "Modern History — Cabinet Mission / Partition",
    input: "cabinet mission partition mountbatten plan",
    expected: { subject: "Modern Indian History", section: "Partition and Independence" },
  },
  {
    id: 7,
    label: "Geography — Monsoon & Climatology",
    input: "monsoon western disturbances rainfall pressure belts",
    expected: { subject: "Geography", section: "Indian Climate and Monsoon" },
  },
  {
    id: 8,
    label: "Polity — Constitutional Bodies",
    input: "lokpal election commission cag",
    expected: { subject: "Polity", section: "Constitutional Bodies" },
  },
  {
    id: 9,
    label: "Science & Technology — Biotechnology",
    input: "gene editing monoclonal antibodies vaccine",
    expected: { subject: "Science & Technology", section: "Biotechnology" },
  },
  {
    id: 10,
    label: "International Relations — Regional Groupings",
    input: "bimstec brics summit nato grouping",
    expected: { subject: "International Relations", section: "Regional Groupings" },
  },
];

// ─── CONTEXT (AMBIGUOUS) TEST CASES ─────────────────────────────────────────

const CONTEXT_TESTS = [
  {
    id: "C1",
    label: "Ambiguous 'reasonable restrictions' → Polity with prior context",
    input: "reasonable restrictions",
    context: { confirmedSubject: "Polity", confirmedSection: "Fundamental Rights" },
    expected: { subject: "Polity", section: "Fundamental Rights" },
  },
  {
    id: "C2",
    label: "Ambiguous 'repo' → Economy with prior context",
    input: "repo",
    context: { confirmedSubject: "Economy", confirmedSection: "Monetary Policy and RBI" },
    expected: { subject: "Economy", section: "Monetary Policy and RBI" },
  },
  {
    id: "C3",
    label: "Ambiguous 'species' → Environment with prior context",
    input: "species",
    context: { confirmedSubject: "Environment", confirmedSection: "Biodiversity" },
    expected: { subject: "Environment", section: "Biodiversity" },
  },
];

// ─── RUNNER ──────────────────────────────────────────────────────────────────

function runTest(tc, isContext = false) {
  const result = runOcrSectionPipeline(tc.input, tc.context || {});

  const gotSubject = result.subject.value;
  const gotSection = result.section.normalizedValue || result.section.value;

  const subjectOk = gotSubject === tc.expected.subject;
  const sectionOk = gotSection === tc.expected.section;
  const pass = subjectOk && sectionOk;

  const tag = pass ? "✅ PASS" : sectionOk ? "⚠️  SUBJ-FAIL" : subjectOk ? "⚠️  SECT-FAIL" : "❌ FAIL";

  console.log(`\n[TC${tc.id}] ${tag}  —  ${tc.label}`);
  console.log(`  Input         : "${tc.input}"`);
  if (tc.context) {
    console.log(`  Context       : subject=${tc.context.confirmedSubject} | section=${tc.context.confirmedSection}`);
  }
  console.log(`  Subject       : ${gotSubject}  (conf: ${result.subject.confidence}, gap: ${result.subject.confidenceGap}, band: ${result.subject.confidenceBand})`);
  console.log(`  Section       : ${gotSection}  (conf: ${result.section.confidence}, gap: ${result.section.confidenceGap}, band: ${result.section.confidenceBand})`);
  console.log(`  pdfSection    : ${result.section.pdfSection}`);
  console.log(`  nodeId        : ${result.resolver.syllabusNodeId}  [${result.resolver.mappingStatus}]`);
  console.log(`  topic         : ${result.resolver.topic}`);
  console.log(`  review        : ${result.reviewRequired}  band: ${result.confidenceBand}`);

  if (result.subject.matchedKeywords?.length) {
    const top5 = result.subject.matchedKeywords.slice(0, 5).map((k) => `${k.term}(${k.weight})`).join(", ");
    console.log(`  Subject KW    : ${top5}`);
  }
  if (result.section.matchedKeywords?.length) {
    const top5 = result.section.matchedKeywords.slice(0, 5).map((k) => `${k.term}(${k.weight})`).join(", ");
    console.log(`  Section KW    : ${top5}`);
  }
  if (result.subject.alternatives?.length) {
    console.log(`  Alt subjects  : ${result.subject.alternatives.map((a) => `${a.subject}(${a.confidence})`).join(", ")}`);
  }
  if (result.section.alternatives?.length) {
    console.log(`  Alt sections  : ${result.section.alternatives.map((a) => `${a.normalizedSection || a.section}(${a.confidence})`).join(", ")}`);
  }
  console.log(`  Expected      : subject=${tc.expected.subject} | section=${tc.expected.section}`);

  return pass;
}

// Main
console.log(SEP);
console.log("OCR SECTION PIPELINE V2 — FULL TEST SUITE");
console.log(SEP);

let passed = 0;
let failed = 0;

console.log("\n── CANONICAL TESTS ──────────────────────────────────────────────────────");
for (const tc of CANONICAL) {
  const ok = runTest(tc);
  if (ok) passed++; else failed++;
}

console.log("\n── CONTEXT (AMBIGUOUS) TESTS ────────────────────────────────────────────");
for (const tc of CONTEXT_TESTS) {
  // Note: ambiguous inputs with very short text often stay in review — we check _topSubject too
  const result = runOcrSectionPipeline(tc.input, tc.context || {});
  const gotSubject = result.subject.value || result.subject._topSubject || result.subject.value;
  const gotSection = result.section.normalizedValue || result.section.value;

  const subjectOk =
    (result.subject.value === tc.expected.subject) ||
    // Accept if _topSubject matches (context pushed the right subject to top)
    (result.subject.matchedKeywords?.some((k) => k.type === "context") && gotSection === tc.expected.section);
  const sectionOk = gotSection === tc.expected.section;
  const pass = runTest(tc, true);
  if (pass) passed++; else failed++;
}

console.log("\n" + SEP);
console.log(`RESULTS: ${passed}/${CANONICAL.length + CONTEXT_TESTS.length} passed, ${failed} partial/fail`);
console.log(SEP);

// ─── WEAK CASE NOTES ─────────────────────────────────────────────────────────
console.log(`
KNOWN WEAK CASES:
  TC6  — 'cabinet mission partition mountbatten plan': Modern History section
         'Partition and Independence' was added in V2. If nodeId is null it means
         pdfToSyllabusMap.js doesn't have that exact key yet — add it there.

  TC7  — 'monsoon western disturbances rainfall pressure belts':
         Both 'Indian Climate and Monsoon' and 'Physical Geography - Climatology'
         match. Pressure belts lean Climatology but V2 gives higher weight to
         monsoon tokens. Review alternatives to confirm.

  TC8  — 'lokpal election commission cag': Strong Polity signal but 'lokpal'
         could slightly lift Constitutional Bodies OR Governance section.
         V2 rare keyword lokpal=14 in Constitutional Bodies should win.

  C1/C2/C3 — Short ambiguous inputs (1-2 tokens). Context boost is intentionally
         capped at 8% so very short inputs may still need reviewRequired=true.
         The _topSubject field will reflect the correct direction even then.
`);
