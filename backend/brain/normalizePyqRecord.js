// ── Deterministic fallback ID generator ─────────────────────────────────────
// Produces a stable ID when the raw record has none.
// Format: PRE_GS_2020_012  /  PRE_CSAT_2021_045  /  MAINS_GS1_2019_003 etc.
// Uses a short hash of the question text as a suffix to prevent collisions
// when year+questionNumber are both missing.
function _textSlug(text) {
  let h = 0;
  const s = String(text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0");
}

function generateFallbackId(raw, stageFinal, paperFinal) {
  const stagePrefix =
    stageFinal === "csat"    ? "PRE_CSAT" :
    stageFinal === "prelims" ? "PRE_GS"   :
    stageFinal === "ethics"  ? "ETH_GS4"  :
    stageFinal === "essay"   ? "ESSAY"    :
    stageFinal === "optional"? "OPT"      :
                               "MAINS_" + (paperFinal || "GS").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

  const year  = raw.year            ? String(raw.year)            : "0000";
  const qno   = raw.questionNumber  ? String(raw.questionNumber).padStart(3, "0") : "000";

  // If year AND qno are both real values, assume uniqueness within stage+year
  if (raw.year && raw.questionNumber) {
    return `${stagePrefix}_${year}_${qno}`;
  }
  // Otherwise use text hash to avoid collisions
  const slug = _textSlug(raw.question || raw.questionText || raw.topic || "");
  return `${stagePrefix}_${year}_${qno}_${slug}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function normalizePyqRecord(raw, fileMeta) {
  const filename = typeof fileMeta === "object"
    ? (fileMeta.name || "").toLowerCase()
    : String(fileMeta || "").toLowerCase();

  // Extract question text
  const question = raw.question || raw.questionText || raw.topic || "";

  // ── Stage detection ─────────────────────────────────────────────────────────
  let stage = String(raw.stage || "").toLowerCase();
  const rawPaper = String(raw.paper || "").toLowerCase();
  const nodeId   = String(raw.syllabusNodeId || raw.nodeId || "");
  const qId      = String(raw.id || "").toUpperCase();

  // Priority 1: nodeId prefix or ID prefix
  if      (nodeId.startsWith("GS4")  || qId.startsWith("GS4"))   stage = "ethics";
  else if (nodeId.startsWith("ESSAY")|| qId.startsWith("ESSAY"))  stage = "essay";
  else if (nodeId.startsWith("OPT")  || qId.startsWith("OPT"))    stage = "optional";
  else if (nodeId.startsWith("CSAT") || qId.startsWith("CSAT"))   stage = "csat";

  // Priority 2: filename / paper
  if (stage !== "ethics" && stage !== "essay" && stage !== "optional" && stage !== "csat") {
    if      (filename.includes("essay")   || rawPaper.includes("essay"))              stage = "essay";
    else if (filename.includes("ethics")  || rawPaper.includes("gs4"))                stage = "ethics";
    else if (filename.includes("optional")|| rawPaper.includes("optional"))           stage = "optional";
    else if (filename.includes("csat")    || rawPaper.includes("csat")
             || (raw.subject || "").toLowerCase() === "csat")                         stage = "csat";
    else if (filename.includes("prelims") || stage === "prelims")                     stage = "prelims";
    else                                                                              stage = "mains";
  }

  // ── Type detection ──────────────────────────────────────────────────────────
  let type = raw.type || "";
  if (!type) {
    if (stage === "prelims" || stage === "csat") type = "MCQ";
    else if (stage === "essay")  type = "ESSAY_TOPIC";
    else if (stage === "ethics") type = String(raw.section).toUpperCase() === "B" ? "CASE_STUDY" : "ETHICS_THEORY";
    else type = "DESCRIPTIVE";
  }

  // ── Fallback ID generation ──────────────────────────────────────────────────
  const finalId = raw.id || generateFallbackId(raw, stage, rawPaper || (stage === "csat" ? "CSAT" : "GS"));

  return {
    id:               finalId,
    exam:             raw.exam || "UPSC CSE",
    stage:            stage,
    paper:            raw.paper || rawPaper || null,
    subject:          raw.subject || raw.module || null,
    optionalSubject:  raw.optionalSubject || null,
    year:             raw.year ? Number(raw.year) : null,
    section:          raw.section || null,
    questionNumber:   raw.questionNumber || null,
    subQuestion:      raw.subQuestion || null,
    part:             raw.part || null,
    type:             type,
    directive:        raw.directive || null,
    marks:            raw.marks ? Number(raw.marks) : null,
    wordLimit:        raw.wordLimit ? Number(raw.wordLimit) : null,
    question:         question,
    options:          raw.options || {},
    answer:           raw.answer || null,
    keywords:         raw.keywords || [],
    microthemes:      Array.isArray(raw.microthemes)
                        ? raw.microthemes
                        : (raw.microtheme ? [raw.microtheme] : []),
    themeCategory:    raw.themeCategory || null,
    sourceTopicBucket:raw.sourceTopicBucket || null,
    sourceFile:       typeof fileMeta === "object" ? fileMeta.name : fileMeta || null,
    paperNumber:      raw.paperNumber || null,
    syllabusNodeId:   raw.syllabusNodeId || raw.nodeId || null,
    nodeId:           raw.nodeId || raw.syllabusNodeId || null,
    meta:             raw.meta || {},
  };
}
