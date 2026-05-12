const WEAKNESS_MAP = {
  "Lack of Structure": {
    recommendation: "Practice structured answer frameworks like intro-body-conclusion.",
    recommendedExercise: "Write 5 introductions and conclusions for GS2 governance PYQs.",
    focusArea: "Answer Structure"
  },
  "Weak Conclusion": {
    recommendation: "Improve summarization and way-forward writing.",
    recommendedExercise: "Write conclusions only for 10 PYQs.",
    focusArea: "Answer Structure"
  },
  "Descriptive Only": {
    recommendation: "Improve analytical depth.",
    recommendedExercise: "Add stakeholder + multidimensional analysis to past descriptive answers.",
    focusArea: "Analysis & Depth"
  },
  "Lack of Examples": {
    recommendation: "Build an examples and case-studies repository.",
    recommendedExercise: "Add 2 examples per answer daily.",
    focusArea: "Content Enrichment"
  },
  "Content Deficiency": {
    recommendation: "Strengthen core subject knowledge and factual understanding.",
    recommendedExercise: "Revise core syllabus topics and attempt foundational questions.",
    focusArea: "Knowledge Base"
  },
  "Irrelevance": {
    recommendation: "Focus strictly on the core demand of the question.",
    recommendedExercise: "Practice breaking down question directives and keywords before answering.",
    focusArea: "Question Interpretation"
  },
  "Knowledge Gap": {
    recommendation: "Address missing static or current affairs knowledge.",
    recommendedExercise: "Identify the specific syllabus gap and revise it thoroughly.",
    focusArea: "Knowledge Base"
  },
  "Lack of Content": {
    recommendation: "Expand the depth and breadth of points generated.",
    recommendedExercise: "Practice brainstorming 5-6 distinct points for any topic.",
    focusArea: "Content Enrichment"
  },
  "No Attempt": {
    recommendation: "Overcome writers block by writing something, even if imperfect.",
    recommendedExercise: "Attempt writing a rough skeleton for 3 answers.",
    focusArea: "Confidence & Attempt Rate"
  }
};

const DEFAULT_RECOMMENDATION = {
  recommendation: "Review the topic fundamentals and practice related questions.",
  recommendedExercise: "Attempt 2 PYQs on this specific weakness.",
  focusArea: "General Improvement"
};

export function generateRecommendations(weaknessSummary) {
  if (!weaknessSummary || weaknessSummary.length === 0) return [];

  return weaknessSummary.map(w => {
    // Attempt exact match first, or fall back to default if not mapped
    const mapping = WEAKNESS_MAP[w.weakness] || DEFAULT_RECOMMENDATION;
    
    return {
      weakness: w.weakness,
      severity: w.severity,
      recommendation: mapping.recommendation,
      recommendedExercise: mapping.recommendedExercise,
      focusArea: mapping.focusArea
    };
  });
}
