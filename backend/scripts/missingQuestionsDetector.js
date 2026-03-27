import fs from "fs";
import path from "path";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";


const ROOT = process.cwd();

const TAGGED_JSON_PATH = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_questions",
    "prelims"
    // put your tagged prelims files here or pass --taggedDir / --taggedFile
);

const DEFAULT_OUTPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "audit"
);

const SUBJECT_KEYWORDS = {
    polity: [
        "constitution",
        "constitutional",
        "parliament",
        "legislature",
        "judiciary",
        "president",
        "governor",
        "fundamental rights",
        "directive principles",
        "panchayat",
        "election commission",
        "cag",
        "finance commission",
        "federal",
        "union government",
        "supreme court",
        "high court",
        "citizenship",
        "ordinance"
    ],
    economy: [
        "gdp",
        "inflation",
        "monetary policy",
        "repo rate",
        "banking",
        "budget",
        "fiscal",
        "tax",
        "subsidy",
        "poverty",
        "niti aayog",
        "rbi",
        "balance of payments",
        "current account",
        "capital account",
        "sebi",
        "stock exchange",
        "money supply"
    ],
    geography: [
        "monsoon",
        "river",
        "plateau",
        "mountain",
        "soil",
        "climate",
        "cyclone",
        "earthquake",
        "ocean",
        "forest type",
        "biosphere reserve",
        "latitude",
        "longitude",
        "minerals",
        "drainage",
        "desert",
        "wetland"
    ],
    history: [
        "buddhism",
        "jainism",
        "gupta",
        "maurya",
        "mughal",
        "harappa",
        "indus valley",
        "national movement",
        "congress",
        "governor-general",
        "viceroy",
        "revolt of 1857",
        "bhakti",
        "sufi",
        "sangam",
        "ashoka",
        "gandhi",
        "swadeshi"
    ],
    environment: [
        "biodiversity",
        "ecosystem",
        "species",
        "iucn",
        "national park",
        "wildlife sanctuary",
        "climate change",
        "wetland",
        "forest",
        "pollution",
        "ozone",
        "cop",
        "unfccc",
        "ramsar",
        "cms",
        "cites",
        "biosphere"
    ],
    science_tech: [
        "dna",
        "rna",
        "biotechnology",
        "vaccine",
        "satellite",
        "space",
        "artificial intelligence",
        "robotics",
        "nanotechnology",
        "semiconductor",
        "nuclear",
        "laser",
        "blockchain",
        "quantum",
        "genome",
        "crispr"
    ],
    art_culture: [
        "temple",
        "dance",
        "music",
        "painting",
        "sculpture",
        "unesco",
        "heritage",
        "architecture",
        "stupa",
        "classical language",
        "festival",
        "literature",
        "theatre",
        "inscription"
    ]
};

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

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/[‐-–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function compactText(text) {
    return normalizeText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
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
    return (
        q.questionNumber ||
        q.qno ||
        q.number ||
        q.originalQuestionNumber ||
        null
    );
}

function extractYear(q, fallbackYear = null) {
    const v = q.year || q.examYear || q.paperYear || fallbackYear;
    return v ? String(v) : null;
}

function collectTaggedQuestionsFromFile(filePath) {
    const raw = readJson(filePath);
    let rows = [];

    if (Array.isArray(raw)) {
        rows = raw;
    } else if (Array.isArray(raw.questions)) {
        rows = raw.questions;
    } else if (Array.isArray(raw.data)) {
        rows = raw.data;
    } else {
        rows = [];
    }

    const inferredYearFromFile =
        path.basename(filePath).match(/(20\d{2}|201\d|202\d)/)?.[1] || null;

    return rows
        .map((q, index) => ({
            sourceFile: filePath,
            sourceIndex: index,
            id: q.id || null,
            year: extractYear(q, inferredYearFromFile),
            questionNumber: extractQuestionNumber(q),
            subject: q.subject || null,
            topic: q.topic || null,
            microtheme: q.microtheme || q.microTheme || null,
            questionType: q.questionType || null,
            syllabusNodeId: q.syllabusNodeId || null,
            text: extractQuestionText(q),
            normalized: compactText(extractQuestionText(q))
        }))
        .filter((q) => q.text);
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

function collectTaggedQuestions({ taggedFile, taggedDir }) {
    if (taggedFile) {
        return collectTaggedQuestionsFromFile(path.resolve(taggedFile));
    }

    const dir = taggedDir
        ? path.resolve(taggedDir)
        : TAGGED_JSON_PATH;

    const files = getAllJsonFiles(dir).filter((f) =>
        path.basename(f).toLowerCase().includes("tagged")
    );

    let all = [];
    for (const file of files) {
        all.push(...collectTaggedQuestionsFromFile(file));
    }
    return all;
}

async function extractPdfText(pdfPath) {
    const buffer = fs.readFileSync(pdfPath);

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    return normalizeText(result?.text || "");
}

function splitPdfByYear(rawText) {
    const clean = normalizeText(rawText);

    const yearRegex = /\b(2011|2012|2013|2014|2015|2016|2017|2018|2019|2020|2021|2022|2023|2024|2025)\b/g;
    const matches = [...clean.matchAll(yearRegex)];

    const sections = {};

    for (let i = 0; i < matches.length; i++) {
        const year = matches[i][1];
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : clean.length;

        const slice = clean.slice(start, end);

        if (!sections[year]) {
            sections[year] = [];
        }

        sections[year].push(slice);
    }

    const merged = {};
    for (const [year, chunks] of Object.entries(sections)) {
        merged[year] = chunks.join("\n\n");
    }

    return merged;
}

function cleanupQuestionBlock(text) {
    return normalizeText(
        text
            .replace(/\b(a|b|c|d)\)\s+/gi, "\n$1) ")
            .replace(/\(\s*a\s*\)/gi, "\na) ")
            .replace(/\(\s*b\s*\)/gi, "\nb) ")
            .replace(/\(\s*c\s*\)/gi, "\nc) ")
            .replace(/\(\s*d\s*\)/gi, "\nd) ")
    );
}

function parseQuestionsFromYearText(year, yearText) {
    const clean = normalizeText(yearText);

    const lines = clean
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const questions = [];
    let current = null;

    const qStartRegex = /^(\d{1,3})[\.\)]\s+(.*)$/;

    for (const line of lines) {
        const match = line.match(qStartRegex);

        if (match) {
            const qno = Number(match[1]);

            // strict UPSC prelims GS paper range
            if (qno >= 1 && qno <= 100) {
                if (current) {
                    questions.push(current);
                }

                current = {
                    year: String(year),
                    questionNumber: qno,
                    rawLines: [match[2]]
                };
                continue;
            }
        }

        if (current) {
            // stop collecting if answer/explanation style junk begins
            if (
                /^answer\s*[:\-]/i.test(line) ||
                /^solution\s*[:\-]/i.test(line) ||
                /^explanation\s*[:\-]/i.test(line) ||
                /^difficulty\s*[:\-]/i.test(line) ||
                /^topic\s*[:\-]/i.test(line) ||
                /^source\s*[:\-]/i.test(line)
            ) {
                continue;
            }

            current.rawLines.push(line);
        }
    }

    if (current) {
        questions.push(current);
    }

    // merge same question numbers, keep longest block
    const bestByQno = new Map();

    for (const q of questions) {
        const text = cleanupQuestionBlock(q.rawLines.join("\n"));
        const normalized = compactText(text);

        const existing = bestByQno.get(q.questionNumber);

        const candidate = {
            year: q.year,
            questionNumber: q.questionNumber,
            text,
            normalized
        };

        if (!existing || candidate.text.length > existing.text.length) {
            bestByQno.set(q.questionNumber, candidate);
        }
    }

    return [...bestByQno.values()].sort((a, b) => a.questionNumber - b.questionNumber);
}

function scoreTextSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const setA = new Set(a.split(" "));
    const setB = new Set(b.split(" "));
    let intersection = 0;

    for (const token of setA) {
        if (setB.has(token)) intersection++;
    }

    const union = new Set([...setA, ...setB]).size || 1;
    return intersection / union;
}

function inferSubjectFromText(text) {
    const lower = compactText(text);
    let bestSubject = null;
    let bestScore = 0;

    for (const [subject, words] of Object.entries(SUBJECT_KEYWORDS)) {
        let score = 0;
        for (const w of words) {
            if (lower.includes(compactText(w))) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestSubject = subject;
        }
    }

    return {
        inferredSubject: bestSubject,
        inferredSubjectScore: bestScore
    };
}

function indexTaggedByYearAndNumber(taggedRows) {
    const map = new Map();

    for (const row of taggedRows) {
        const year = row.year ? String(row.year) : null;
        const qno = row.questionNumber != null ? String(row.questionNumber) : null;
        if (!year || !qno) continue;
        map.set(`${year}::${qno}`, row);
    }

    return map;
}

function findBestTaggedMatch(pdfQuestion, taggedRowsForYear) {
    let best = null;
    let bestScore = 0;

    for (const tagged of taggedRowsForYear) {
        const score = scoreTextSimilarity(pdfQuestion.normalized, tagged.normalized);
        if (score > bestScore) {
            bestScore = score;
            best = tagged;
        }
    }

    return { best, bestScore };
}

