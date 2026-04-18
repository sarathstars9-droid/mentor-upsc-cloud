#!/usr/bin/env node

const fs = require("fs");

const skeletonPath = process.argv[2];
if (!skeletonPath) {
    console.error("Usage: node backend/scripts/patch2025FromPdfTruth.cjs <path-to-csat_2025_truth_skeleton_filled.json>");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(skeletonPath, "utf8"));

function setQuestion(qno, payload) {
    const q = data.questions.find((x) => x.year === 2025 && x.questionNumber === qno);
    if (!q) {
        throw new Error(`Question ${qno} not found`);
    }
    Object.assign(q, payload);
}

// Fill Q30 from known PDF truth
setQuestion(30, {
    section: "Quant",
    questionType: "MCQ_SINGLE",
    format: "text",
    question:
        "The petrol price shot up by 10% as a result of the hike in crude oil prices. The price of petrol before the hike was Rs. 90 per litre. A person travels 2200 km every month and his car gives a mileage of 16 km per litre. By how many km should he reduce his travel if he wants to maintain his expenditure at the previous level ?",
    options: {
        a: "180 km",
        b: "200 km",
        c: "220 km",
        d: "240 km"
    },
    answer: "b",
    topicTags: ["percentage"]
});

// Enforce 2025 section truth for missing questions
for (let i = 31; i <= 51; i++) {
    const q = data.questions.find((x) => x.year === 2025 && x.questionNumber === i);
    if (q) {
        q.section = "Reasoning";
        q.sourceFiles = ["2025_pdf_truth"];
    }
}

for (let i = 52; i <= 80; i++) {
    const q = data.questions.find((x) => x.year === 2025 && x.questionNumber === i);
    if (q) {
        q.section = "Comprehension";
        q.sourceFiles = ["2025_pdf_truth"];
    }
}

fs.writeFileSync(skeletonPath, JSON.stringify(data, null, 2));
console.log("Patched Q30 and enforced 2025 section truth for Q31–80.");