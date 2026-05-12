const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIRS = [
    path.join(ROOT, "data", "pyq_questions"),
    path.join(ROOT, "data", "pyq_questions_v2"),
];

const OUT_DIR = path.join(ROOT, "data", "audit");
const OUT_FILE = path.join(OUT_DIR, "gs_question_number_audit.json");

function readJsonFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            files = files.concat(readJsonFiles(full));
        } else if (item.endsWith(".json")) {
            files.push(full);
        }
    }

    return files;
}

function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.questions)) return data.questions;
    if (Array.isArray(data.data)) return data.data;
    return [];
}

function isGS(q, filePath) {
    const text = [
        q.paper,
        q.subject,
        q.stage,
        q.exam,
        q.id,
        filePath,
    ]
        .join(" ")
        .toLowerCase();

    if (text.includes("csat")) return false;
    if (text.includes("prelims")) return true;
    if (text.includes("gs")) return true;

    return false;
}

function getYear(q) {
    const candidates = [
        q.year,
        q.examYear,
        q.paperYear,
        q.id,
        q.sourceFile,
    ];

    for (const c of candidates) {
        const m = String(c || "").match(/\b(19[9][5-9]|20[0-2][0-9]|2025)\b/);
        if (m) return Number(m[1]);
    }

    return "unknown_year";
}

function getQuestionNumber(q) {
    const candidates = [
        q.questionNumber,
        q.qNo,
        q.qno,
        q.number,
        q.serialNo,
        q.id,
    ];

    for (const c of candidates) {
        const m = String(c || "").match(/(?:Q|_|-|\b)(\d{1,3})(?:\b|_|-)/i);
        if (m) return Number(m[1]);

        if (/^\d{1,3}$/.test(String(c || "").trim())) {
            return Number(c);
        }
    }

    return null;
}

function expectedCount(year) {
    if (year === "unknown_year") return null;
    if (year >= 2011) return 100;
    return null;
}

function expectedNumbers(year) {
    const count = expectedCount(year);
    if (!count) return null;
    return Array.from({ length: count }, (_, i) => i + 1);
}

function main() {
    const files = DATA_DIRS.flatMap(readJsonFiles);

    const rows = [];
    const byYear = {};

    for (const file of files) {
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }

        const arr = normalizeArray(parsed);

        for (const q of arr) {
            if (!isGS(q, file)) continue;

            const year = getYear(q);
            const qNo = getQuestionNumber(q);

            const row = {
                year,
                questionNumber: qNo,
                id: q.id || null,
                subject: q.subject || null,
                topic: q.topic || q.topicName || q.microtheme || null,
                file: path.relative(ROOT, file),
                questionPreview: String(q.question || q.questionText || q.text || "")
                    .replace(/\s+/g, " ")
                    .slice(0, 180),
            };

            rows.push(row);

            if (!byYear[year]) {
                byYear[year] = {
                    year,
                    total: 0,
                    knownQuestionNumbers: [],
                    missingQuestionNumbers: [],
                    duplicateQuestionNumbers: [],
                    unknownQuestionNumberRows: [],
                    extraQuestionNumbers: [],
                    rows: [],
                };
            }

            byYear[year].total++;
            byYear[year].rows.push(row);

            if (qNo) byYear[year].knownQuestionNumbers.push(qNo);
            else byYear[year].unknownQuestionNumberRows.push(row);
        }
    }

    for (const yearKey of Object.keys(byYear)) {
        const item = byYear[yearKey];
        const nums = item.knownQuestionNumbers;

        const countMap = {};
        for (const n of nums) countMap[n] = (countMap[n] || 0) + 1;

        item.duplicateQuestionNumbers = Object.entries(countMap)
            .filter(([, count]) => count > 1)
            .map(([n, count]) => ({ questionNumber: Number(n), count }));

        const year = yearKey === "unknown_year" ? "unknown_year" : Number(yearKey);
        const expected = expectedNumbers(year);

        if (expected) {
            item.missingQuestionNumbers = expected.filter((n) => !countMap[n]);
            item.extraQuestionNumbers = nums.filter((n) => n > 100);
            item.status =
                item.total === 100 &&
                    item.missingQuestionNumbers.length === 0 &&
                    item.duplicateQuestionNumbers.length === 0
                    ? "OK"
                    : "BROKEN";
        } else {
            item.status = "CHECK_MANUALLY";
        }

        item.knownQuestionNumbers = [...new Set(nums)].sort((a, b) => a - b);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const result = {
        generatedAt: new Date().toISOString(),
        rule: "For GS Prelims 2011 onwards, expected question numbers are 1–100.",
        summary: Object.values(byYear)
            .sort((a, b) => {
                if (a.year === "unknown_year") return 1;
                if (b.year === "unknown_year") return -1;
                return Number(a.year) - Number(b.year);
            })
            .map((y) => ({
                year: y.year,
                total: y.total,
                status: y.status,
                missing: y.missingQuestionNumbers,
                duplicates: y.duplicateQuestionNumbers,
                unknownQuestionNumberCount: y.unknownQuestionNumberRows.length,
                extraQuestionNumbers: y.extraQuestionNumbers,
            })),
        detail: byYear,
    };

    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), "utf8");

    console.log("\n✅ GS QUESTION NUMBER AUDIT COMPLETE\n");

    for (const s of result.summary) {
        if (Number(s.year) >= 2011 || s.year === "unknown_year") {
            console.log(
                `${s.year}: total=${s.total} | ${s.status} | missing=${s.missing.length} | duplicates=${s.duplicates.length} | unknownQNo=${s.unknownQuestionNumberCount}`
            );

            if (s.missing.length) {
                console.log("   Missing:", s.missing.join(", "));
            }

            if (s.duplicates.length) {
                console.log(
                    "   Duplicates:",
                    s.duplicates.map((d) => `Q${d.questionNumber}x${d.count}`).join(", ")
                );
            }
        }
    }

    console.log(`\n📄 Saved: ${OUT_FILE}\n`);
}

main();