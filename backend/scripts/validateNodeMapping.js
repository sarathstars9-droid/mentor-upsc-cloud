import { processOcrText } from "../ocrMapping/index.js";

const testCases = [
  "History Indus Valley Civilization",
  "CSAT Number System",
  "Economy Monetary Policy",
  "Ecology National Parks",
  "Art and Culture Architecture",
  "CA Defense exercises",
  "Current Affairs Science achievements",
  "Polity Parliament",
  "Geography Monsoons",
  "Internal Security Border Management"
];

console.log("==========================================");
console.log("   OCR Mapping Pipeline Regression Test");
console.log("==========================================\n");

let passed = 0;
let total = testCases.length;

testCases.forEach((input, index) => {
  console.log(`[Test ${index + 1}] Input: "${input}"`);
  
  const result = processOcrText(input);
  
  console.log(`  => Subject: ${result.subjectName}`);
  console.log(`  => Main Node: ${result.nodeId || "NONE"} (${result.nodeName || "No specific node"})`);
  console.log(`  => Confidence: ${result.confidenceBadge}`);
  
  if (result.nodeId) {
    passed++;
  } else if (result.confidenceBadge === "LOW") {
    // If it's honestly low confidence, maybe that's correct for bad data
    // But since these are clear strings, they should map.
  }
  
  console.log("------------------------------------------");
});

console.log(`\nTest Summary: ${passed}/${total} mapped successfully.`);
