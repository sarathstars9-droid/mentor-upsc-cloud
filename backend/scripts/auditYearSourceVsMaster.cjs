const fs = require("fs");
const path = require("path");

const YEAR = 2014;

const SOURCE_DIR = path.join(process.cwd(), "data", "pyq_questions_v2", "prelims");
const MASTER_FILE = path.join(process.cwd(), "data", "pyq_index", "pyq_master_index.json");

function walk(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            files = files.concat(walk(full));
        } else if (name.endsWith(".json")) {
            files.push(full);
        }
    }

    return files;
}

function extractQuestions(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.questions)) return json.questions;
    if (json.data && Array.isArray(json.data.questions)) return json.data.questions;
    if (Array.isArray(json.data)) return json.data;

    if (json.years && Array.isArray(json.years)) {
        const out = [];
        for (const y of json.years) {
            for (const set of y.sets || []) {
                for (const q of set.questions || []) {
                    out.push({ ...q, year: q.year || y.year });
                }
            }
        }
        return out;
    }

    if (json && typeof json === "object") {
        const values = Object.values(json);
        if (values.every(v => v && typeof v === "object" && (v.id || v.question))) {
            return values;
        }
    }

    return [];
}

function isCSAT(q, filePath = "") {
    const text = [
        q.paper,
        q.stage,
        q.subject,
        q.module,
        q.id,
        filePath
    ].join(" ").toLowerCase();

    return text.includes("csat");
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .slice(0, 160);
}

function getQuestionText(q) {
    return q.question || q.questionText || q.text || q.stem || "";
}

function addToMap(map, q, sourceFile) {
    const text = normalizeText(getQuestionText(q));
    if (!text) return;

    if (!map.has(text)) {
        map.set(text, []);
    }

    map.get(text).push({
        id: q.id || q.questionId || null,
        year: q.year || null,
        questionNumber: q.questionNumber || q.qNo || q.number || null,
        paper: q.paper || null,
        subject: q.subject || null,
        sourceFile,
        preview: getQuestionText(q).replace(/\s+/g, " ").slice(0, 140),
        answer: q.answer || q.correctAnswer || q.correct_answer || q.answerKey || null
    });
}

function main() {
    const sourceMap = new Map();
    const masterMap = new Map();

    const files = walk(SOURCE_DIR);

    let sourceRawCount = 0;

    for (const file of files) {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            continue;
        }

        const qs = extractQuestions(json);

        for (const q of qs) {
            if (!q || typeof q !== "object") continue;
            if (Number(q.year) !== YEAR) continue;
            if (isCSAT(q, file)) continue;

            sourceRawCount++;
            addToMap(sourceMap, q, path.relative(process.cwd(), file));
        }
    }

    const masterRaw = JSON.parse(fs.readFileSync(MASTER_FILE, "utf8"));
    const masterQuestions = Object.values(masterRaw);

    let masterRawCount = 0;

    for (const q of masterQuestions) {
        if (!q || typeof q !== "object") continue;
        if (Number(q.year) !== YEAR) continue;
        if (isCSAT(q, q.sourceFile)) continue;

        masterRawCount++;
        addToMap(masterMap, q, q.sourceFile || "pyq_master_index.json");
    }

    const sourceKeys = [...sourceMap.keys()];
    const masterKeys = [...masterMap.keys()];

    const missingInMaster = sourceKeys.filter(k => !masterMap.has(k));
    const extraInMaster = masterKeys.filter(k => !sourceMap.has(k));

    console.log(`\n📊 SOURCE VS MASTER AUDIT — GS ${YEAR}\n`);

    console.log("Source raw GS records :", sourceRawCount);
    console.log("Source unique GS      :", sourceMap.size);
    console.log("Master raw GS records :", masterRawCount);
    console.log("Master unique GS      :", masterMap.size);

    console.log("\nDropped from source → master:", missingInMaster.length);
    console.log("Extra in master not in source:", extraInMaster.length);

    if (missingInMaster.length) {
        console.log("\n🔍 Sample dropped source questions:\n");
        missingInMaster.slice(0, 20).forEach((key, i) => {
            const item = sourceMap.get(key)[0];
            console.log(`${i + 1}. ${item.id} | Q${item.questionNumber} | ${item.sourceFile}`);
            console.log(`   ${item.preview}`);
        });
    }

    const outDir = path.join(process.cwd(), "data", "audit");
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(
        path.join(outDir, `source_vs_master_${YEAR}.json`),
        JSON.stringify({
            year: YEAR,
            sourceRawCount,
            sourceUniqueCount: sourceMap.size,
            masterRawCount,
            masterUniqueCount: masterMap.size,
            droppedCount: missingInMaster.length,
            extraCount: extraInMaster.length,
            droppedSamples: missingInMaster.map(k => sourceMap.get(k)[0]),
            extraSamples: extraInMaster.map(k => masterMap.get(k)[0])
        }, null, 2),
        "utf8"
    );

    console.log(`\n📄 Saved: data/audit/source_vs_master_${YEAR}.json\n`);
}

main();