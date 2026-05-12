import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { normalizePyqRecord } from "../brain/normalizePyqRecord.js";
import { normalizePyqNodeId } from "../brain/pyqNodeAliasMap.js";
import { refinePyqNodeId } from "../brain/intelligentPyqTopicMapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../data");
const PYQ_V2_DIR = path.join(DATA_DIR, "pyq_questions_v2", "prelims");
const OUTPUT_DIR = path.join(DATA_DIR, "pyq_index");

// Exclude only bad/generated/non-question logs.
// Do NOT exclude *_master_index because some valid questions exist only there.
const SKIP_FILE_RE =
  /(_report|_by_node|_change_log|_all_topics|_production|_perfection|_zero_ambiguity|build_stats|audit)/i;

const CSAT_MODULE_TO_NODE = {
  "Logical Reasoning": "CSAT-LR",
  Reasoning: "CSAT-LR",
  "Quantitative Aptitude": "CSAT-BN",
  "Basic Numeracy": "CSAT-BN",
  Mathematics: "CSAT-BN",
  "Reading Comprehension": "CSAT-RC",
  Comprehension: "CSAT-RC",
  "Data Interpretation": "CSAT-DI",
  "Decision Making": "CSAT-DS",
};

const ID_PREFIX_TO_NODE = {
  ENV_LAW: "GS3-ENV-ACTS-MT01",
  ENV_CLI: "GS3-ENV-GLOBALWARM-MT01",
  ENV_POL: "GS3-ENV-INTL-MT01",
  ENV_SPC: "GS3-ENV-SPECIES-MT01",
  ENV_ECO: "GS3-ENV-ECO-CONCEPTS-MT01",
  ENV_BIO: "GS3-ENV-CONSERVATION-MT01",
  ENV_CONS: "GS3-ENV-CONSERVATION-MT01",
  ENV_MISC: "GS3-ENV-CURR-POLLUTION-MT01",
};

function normalizeAnswer(ans) {
  if (ans === undefined || ans === null) return null;

  if (typeof ans === "object") {
    ans =
      ans.correct_option ??
      ans.correctOption ??
      ans.correct_answer ??
      ans.correctAnswer ??
      ans.answer ??
      ans.option ??
      ans.key ??
      ans.value ??
      null;
  }

  if (ans === undefined || ans === null) return null;

  const clean = String(ans).trim().toUpperCase().replace(/[().]/g, "");
  return ["A", "B", "C", "D"].includes(clean) ? clean : null;
}

function getNormalizedAnswer(q) {
  return normalizeAnswer(
    q.answer ??
    q.correctAnswer ??
    q.correct_answer ??
    q.answerKey ??
    q.correctOption ??
    q.correct_option
  );
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function textFingerprint(q) {
  const text = normalizeText(q.question || q.questionText || q.text || q.stem);
  if (!text) return null;
  return `${q.year ?? "unknown"}::${String(q.paper || q.stage || "GS").toUpperCase()}::${text.slice(0, 180)}`;
}

function deriveNodeIdFromIdPrefix(id) {
  const prefix = String(id || "").replace(/_\d{4}_.*$/, "");
  return ID_PREFIX_TO_NODE[prefix] || null;
}

function deriveCsatNodeId(qModule, metaModule) {
  return (
    CSAT_MODULE_TO_NODE[(qModule || "").trim()] ||
    CSAT_MODULE_TO_NODE[(metaModule || "").trim()] ||
    "CSAT-LR"
  );
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function findJsonFiles(dir, fileList = []) {
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      await findJsonFiles(fullPath, fileList);
    } else if (
      item.isFile() &&
      item.name.endsWith(".json") &&
      !SKIP_FILE_RE.test(item.name)
    ) {
      fileList.push({ path: fullPath, name: item.name });
    }
  }

  return fileList;
}

