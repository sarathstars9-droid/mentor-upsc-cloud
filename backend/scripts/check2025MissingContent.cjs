#!/usr/bin/env node

const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: node backend/scripts/check2025MissingContent.cjs <path-to-csat_2025_truth_skeleton_filled.json>");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const questions = Array.isArray(data.questions) ? data.questions : [];

const missing = questions
    .filter(q =>
        q.year === 2025 &&
        (
            !q.question ||
            !q.options ||
            !q.options.a ||
            !q.options.b ||
            !q.options.c ||
            !q.options.d ||
            !q.answer
        )
    )
    .map(q => ({
        questionNumber: q.questionNumber,
        section: q.section,
        hasQuestion: !!q.question,
        hasOptions: !!(q.options && q.options.a && q.options.b && q.options.c && q.options.d),
        hasAnswer: !!q.answer,
    }));

console.log(JSON.stringify({
    total2025: questions.filter(q => q.year === 2025).length,
    missingCount: missing.length,
    missing
}, null, 2));