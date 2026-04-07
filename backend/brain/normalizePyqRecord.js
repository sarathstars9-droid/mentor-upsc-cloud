export function normalizePyqRecord(raw, fileMeta) {
  const filename = typeof fileMeta === 'object' ? (fileMeta.name || "").toLowerCase() : String(fileMeta || "").toLowerCase();
  
  // Extract question text
  const question = raw.question || raw.questionText || raw.topic || "";
  
  // Predict Stage
  let stage = String(raw.stage || "").toLowerCase();
  const rawPaper = String(raw.paper || "").toLowerCase();
  const nodeId = String(raw.syllabusNodeId || raw.nodeId || "");
  const qId = String(raw.id || "").toUpperCase();

  // Priority 1: nodeId prefix or ID prefix
  if (nodeId.startsWith("GS4") || qId.startsWith("GS4")) stage = "ethics";
  else if (nodeId.startsWith("ESSAY") || qId.startsWith("ESSAY")) stage = "essay";
  else if (nodeId.startsWith("OPT") || qId.startsWith("OPT")) stage = "optional";
  else if (nodeId.startsWith("CSAT") || qId.startsWith("CSAT")) stage = "csat";

  // Priority 2 & 3: File / Paper
  if (stage !== "ethics" && stage !== "essay" && stage !== "optional" && stage !== "csat") {
    if (filename.includes("essay") || rawPaper.includes("essay")) stage = "essay";
    else if (filename.includes("ethics") || rawPaper.includes("gs4")) stage = "ethics";
    else if (filename.includes("optional") || rawPaper.includes("optional")) stage = "optional";
    else if (filename.includes("csat") || rawPaper.includes("csat") || raw.subject?.toLowerCase() === "csat") stage = "csat";
    else if (filename.includes("prelims") || stage === "prelims") stage = "prelims";
    else stage = "mains"; // default
  }

  // Determine Type
  let type = raw.type || "";
  if (!type) {
    if (stage === "prelims" || stage === "csat") type = "MCQ";
    else if (stage === "essay") type = "ESSAY_TOPIC";
    else if (stage === "ethics") type = String(raw.section).toUpperCase() === "B" ? "CASE_STUDY" : "ETHICS_THEORY";
    else type = "DESCRIPTIVE";
  }

  return {
    id: raw.id || null,
    exam: raw.exam || "UPSC CSE",
    stage: stage,
    paper: raw.paper || rawPaper || null,
    subject: raw.subject || raw.module || null,
    optionalSubject: raw.optionalSubject || null,
    year: raw.year ? Number(raw.year) : null,
    section: raw.section || null,
    questionNumber: raw.questionNumber || null,
    subQuestion: raw.subQuestion || null,
    part: raw.part || null,
    type: type,
    directive: raw.directive || null,
    marks: raw.marks ? Number(raw.marks) : null,
    wordLimit: raw.wordLimit ? Number(raw.wordLimit) : null,
    question: question,
    options: raw.options || {},
    answer: raw.answer || null,
    keywords: raw.keywords || [],
    microthemes: Array.isArray(raw.microthemes) ? raw.microthemes : (raw.microtheme ? [raw.microtheme] : []),
    themeCategory: raw.themeCategory || null,
    sourceTopicBucket: raw.sourceTopicBucket || null,
    sourceFile: typeof fileMeta === 'object' ? fileMeta.name : fileMeta || null,
    paperNumber: raw.paperNumber || null,
    syllabusNodeId: raw.syllabusNodeId || raw.nodeId || null,
    nodeId: raw.nodeId || raw.syllabusNodeId || null,
    meta: raw.meta || {}
  };
}
