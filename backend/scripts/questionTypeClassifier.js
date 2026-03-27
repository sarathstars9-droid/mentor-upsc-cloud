import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const DEFAULT_INPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_fixed",
    "prelims",
    "gs"
);

const DEFAULT_OUTPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_typed",
    "prelims",
    "gs"
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
        .replace(/[^a-z0-9\s():\-/.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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

function loadQuestionRows(filePath) {
    const raw = readJson(filePath);

    if (Array.isArray(raw)) {
        return { kind: "array", rows: raw };
    }

    if (Array.isArray(raw.questions)) {
        return { kind: "questions", rows: raw.questions, wrapper: raw };
    }

    if (Array.isArray(raw.data)) {
        return { kind: "data", rows: raw.data, wrapper: raw };
    }

    return { kind: "unknown", rows: [] };
}

function rebuildWithSameShape(fileInfo, newRows) {
    if (fileInfo.kind === "array") return newRows;
    if (fileInfo.kind === "questions") return { ...fileInfo.wrapper, questions: newRows };
    if (fileInfo.kind === "data") return { ...fileInfo.wrapper, data: newRows };
    return newRows;
}

function detectListMarkers(text) {
    const raw = normalizeText(text);

    return {
        hasRomanLists:
            /\bList[- ]?I\b/i.test(raw) ||
            /\bList[- ]?II\b/i.test(raw) ||
            /\bList[- ]?1\b/i.test(raw) ||
            /\bList[- ]?2\b/i.test(raw),

        hasColumnAColumnB:
            /\bColumn\s*A\b/i.test(raw) ||
            /\bColumn\s*B\b/i.test(raw),

        hasCodes:
            /\bCodes\s*:?\b/i.test(raw) ||
            /\bCode\s*:?\b/i.test(raw),

        hasPairsWord:
            /\bpairs?\b/i.test(raw),

        hasMatchWord:
            /\bmatch\b/i.test(raw),

        hasFollowingPairs:
            /consider the following pairs/i.test(raw),

        hasFollowingStatements:
            /consider the following statements/i.test(raw) ||
            /which of the following statements/i.test(raw),

        hasStatementsWord:
            /\bstatements?\b/i.test(raw)
    };
}

function countStructuredStatements(text) {
    const raw = normalizeText(text);

    const numberedParen = [
        /\(\s*1\s*\)/g,
        /\(\s*2\s*\)/g,
        /\(\s*3\s*\)/g,
        /\(\s*4\s*\)/g
    ].map((r) => (raw.match(r) || []).length);

    const plainNumberedLines = [
        /(?:^|\n)\s*1[\.\)]\s+/g,
        /(?:^|\n)\s*2[\.\)]\s+/g,
        /(?:^|\n)\s*3[\.\)]\s+/g,
        /(?:^|\n)\s*4[\.\)]\s+/g
    ].map((r) => (raw.match(r) || []).length);

    const onePresent = numberedParen[0] > 0 || plainNumberedLines[0] > 0;
    const twoPresent = numberedParen[1] > 0 || plainNumberedLines[1] > 0;
    const threePresent = numberedParen[2] > 0 || plainNumberedLines[2] > 0;
    const fourPresent = numberedParen[3] > 0 || plainNumberedLines[3] > 0;

    if (onePresent && twoPresent && threePresent && fourPresent) return 4;
    if (onePresent && twoPresent && threePresent) return 3;
    if (onePresent && twoPresent) return 2;
    if (onePresent) return 1;

    return 0;
}

function countSemicolonClauses(text) {
    const raw = normalizeText(text);
    const parts = raw
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean);

    return parts.length;
}

function detectChronology(text) {
    const raw = compactText(text);

    return (
        raw.includes("correct chronological order") ||
        raw.includes("chronological sequence") ||
        raw.includes("correct sequence") ||
        raw.includes("arrange the following in chronological order") ||
        raw.includes("correct order of occurrence") ||
        raw.includes("the correct order is")
    );
}

function detectAssertionReason(text) {
    const raw = normalizeText(text);

    return (
        /\bAssertion\s*\(?A\)?\b/i.test(raw) ||
        /\bReason\s*\(?R\)?\b/i.test(raw) ||
        /\bAssertion\b/i.test(raw) && /\bReason\b/i.test(raw)
    );
}

function detectMapBased(text) {
    const raw = compactText(text);

    return (
        raw.includes("map") ||
        raw.includes("given map") ||
        raw.includes("shown in the map") ||
        raw.includes("consider the map") ||
        raw.includes("location on the map")
    );
}

function detectPairBased(text, markers) {
    const raw = normalizeText(text);

    if (markers.hasFollowingPairs) return true;
    if (markers.hasPairsWord && /\bwhich one of the above pairs\b/i.test(raw)) return true;
    if (markers.hasPairsWord && /\bare correctly matched\b/i.test(raw)) return true;
    if (markers.hasPairsWord && /\bnot correctly matched\b/i.test(raw)) return true;

    return false;
}

