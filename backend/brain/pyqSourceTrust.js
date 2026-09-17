import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const CSAT_CONFLICT_SOURCES = [
  "pyq_index/pyq_master_index.json",
  "pyq_questions_v2/global_master_index.json",
  "pyq_questions_v2/prelims/csat/csat_logical_reasoning_FIXED_COUNT_COMPLETE.json",
  "pyq_questions_v2/prelims/csat/csat_quantitative_aptitude_FIXED_COUNT_COMPLETE.json",
];

function extractQuestions(value, inheritedYear = null) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(item => extractQuestions(item, inheritedYear));
  const nextYear = value.year ?? inheritedYear;
  const id = value.id || value.questionId;
  const question = value.question || value.questionText || value.stem || value.topic;
  if (id && typeof question === "string") return [{ ...value, id, year: nextYear }];
  return Object.values(value).flatMap(item => extractQuestions(item, nextYear));
}

function normalizedQuestionText(question) {
  return String(question.question || question.questionText || question.stem || question.topic || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

let cached = null;

export function getCsatSourceConflictIndex() {
  if (cached) return cached;
  const variantsById = new Map();
  for (const relativeFile of CSAT_CONFLICT_SOURCES) {
    const absoluteFile = path.join(DATA_DIR, relativeFile);
    const parsed = JSON.parse(fs.readFileSync(absoluteFile, "utf8"));
    for (const question of extractQuestions(parsed)) {
      if (!/^csat_|^PRE_CSAT_/i.test(question.id)) continue;
      const variants = variantsById.get(question.id) || new Map();
      const normalizedText = normalizedQuestionText(question);
      const row = variants.get(normalizedText) || { normalizedText, sourceFiles: [] };
      row.sourceFiles.push(`backend/data/${relativeFile}`);
      variants.set(normalizedText, row);
      variantsById.set(question.id, variants);
    }
  }
  cached = new Map(
    [...variantsById]
      .filter(([, variants]) => variants.size > 1)
      .map(([id, variants]) => [id, {
        status: "unresolved-content-conflict",
        resolution: "unresolved-no-documented-authoritative-precedence",
        sourceFiles: [...new Set([...variants.values()].flatMap(row => row.sourceFiles))].sort(),
        variantCount: variants.size,
      }]),
  );
  return cached;
}

export function resetPyqSourceTrustCache() {
  cached = null;
}
