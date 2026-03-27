function band(score) {
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function numericConfidence(score) {
  if (score >= 12) return 0.95;
  if (score >= 10) return 0.9;
  if (score >= 8) return 0.8;
  if (score >= 6) return 0.68;
  if (score >= 4) return 0.55;
  return 0.3;
}

export function finalizeConfidence({ text, subject, subjectKey, scored = [], context = {}, mode = "plan" }) {
  const best = scored[0];
  if (!best) {
    return {
      matched: false,
      confidence: 0.2,
      confidenceBand: "low",
      subjectKey,
      syllabusNodeId: null,
      code: null,
      gsPaper: null,
      subjectGroup: subject || "",
      macroTheme: "",
      microTheme: "",
      mappedTopicName: text || "",
      matchedBy: ["no_scored_candidate"],
      aliasesTriggered: [],
      candidateCount: 0,
      alternativeNodeIds: [],
      reviewRequired: true,
      phaseHints: { mode },
      analyticsHints: { reason: "No candidate crossed minimum score" }
    };
  }

  const confidence = numericConfidence(best._score || 0);
  const confidenceBand = band(best._score || 0);
  const alternatives = scored.slice(1, 4).map(x => x.syllabusNodeId || x.code).filter(Boolean);

  return {
    matched: true,
    confidence,
    confidenceBand,
    subjectKey,
    syllabusNodeId: best.syllabusNodeId || best.code || null,
    code: best.code || best.syllabusNodeId || null,
    gsPaper: best.gsPaper || null,
    subjectGroup: best.subjectGroup || best.subject || "",
    macroTheme: best.macroTheme || "",
    microTheme: best.microTheme || "",
    mappedTopicName: best.mappedTopicName || best.microTheme || text,
    matchedBy: ["subject_mapper", "keyword_overlap", "phrase_boost"],
    aliasesTriggered: [],
    candidateCount: scored.length,
    alternativeNodeIds: alternatives,
    reviewRequired: confidenceBand === "low",
    phaseHints: { mode },
    analyticsHints: {
      topScore: best._score || 0,
      marginVsSecond: best._score - (scored[1]?._score || 0)
    }
  };
}
