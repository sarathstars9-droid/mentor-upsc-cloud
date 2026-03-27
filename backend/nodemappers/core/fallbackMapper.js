export function fallbackMapper({ text = "", subject = "", context = {}, mode = "plan" }) {
  return {
    matched: false,
    confidence: 0.2,
    confidenceBand: "low",
    subjectKey: null,
    syllabusNodeId: null,
    code: null,
    gsPaper: null,
    subjectGroup: subject || "",
    macroTheme: "",
    microTheme: "",
    mappedTopicName: text || "",
    matchedBy: ["fallback"],
    aliasesTriggered: [],
    candidateCount: 0,
    alternativeNodeIds: [],
    reviewRequired: true,
    phaseHints: { mode },
    analyticsHints: {
      reason: "No confident syllabus node match found"
    }
  };
}
