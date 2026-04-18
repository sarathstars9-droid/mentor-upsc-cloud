#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const outPath =
    process.argv[2] ||
    "C:\\Projects\\upsc-mentor-pwa\\upsc-mentor-cloud-deploy\\upsc-mentor-pwa\\backend\\data\\pyq_questions\\prelims\\csat\\csat_2025_truth_skeleton.json";

function makeQuestion(qno, section) {
    return {
        year: 2025,
        questionNumber: qno,
        stage: "Prelims",
        paper: "CSAT",
        section,
        questionType: null,
        format: null,
        question: "",
        prompt: null,
        passageId: null,
        passageText: null,
        statements: null,
        pairs: null,
        table: null,
        options: {
            a: "",
            b: "",
            c: "",
            d: "",
        },
        answer: null,
        topicTags: [],
        sourceFiles: ["2025_pdf_truth"],
        originalIds: [],
        legacySyllabusNodeIds: [],
    };
}

const questions = [];

// 2025 canonical section mapping from PDF truth:
// Q1-30 Quant
for (let i = 1; i <= 30; i++) {
    questions.push(makeQuestion(i, "Quant"));
}

// Q31-51 Reasoning
for (let i = 31; i <= 51; i++) {
    questions.push(makeQuestion(i, "Reasoning"));
}

// Q52-80 Comprehension
for (let i = 52; i <= 80; i++) {
    questions.push(makeQuestion(i, "Comprehension"));
}

const output = {
    schemaVersion: "csat-2025-truth-skeleton-v1",
    generatedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    validation: {
        year: 2025,
        expectedTotal: 80,
        expectedBreakup: {
            Quant: 30,
            Reasoning: 21,
            Comprehension: 29,
        },
    },
    questions,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.log(`Wrote 2025 truth skeleton to: ${outPath}`);
console.log("Breakup:");
console.log({
    total: 80,
    Quant: 30,
    Reasoning: 21,
    Comprehension: 29,
});