function buildTaggedYearBuckets(taggedRows) {
    const byYear = {};
    for (const row of taggedRows) {
        const year = row.year || "UNKNOWN";
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(row);
    }
    return byYear;
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

async function main() {
    const args = parseArgs();

    const taggedFile = args.taggedFile || null;
    const taggedDir = args.taggedDir || null;
    const pdfPath = args.pdf || null;
    const outputDir = args.outputDir
        ? path.resolve(args.outputDir)
        : DEFAULT_OUTPUT_DIR;

    if (!pdfPath) {
        throw new Error("Missing --pdf path");
    }

    ensureDir(outputDir);

    const taggedRows = collectTaggedQuestions({ taggedFile, taggedDir });
    if (!taggedRows.length) {
        throw new Error("No tagged questions found");
    }

    const pdfText = await extractPdfText(path.resolve(pdfPath));
    const yearChunks = splitPdfByYear(pdfText);

    const pdfQuestions = [];
    for (const [year, text] of Object.entries(yearChunks)) {
        const parsed = parseQuestionsFromYearText(year, text);

        // keep only max 100 unique qnos per year
        const deduped = [];
        const seen = new Set();

        for (const q of parsed) {
            if (!seen.has(q.questionNumber) && q.questionNumber >= 1 && q.questionNumber <= 100) {
                seen.add(q.questionNumber);
                deduped.push(q);
            }
        }

        pdfQuestions.push(...deduped);
    }

    const taggedByYearAndNumber = indexTaggedByYearAndNumber(taggedRows);
    const taggedByYear = buildTaggedYearBuckets(taggedRows);

    const missingQuestions = [];
    const mismatchedQuestions = [];
    const matchedQuestions = [];

    for (const pdfQ of pdfQuestions) {
        const key = `${pdfQ.year}::${pdfQ.questionNumber}`;
        const direct = taggedByYearAndNumber.get(key);

        if (direct) {
            const similarity = scoreTextSimilarity(pdfQ.normalized, direct.normalized);
            matchedQuestions.push({
                year: pdfQ.year,
                questionNumber: pdfQ.questionNumber,
                taggedId: direct.id,
                similarity,
                status: similarity >= 0.55 ? "MATCHED" : "LOW_SIMILARITY"
            });

            if (similarity < 0.55) {
                mismatchedQuestions.push({
                    year: pdfQ.year,
                    questionNumber: pdfQ.questionNumber,
                    pdfText: pdfQ.text,
                    taggedText: direct.text,
                    taggedId: direct.id,
                    similarity,
                    taggedSubject: direct.subject,
                    taggedTopic: direct.topic,
                    taggedMicrotheme: direct.microtheme
                });
            }

            continue;
        }

        const yearBucket = taggedByYear[pdfQ.year] || [];
        const { best, bestScore } = findBestTaggedMatch(pdfQ, yearBucket);

        missingQuestions.push({
            year: pdfQ.year,
            questionNumber: pdfQ.questionNumber,
            pdfText: pdfQ.text,
            normalized: pdfQ.normalized,
            bestSimilarTaggedId: best?.id || null,
            bestSimilarityInSameYear: Number(bestScore.toFixed(4)),
            bestSimilarTaggedText: best?.text || null,
            bestSimilarTaggedSubject: best?.subject || null,
            bestSimilarTaggedTopic: best?.topic || null,
            bestSimilarTaggedMicrotheme: best?.microtheme || null,
            ...inferSubjectFromText(pdfQ.text)
        });
    }

    const taggedWithoutYearOrQno = taggedRows.filter(
        (q) => !q.year || q.questionNumber == null
    );

    const pdfByYearCounts = {};
    for (const q of pdfQuestions) {
        pdfByYearCounts[q.year] = (pdfByYearCounts[q.year] || 0) + 1;
    }

    const taggedByYearCounts = {};
    for (const q of taggedRows) {
        const year = q.year || "UNKNOWN";
        taggedByYearCounts[year] = (taggedByYearCounts[year] || 0) + 1;
    }

    const yearlyAudit = Object.keys({
        ...pdfByYearCounts,
        ...taggedByYearCounts
    })
        .sort()
        .map((year) => ({
            year,
            pdfCount: pdfByYearCounts[year] || 0,
            taggedCount: taggedByYearCounts[year] || 0,
            difference: (pdfByYearCounts[year] || 0) - (taggedByYearCounts[year] || 0)
        }));

    const summary = {
        taggedTotal: taggedRows.length,
        pdfExtractedTotal: pdfQuestions.length,
        matchedCount: matchedQuestions.length,
        missingCount: missingQuestions.length,
        mismatchedCount: mismatchedQuestions.length,
        taggedWithoutYearOrQuestionNumber: taggedWithoutYearOrQno.length,
        yearlyAudit
    };

    writeJson(path.join(outputDir, "prelims_missing_questions_summary.json"), summary);
    writeJson(path.join(outputDir, "prelims_missing_questions.json"), missingQuestions);
    writeJson(path.join(outputDir, "prelims_mismatched_questions.json"), mismatchedQuestions);
    writeJson(
        path.join(outputDir, "prelims_tagged_without_year_or_qno.json"),
        taggedWithoutYearOrQno
    );

    console.log("\n✅ Missing question audit completed\n");
    console.log(JSON.stringify(summary, null, 2));
    console.log("\nOutput files:");
    console.log(path.join(outputDir, "prelims_missing_questions_summary.json"));
    console.log(path.join(outputDir, "prelims_missing_questions.json"));
    console.log(path.join(outputDir, "prelims_mismatched_questions.json"));
    console.log(path.join(outputDir, "prelims_tagged_without_year_or_qno.json"));
}

main().catch((err) => {
    console.error("\n❌ Audit failed");
    console.error(err);
    process.exit(1);
});