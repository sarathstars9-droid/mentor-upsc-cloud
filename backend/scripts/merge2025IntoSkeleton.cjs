#!/usr/bin/env node

const fs = require("fs");

const skeletonPath = process.argv[2];
const rcPath = process.argv[3];
const quantPath = process.argv[4];
const lrPath = process.argv[5];

if (!skeletonPath || !rcPath || !quantPath || !lrPath) {
    console.error("Usage:");
    console.error(
        "node merge2025IntoSkeleton.cjs <skeleton.json> <rc.json> <quant.json> <lr.json>"
    );
    process.exit(1);
}

const skeleton = JSON.parse(fs.readFileSync(skeletonPath, "utf8"));
const rc = JSON.parse(fs.readFileSync(rcPath, "utf8")).questions || [];
const quant = JSON.parse(fs.readFileSync(quantPath, "utf8")).questions || [];
const lr = JSON.parse(fs.readFileSync(lrPath, "utf8")).questions || [];

const all = [...rc, ...quant, ...lr];

// Extract only 2025
const data2025 = all.filter(q => q.year === 2025);

const map = new Map();
for (const q of data2025) {
    map.set(q.questionNumber, q);
}

// Fill skeleton
let filled = 0;
let missing = [];

for (const q of skeleton.questions) {
    const existing = map.get(q.questionNumber);

    if (existing) {
        q.question = existing.question || "";
        q.options = existing.options || q.options;
        q.answer = existing.answer || null;
        q.topicTags = existing.section ? [existing.section] : [];

        filled++;
    } else {
        missing.push(q.questionNumber);
    }
}

// Save updated file
const outPath = skeletonPath.replace(".json", "_filled.json");

fs.writeFileSync(outPath, JSON.stringify(skeleton, null, 2));

console.log("Filled:", filled);
console.log("Missing:", missing.length);
console.log("Missing question numbers:");
console.log(missing.sort((a, b) => a - b));