function detectMatching(text, markers) {
    const raw = normalizeText(text);

    if (markers.hasRomanLists) return true;
    if (markers.hasColumnAColumnB) return true;
    if (markers.hasMatchWord && /\bList/i.test(raw)) return true;
    if (markers.hasMatchWord && markers.hasCodes) return true;
    if (/match the following/i.test(raw)) return true;

    return false;
}

function detectStatementType(text, markers) {
    const raw = normalizeText(text);

    if (!markers.hasFollowingStatements && !markers.hasStatementsWord) {
        return null;
    }

    const structuredCount = countStructuredStatements(raw);

    if (structuredCount >= 4) return "MCQ_4_STATEMENT";
    if (structuredCount === 3) return "MCQ_3_STATEMENT";
    if (structuredCount === 2) return "MCQ_2_STATEMENT";
    if (structuredCount === 1) return "MCQ_1_STATEMENT";

    const clauseCount = countSemicolonClauses(raw);

    if (/which of the statements given above/i.test(raw) || /statements given above/i.test(raw)) {
        if (clauseCount >= 4) return "MCQ_4_STATEMENT";
        if (clauseCount === 3) return "MCQ_3_STATEMENT";
        if (clauseCount === 2) return "MCQ_2_STATEMENT";
    }

    return "STATEMENT_BASED";
}

function classifyQuestionType(q) {
    const text = extractQuestionText(q);
    const markers = detectListMarkers(text);

    if (!text) {
        return {
            questionType: q.questionType || "MCQ",
            typeAudit: {
                classifierReason: "empty-text-fallback",
                confidence: 0.2
            }
        };
    }

    if (detectAssertionReason(text)) {
        return {
            questionType: "ASSERTION_REASON",
            typeAudit: { classifierReason: "assertion-reason-detected", confidence: 0.98 }
        };
    }

    if (detectMapBased(text)) {
        return {
            questionType: "MAP_BASED",
            typeAudit: { classifierReason: "map-keyword-detected", confidence: 0.9 }
        };
    }

    if (detectChronology(text)) {
        return {
            questionType: "CHRONOLOGY",
            typeAudit: { classifierReason: "chronology-keyword-detected", confidence: 0.96 }
        };
    }

    if (detectMatching(text, markers)) {
        return {
            questionType: "MATCHING",
            typeAudit: { classifierReason: "list-or-match-structure-detected", confidence: 0.96 }
        };
    }

    if (detectPairBased(text, markers)) {
        return {
            questionType: "PAIR_BASED",
            typeAudit: { classifierReason: "pair-structure-detected", confidence: 0.95 }
        };
    }

    const statementType = detectStatementType(text, markers);
    if (statementType) {
        return {
            questionType: statementType,
            typeAudit: { classifierReason: "statement-structure-detected", confidence: 0.9 }
        };
    }

    return {
        questionType: "MCQ",
        typeAudit: { classifierReason: "default-mcq", confidence: 0.7 }
    };
}

function classifyOneRow(row) {
    const result = classifyQuestionType(row);

    return {
        ...row,
        questionType: result.questionType,
        typeAudit: result.typeAudit
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

    let totalQuestions = 0;
    const questionTypeCounts = {};
    const auditRows = [];

    for (const file of files) {
        const rel = path.relative(inputDir, file);
        const outFile = path.join(outputDir, rel);

        const fileInfo = loadQuestionRows(file);
        const typedRows = [];

        for (const row of fileInfo.rows) {
            const typed = classifyOneRow(row);
            typedRows.push(typed);
            totalQuestions++;

            const qt = typed.questionType || "UNKNOWN";
            questionTypeCounts[qt] = (questionTypeCounts[qt] || 0) + 1;

            auditRows.push({
                file: rel,
                id: typed.id || null,
                year: typed.year || null,
                questionNumber: typed.questionNumber || typed.qno || typed.number || null,
                subject: typed.subject || null,
                topic: typed.topic || null,
                microtheme: typed.microtheme || null,
                questionType: typed.questionType || null,
                classifierReason: typed.typeAudit?.classifierReason || null,
                classifierConfidence: typed.typeAudit?.confidence || null
            });
        }

        const rebuilt = rebuildWithSameShape(fileInfo, typedRows);
        writeJson(outFile, rebuilt);
    }

    writeJson(path.join(outputDir, "_question_type_audit.json"), {
        totalFiles: files.length,
        totalQuestions,
        questionTypeCounts
    });

    writeJson(path.join(outputDir, "_question_type_rows.json"), auditRows);

    console.log("\n✅ questionTypeClassifier completed\n");
    console.log(
        JSON.stringify(
            {
                totalFiles: files.length,
                totalQuestions,
                questionTypeCounts
            },
            null,
            2
        )
    );
    console.log("\nOutput dir:");
    console.log(outputDir);
}

main();