function extractFromPayload(parsed) {
  if (Array.isArray(parsed)) return { questions: parsed, meta: {} };

  if (parsed?.data?.questions && Array.isArray(parsed.data.questions)) {
    const { questions, ...meta } = parsed.data;
    return { questions, meta };
  }

  if (parsed?.questions && Array.isArray(parsed.questions)) {
    const { questions, ...meta } = parsed;
    return { questions, meta };
  }

  if (parsed?.years && Array.isArray(parsed.years)) {
    const { years, ...meta } = parsed;
    const questions = [];

    for (const yearObj of years) {
      for (const setObj of yearObj.sets || []) {
        for (const q of setObj.questions || []) {
          questions.push({
            ...q,
            id: q.id || q.questionId,
            year: q.year || yearObj.year,
          });
        }
      }
    }

    return { questions, meta };
  }

  if (parsed && typeof parsed === "object") {
    const values = Object.values(parsed);
    if (values.length && values.every(v => v && typeof v === "object" && (v.id || v.question))) {
      return { questions: values, meta: {} };
    }
  }

  return { questions: [], meta: {} };
}

function qualityScore(q) {
  let score = 0;

  if (q.id) score += 5;
  if (q.year) score += 5;
  if (q.question && String(q.question).length > 25) score += 20;
  if (q.options && Object.values(q.options).filter(Boolean).length >= 4) score += 20;
  if (normalizeAnswer(q.answer)) score += 100;
  if (q.syllabusNodeId || q.nodeId) score += 10;

  // Prefer topic/source files over broad generated master files when both are equal.
  const sf = String(q.sourceFile || "").toLowerCase();
  if (sf.includes("master_index")) score -= 2;

  return score;
}

function shouldReplace(existing, incoming) {
  if (!existing) return true;

  const existingHasAnswer = !!normalizeAnswer(existing.answer);
  const incomingHasAnswer = !!normalizeAnswer(incoming.answer);

  if (!existingHasAnswer && incomingHasAnswer) return true;
  if (existingHasAnswer && !incomingHasAnswer) return false;

  return qualityScore(incoming) > qualityScore(existing);
}

