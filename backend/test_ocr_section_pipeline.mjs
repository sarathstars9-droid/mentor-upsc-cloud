/**
 * Test: OCR Section Pipeline — 5 canonical test cases
 * Run: node --experimental-vm-modules test_ocr_section_pipeline.mjs
 * (from backend/ directory)
 */

import { runOcrSectionPipeline } from "./blockResolution/ocrSectionPipeline.js";

const TEST_CASES = [
  {
    id: 1,
    label: "Polity — Fundamental Rights",
    input: "fundamental rights article 19 reasonable restrictions writ jurisdiction",
    expected: { subject: "Polity", section: "Fundamental Rights", nodeHint: "GS2-POL-FR" },
  },
  {
    id: 2,
    label: "Economy — Monetary Policy",
    input: "repo rate mpc inflation rbi liquidity",
    expected: { subject: "Economy", section: "Monetary Policy and RBI", nodeHint: "GS3-ECO-PRE-MONEY-BASICS" },
  },
  {
    id: 3,
    label: "Environment — Biodiversity",
    input: "biodiversity hotspot endemic species protected area",
    expected: { subject: "Environment", section: "Biodiversity", nodeHint: "GS3-ENV-BIOGEO" },
  },
  {
    id: 4,
    label: "Science & Technology — Space",
    input: "isro satellite launch geostationary orbit",
    expected: { subject: "Science & Technology", section: "Space", nodeHint: "GS3-ST-SPACE" },
  },
  {
    id: 5,
    label: "Medieval History — Delhi Sultanate",
    input: "delhi sultanate iqta administration medieval india",
    expected: { subject: "Medieval Indian History", section: "Delhi Sultanate", nodeHint: "GS1-HIS-MED-DELHI" },
  },
];

console.log("=".repeat(70));
console.log("OCR SECTION PIPELINE — SAMPLE TEST OUTPUTS");
console.log("=".repeat(70));

let passed = 0;
let failed = 0;

for (const tc of TEST_CASES) {
  const result = runOcrSectionPipeline(tc.input);
  const subjectOk = result.subject.value === tc.expected.subject;
  const sectionOk = result.section.value === tc.expected.section;
  const nodeOk = result.resolver.syllabusNodeId === tc.expected.nodeHint ||
                 result.resolver.syllabusNodeId?.startsWith(tc.expected.nodeHint?.split("-").slice(0,3).join("-"));

  const status = subjectOk && sectionOk ? "✅ PASS" : "⚠️  PARTIAL";
  if (subjectOk && sectionOk) passed++; else failed++;

  console.log(`\n[TC${tc.id}] ${status} — ${tc.label}`);
  console.log(`  Input          : "${tc.input}"`);
  console.log(`  Subject        : ${result.subject.value} (conf: ${result.subject.confidence}, band: ${result.subject.confidenceBand})`);
  console.log(`  Section        : ${result.section.value} (conf: ${result.section.confidence}, band: ${result.section.confidenceBand})`);
  console.log(`  pdfSection key : ${result.section.pdfSection}`);
  console.log(`  nodeId         : ${result.resolver.syllabusNodeId} [${result.resolver.mappingStatus}]`);
  console.log(`  topic          : ${result.resolver.topic}`);
  console.log(`  reviewRequired : ${result.reviewRequired}  confidenceBand: ${result.confidenceBand}`);

  if (result.subject.alternatives?.length) {
    console.log(`  Alt subjects   : ${result.subject.alternatives.map(a => `${a.subject}(${a.confidence})`).join(", ")}`);
  }
  if (result.section.alternatives?.length) {
    console.log(`  Alt sections   : ${result.section.alternatives.map(a => `${a.section}(${a.confidence})`).join(", ")}`);
  }
  if (result.subject.matchedKeywords?.length) {
    const top5 = result.subject.matchedKeywords.slice(0, 5).map(k => `${k.term}(${k.weight})`).join(", ");
    console.log(`  Subject kw     : ${top5}`);
  }

  console.log(`  Expected       : subject=${tc.expected.subject} | section=${tc.expected.section} | node≈${tc.expected.nodeHint}`);
}

console.log("\n" + "=".repeat(70));
console.log(`RESULTS: ${passed}/${TEST_CASES.length} passed, ${failed} with partial/no match`);
console.log("=".repeat(70));
