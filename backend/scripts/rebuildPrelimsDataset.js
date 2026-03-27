import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const DEFAULT_INPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_typed",
    "prelims",
    "gs"
);

const DEFAULT_OUTPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_rebuilt",
    "prelims"
);

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getAllJsonFiles(dirPath) {
    const out = [];
    if (!fs.existsSync(dirPath)) return out;

    for (const entry of fs.readdirSync(dirPath)) {
        const full = path.join(dirPath, entry);
        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            out.push(...getAllJsonFiles(full));
        } else if (entry.toLowerCase().endsWith(".json")) {
            out.push(full);
        }
    }

    return out;
}

function parseArgs() {
    const args = process.argv.slice(2);
    const out = {};

    for (let i = 0; i < args.length; i++) {
        const key = args[i];
        const val = args[i + 1];

        if (key.startsWith("--")) {
            out[key.slice(2)] = val && !val.startsWith("--") ? val : true;
            if (val && !val.startsWith("--")) i++;
        }
    }

    return out;
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[‐-–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function compactText(text) {
    return normalizeText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s&/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function slugify(text) {
    return compactText(text)
        .replace(/&/g, " and ")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function normalizeSubject(subject) {
    const s = compactText(subject);

    if (s.includes("polity")) return "Polity";
    if (s.includes("economy")) return "Economy";
    if (s.includes("geography")) return "Geography";
    if (s.includes("environment")) return "Environment";
    if (s.includes("science")) return "Science & Technology";
    if (s.includes("history")) return "History & Culture";
    if (s.includes("culture")) return "History & Culture";

    return subject || "Unknown";
}

function subjectCode(subject) {
    const s = normalizeSubject(subject);

    if (s === "Polity") return "POL";
    if (s === "Economy") return "ECO";
    if (s === "Geography") return "GEO";
    if (s === "Environment") return "ENV";
    if (s === "Science & Technology") return "SCI";
    if (s === "History & Culture") return "HIS";
    return "GEN";
}

function topicCode(topic) {
    const t = compactText(topic);

    const map = {
        "preamble constitutional foundations": "PREFND",
        "fundamental rights dpsp duties": "FRDPSP",
        "union executive": "UNEXEC",
        "parliament legislature": "PARL",
        "judiciary": "JUD",
        "federalism local governance": "FEDLOC",
        "constitutional statutory bodies": "CONBOD",

        "banking structure": "BANK",
        "monetary policy": "MONPOL",
        "inflation fiscal": "INFFISC",
        "budget": "BUDGET",
        "taxation": "TAX",
        "financial markets": "FINMKT",
        "external sector": "EXTSEC",
        "growth development": "GRDEV",
        "poverty inclusion": "POVINC",

        "geomorphology": "GEOMORPH",
        "climatology": "CLIMATE",
        "oceanography": "OCEAN",
        "indian geography": "INDGEO",
        "resources agriculture": "RESAGR",

        "biodiversity species": "BIODIV",
        "protected areas": "PROTECT",
        "climate change": "CC",
        "environmental conventions": "ENVCONV",
        "pollution ecology": "POLLECO",

        "biotechnology": "BIOTECH",
        "space technology": "SPACE",
        "emerging technologies": "EMTECH",
        "physics nuclear electronics": "PHYNUC",

        "ancient history": "ANC",
        "medieval history": "MED",
        "modern history": "MOD",
        "art culture": "ARTCUL"
    };

    const cleaned = t.replace(/[&/-]/g, " ").replace(/\s+/g, " ").trim();
    return map[cleaned] || slugify(topic).toUpperCase().slice(0, 12) || "TOPIC";
}

function microthemeCode(microtheme) {
    const s = slugify(microtheme).toUpperCase();
    return s.slice(0, 20) || "MICRO";
}

function normalizeQuestionType(type) {
    const t = compactText(type);

    if (t === "mcq") return "MCQ";
    if (t === "pair_based") return "PAIR_BASED";
    if (t === "matching") return "MATCHING";
    if (t === "map_based") return "MAP_BASED";
    if (t === "chronology") return "CHRONOLOGY";
    if (t === "assertion_reason") return "ASSERTION_REASON";
    if (t === "mcq_1_statement") return "MCQ_1_STATEMENT";
    if (t === "mcq_2_statement") return "MCQ_2_STATEMENT";
    if (t === "mcq_3_statement") return "MCQ_3_STATEMENT";
    if (t === "mcq_4_statement") return "MCQ_4_STATEMENT";
    if (t === "statement_based") return "STATEMENT_BASED";

    return type || "MCQ";
}

function extractQuestionText(q) {
    return normalizeText(
        q.question ||
        q.questionText ||
        q.stem ||
        q.title ||
        q.text ||
        ""
    );
}

function extractQuestionNumber(q) {
    const n =
        q.questionNumber ??
        q.qno ??
        q.number ??
        q.originalQuestionNumber ??
        null;

    return n == null ? null : Number(n);
}

function extractYear(q, fallbackYear = null) {
    const y = q.year || q.examYear || q.paperYear || fallbackYear || null;
    return y == null ? null : Number(y);
}

function loadQuestionRows(filePath) {
    const raw = readJson(filePath);

    if (Array.isArray(raw)) {
        return raw;
    }

    if (Array.isArray(raw.questions)) {
        return raw.questions;
    }

    if (Array.isArray(raw.data)) {
        return raw.data;
    }

    return [];
}

function buildSyllabusNodeId(subject, topic, microtheme) {
    return `PRE-GS-${subjectCode(subject)}-${topicCode(topic)}-${microthemeCode(microtheme)}`;
}

function buildCanonicalId(row, indexInFile) {
    const year = extractYear(row) || "0000";
    const qno = extractQuestionNumber(row) || indexInFile + 1;
    const subj = subjectCode(row.subject || "Unknown");
    return `PRE_GS_${subj}_${year}_${String(qno).padStart(3, "0")}`;
}

function reviewFlag(row) {
    const flag = row?.mappingAudit?.reviewFlag || "OK";
    if (flag) return flag;

    if (!row.subject || row.subject === "Unknown") return "REVIEW_SUBJECT";
    if (!row.topic || row.topic === "Unmapped Topic") return "REVIEW_TOPIC";
    if (!row.microtheme || row.microtheme === "Unmapped Microtheme") return "REVIEW_MICROTHEME";

    return "OK";
}

function fileSubjectHint(filePath) {
    const base = compactText(path.basename(filePath));

    if (base.includes("polity")) return "Polity";
    if (base.includes("economy")) return "Economy";
    if (base.includes("geography")) return "Geography";
    if (base.includes("environment")) return "Environment";
    if (base.includes("science")) return "Science & Technology";
    if (base.includes("history")) return "History & Culture";
    if (base.includes("culture")) return "History & Culture";

    return null;
}

function rebuildRow(row, filePath, indexInFile) {
    const fallbackSubject = fileSubjectHint(filePath);

    const subject = normalizeSubject(row.subject || fallbackSubject || "Unknown");
    const topic = normalizeText(row.topic || "Unmapped Topic");
    const microtheme = normalizeText(row.microtheme || row.microTheme || topic || "Unmapped Microtheme");
    const questionType = normalizeQuestionType(row.questionType || "MCQ");
    const question = extractQuestionText(row);
    const year = extractYear(row);
    const questionNumber = extractQuestionNumber(row);

    const canonicalId = buildCanonicalId(
        {
            ...row,
            subject
        },
        indexInFile
    );

    const syllabusNodeId =
        normalizeText(row.syllabusNodeId) ||
        buildSyllabusNodeId(subject, topic, microtheme);

    return {
        id: canonicalId,
        year,
        questionNumber,
        subject,
        topic,
        microtheme,
        questionType,
        syllabusNodeId,
        question,
        options: row.options || row.choices || row.answers || null,
        answer: row.answer ?? row.correctAnswer ?? row.correct_option ?? null,
        sourceFile: path.basename(filePath),
        originalId: row.id || null,
        reviewFlag: reviewFlag(row),
        mappingAudit: row.mappingAudit || null,
        typeAudit: row.typeAudit || null
    };
}

function dedupeRows(rows) {
    const map = new Map();

    for (const row of rows) {
        const key = `${row.year || "0000"}::${row.questionNumber || "000"}::${compactText(row.question).slice(0, 180)}`;

        const existing = map.get(key);

        if (!existing) {
            map.set(key, row);
            continue;
        }

        const existingScore =
            (existing.reviewFlag === "OK" ? 3 : 0) +
            (existing.topic && existing.topic !== "Unmapped Topic" ? 2 : 0) +
            (existing.microtheme && existing.microtheme !== "Unmapped Microtheme" ? 2 : 0) +
            (existing.syllabusNodeId ? 1 : 0);

        const candidateScore =
            (row.reviewFlag === "OK" ? 3 : 0) +
            (row.topic && row.topic !== "Unmapped Topic" ? 2 : 0) +
            (row.microtheme && row.microtheme !== "Unmapped Microtheme" ? 2 : 0) +
            (row.syllabusNodeId ? 1 : 0);

        if (candidateScore > existingScore) {
            map.set(key, row);
        }
    }

    return [...map.values()];
}

function sortRows(rows) {
    return rows.sort((a, b) => {
        if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
        if ((a.questionNumber || 0) !== (b.questionNumber || 0)) return (a.questionNumber || 0) - (b.questionNumber || 0);
        return String(a.id).localeCompare(String(b.id));
    });
}

function buildIndexes(rows) {
    const bySubject = {};
    const byTopic = {};
    const byMicrotheme = {};
    const byQuestionType = {};
    const byYear = {};
    const byNode = {};
    const reviewSummary = {};

    for (const row of rows) {
        const id = row.id;

        if (row.subject) {
            if (!bySubject[row.subject]) bySubject[row.subject] = [];
            bySubject[row.subject].push(id);
        }

        if (row.topic) {
            if (!byTopic[row.topic]) byTopic[row.topic] = [];
            byTopic[row.topic].push(id);
        }

        if (row.microtheme) {
            if (!byMicrotheme[row.microtheme]) byMicrotheme[row.microtheme] = [];
            byMicrotheme[row.microtheme].push(id);
        }

        if (row.questionType) {
            if (!byQuestionType[row.questionType]) byQuestionType[row.questionType] = [];
            byQuestionType[row.questionType].push(id);
        }

        if (row.year != null) {
            if (!byYear[row.year]) byYear[row.year] = [];
            byYear[row.year].push(id);
        }

        if (row.syllabusNodeId) {
            if (!byNode[row.syllabusNodeId]) byNode[row.syllabusNodeId] = [];
            byNode[row.syllabusNodeId].push(id);
        }

        const flag = row.reviewFlag || "OK";
        reviewSummary[flag] = (reviewSummary[flag] || 0) + 1;
    }

    return {
        bySubject,
        byTopic,
        byMicrotheme,
        byQuestionType,
        byYear,
        byNode,
        reviewSummary
    };
}

function main() {
    const args = parseArgs();

    const inputDir = args.inputDir
        ? path.resolve(args.inputDir)
        : DEFAULT_INPUT_DIR;

    const outputDir = args.outputDir
        ? path.resolve(args.outputDir)
        : DEFAULT_OUTPUT_DIR;

    ensureDir(outputDir);

    const files = getAllJsonFiles(inputDir).filter((f) => {
        const base = path.basename(f).toLowerCase();
        return base.endsWith(".json") && !base.startsWith("_");
    });

    let allRows = [];

    for (const file of files) {
        const rows = loadQuestionRows(file);
        const rebuilt = rows.map((row, index) => rebuildRow(row, file, index));
        allRows.push(...rebuilt);
    }

    const dedupedRows = dedupeRows(allRows);
    const finalRows = sortRows(dedupedRows);
    const indexes = buildIndexes(finalRows);

    writeJson(path.join(outputDir, "prelims_gs_rebuilt_master.json"), finalRows);
    writeJson(path.join(outputDir, "prelims_gs_by_subject.json"), indexes.bySubject);
    writeJson(path.join(outputDir, "prelims_gs_by_topic.json"), indexes.byTopic);
    writeJson(path.join(outputDir, "prelims_gs_by_microtheme.json"), indexes.byMicrotheme);
    writeJson(path.join(outputDir, "prelims_gs_by_question_type.json"), indexes.byQuestionType);
    writeJson(path.join(outputDir, "prelims_gs_by_year.json"), indexes.byYear);
    writeJson(path.join(outputDir, "prelims_gs_by_syllabus_node.json"), indexes.byNode);
    writeJson(
        path.join(outputDir, "prelims_gs_rebuild_summary.json"),
        {
            totalFiles: files.length,
            inputRows: allRows.length,
            finalRows: finalRows.length,
            reviewSummary: indexes.reviewSummary
        }
    );

    console.log("\n✅ rebuildPrelimsDataset completed\n");
    console.log(
        JSON.stringify(
            {
                totalFiles: files.length,
                inputRows: allRows.length,
                finalRows: finalRows.length,
                reviewSummary: indexes.reviewSummary
            },
            null,
            2
        )
    );
    console.log("\nOutput dir:");
    console.log(outputDir);
}

main();