async function buildMasterIndex() {
  await ensureDir(OUTPUT_DIR);

  console.log("🔍 Scanning for PYQ JSONs in:", PYQ_V2_DIR);

  const files = await findJsonFiles(PYQ_V2_DIR);
  console.log(`   Found ${files.length} candidate files.`);

  const masterIndex = {};
  const fpToId = new Map();

  let totalRead = 0;
  let inserted = 0;
  let replaced = 0;
  let skippedDuplicate = 0;
  let autoIds = 0;

  const fileStats = [];

  for (const fileObj of files) {
    const normalizedPath = fileObj.path.replace(/\\/g, "/");
    const isCsatFile = normalizedPath.includes("/csat/");

    let parsed;
    try {
      parsed = JSON.parse(await fs.readFile(fileObj.path, "utf-8"));
    } catch (e) {
      console.error(`❌ JSON error in ${fileObj.name}:`, e.message);
      continue;
    }

    const { questions, meta } = extractFromPayload(parsed);
    if (!questions.length) continue;

    let fileRead = 0;
    let fileWithAnswer = 0;

    for (const q of questions) {
      if (!q || typeof q !== "object") continue;

      totalRead++;
      fileRead++;

      const rawId = q.id || q.questionId || undefined;
      const rawNodeId = q.syllabusNodeId || q.nodeId || q.topicId || null;

      const derivedNodeId = rawNodeId
        ? normalizePyqNodeId(rawNodeId)
        : isCsatFile
          ? deriveCsatNodeId(q.module, meta.module)
          : deriveNodeIdFromIdPrefix(rawId) || null;

      const normalizedAnswer = getNormalizedAnswer(q);
      if (normalizedAnswer) fileWithAnswer++;

      const enriched = {
        ...q,
        stage: q.stage || "Prelims",
        paper: q.paper || (isCsatFile ? "CSAT" : "GS"),
        syllabusNodeId: derivedNodeId,
        nodeId: derivedNodeId || q.nodeId || q.topicId || null,
        id: rawId,
        answer: normalizedAnswer,
        answerMeta:
          q.answer && typeof q.answer === "object"
            ? q.answer
            : q.answerMeta || null,
      };

      let normalized = normalizePyqRecord(enriched, fileObj);

      normalized.answer = normalizedAnswer;
      if (enriched.answerMeta) normalized.answerMeta = enriched.answerMeta;

      if (!rawId) autoIds++;

      const refinement = refinePyqNodeId(normalized);

      if (
        refinement.confidence > 0 &&
        refinement.nodeId !== normalized.syllabusNodeId
      ) {
        normalized.mappingAudit = {
          ...(normalized.mappingAudit || {}),
          intelligentMapper: {
            applied: true,
            fromNodeId: normalized.syllabusNodeId,
            toNodeId: refinement.nodeId,
            confidence: refinement.confidence,
            reason: refinement.reason,
            matchedKeywords: refinement.matchedKeywords,
          },
        };

        normalized.syllabusNodeId = refinement.nodeId;
        normalized.nodeId = refinement.nodeId;
      }

      const fp = textFingerprint(normalized);
      const id = normalized.id;

      const existingById = masterIndex[id];
      const existingIdByFp = fp ? fpToId.get(fp) : null;
      const existingByFp = existingIdByFp ? masterIndex[existingIdByFp] : null;

      const existing = existingById || existingByFp;

      if (!existing) {
        masterIndex[id] = normalized;
        if (fp) fpToId.set(fp, id);
        inserted++;
        continue;
      }

      if (shouldReplace(existing, normalized)) {
        const oldId = existing.id;

        if (oldId && oldId !== id) {
          delete masterIndex[oldId];
        }

        masterIndex[id] = normalized;
        if (fp) fpToId.set(fp, id);

        replaced++;
      } else {
        skippedDuplicate++;
      }
    }

    fileStats.push({
      file: path.relative(DATA_DIR, fileObj.path),
      total: fileRead,
      withAnswer: fileWithAnswer,
    });
  }

  const all = Object.values(masterIndex);
  const answersFound = all.filter(q => normalizeAnswer(q.answer)).length;
  const answersMissing = all.length - answersFound;
  const csatQuestions = all.filter(q =>
    String(q.paper || q.stage || "").toUpperCase().includes("CSAT")
  ).length;

  const outputPath = path.join(OUTPUT_DIR, "pyq_master_index.json");
  const statsPath = path.join(OUTPUT_DIR, "pyq_master_index_build_stats.json");

  await fs.writeFile(outputPath, JSON.stringify(masterIndex, null, 2), "utf-8");

  await fs.writeFile(
    statsPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalFiles: files.length,
        totalRead,
        totalIndexed: all.length,
        inserted,
        replaced,
        skippedDuplicate,
        autoIds,
        csatQuestions,
        answersFound,
        answersMissing,
        fileStats,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("\n✅ Master Index Built!");
  console.log(`[PYQ BUILD] Total raw questions read: ${totalRead}`);
  console.log(`[PYQ BUILD] Total Questions Indexed: ${all.length}`);
  console.log(`[PYQ BUILD] Total CSAT: ${csatQuestions}`);
  console.log(`[PYQ BUILD] Answers Found: ${answersFound}`);
  console.log(`[PYQ BUILD] Answers Missing: ${answersMissing}`);
  console.log(`[PYQ BUILD] Inserted: ${inserted}`);
  console.log(`[PYQ BUILD] Replaced better duplicate: ${replaced}`);
  console.log(`[PYQ BUILD] Skipped weaker duplicate: ${skippedDuplicate}`);
  console.log(`[PYQ BUILD] Auto-assigned IDs: ${autoIds}`);
  console.log(`[PYQ BUILD] Stats saved: ${statsPath}`);
}

buildMasterIndex().catch(e => {
  console.error("Fatal error during buildMasterIndex:", e);
  process.exit(1);
});