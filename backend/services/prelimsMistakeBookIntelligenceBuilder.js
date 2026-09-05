const DIAGNOSIS_LABELS = {
  concept_gap: "Concept Gap",
  factual_recall: "Factual Recall",
  statement_trap: "Statement Trap",
  overthinking: "Overthinking",
  elimination_error: "Elimination Error",
  question_misread: "Question Misread",
  guessing_error: "Guessing Error",
  time_pressure: "Time Pressure",
  knowledge_gap: "Knowledge Gap",
  unclassified: "Unclassified",
};

const REVIEW_LABELS = {
  new: "New",
  reviewed: "Reviewed",
  retest_due: "Retest Due",
};

const MASTERY_LABELS = {
  unverified: "Needs Evidence",
  verify_again: "Verify Again",
  mastered: "Mastered",
};

const REVIEW_STATUSES = new Set(["new", "reviewed", "retest_due"]);
const DIAGNOSIS_VALUES = new Set(Object.keys(DIAGNOSIS_LABELS));

function hasVerifiedEvidence(row) {
  return row?.evidence_quality !== "legacy_uncertain";
}

function latestStreak(rows, status, predicate = () => true) {
  let count = 0;
  for (const row of rows) {
    if (row.answer_status !== status || !predicate(row)) break;
    count += 1;
  }
  return count;
}

function masteryFromRows(rows) {
  const verifiedRows = rows.filter(hasVerifiedEvidence);
  if (!verifiedRows.length) return "unverified";
  const consecutiveCorrectRetests = latestStreak(
    verifiedRows,
    "correct",
    (row) => row.is_retest === true
  );

  if (consecutiveCorrectRetests >= 2) return "mastered";
  if (consecutiveCorrectRetests === 1) return "verify_again";
  return "unverified";
}

function buildAttemptEvidence(rows = [], stats = {}) {
  const latestRows = rows.slice().sort((a, b) =>
    new Date(b.attempted_at || b.created_at) - new Date(a.attempted_at || a.created_at)
  );
  const verifiedRows = latestRows.filter(hasVerifiedEvidence);
  const failureAttempts = verifiedRows.filter((row) =>
    row.answer_status === "wrong" || row.answer_status === "unattempted"
  );
  const repeatedWrongAttempts = verifiedRows.filter((row) => row.answer_status === "wrong");
  const repeatedUnattemptedAttempts = verifiedRows.filter((row) => row.answer_status === "unattempted");
  const uncertainRows = latestRows.filter((row) => row.evidence_quality === "legacy_uncertain");
  const consecutiveCorrectRetests = latestStreak(
    verifiedRows,
    "correct",
    (row) => row.is_retest === true
  );

  return {
    totalAttempts: latestRows.length,
    recordedAttempts: latestRows.length,
    verifiedAttempts: verifiedRows.length,
    uncertainAttempts: uncertainRows.length,
    correctCount: verifiedRows.filter((row) => row.answer_status === "correct").length,
    wrongCount: repeatedWrongAttempts.length,
    unattemptedCount: repeatedUnattemptedAttempts.length,
    failureCount: failureAttempts.length,
    retestCount: verifiedRows.filter((row) => row.is_retest).length,
    firstAttemptedAt: stats?.first_attempted_at || latestRows[latestRows.length - 1]?.attempted_at || null,
    latestAttemptedAt: stats?.latest_attempted_at || latestRows[0]?.attempted_at || null,
    latestStatus: verifiedRows[0]?.answer_status || null,
    consecutiveCorrectRetests,
    latestCorrectStreak: latestStreak(verifiedRows, "correct"),
    latestWrongStreak: latestStreak(verifiedRows, "wrong"),
    repeatedWrongCount: repeatedWrongAttempts.length,
    repeatedUnattemptedCount: repeatedUnattemptedAttempts.length,
    repeatedErrorCount: failureAttempts.length,
    isRepeatedError: failureAttempts.length >= 2,
    masteryStatus: masteryFromRows(latestRows),
    historyComplete: latestRows.length > 0 && latestRows.every((row) => row.history_complete === true),
    repeatedErrorEvidence: repeatedWrongAttempts.slice(0, 5).map((row) => ({
      id: row.id,
      attemptId: row.attempt_id,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      selectedAnswer: row.selected_answer,
      correctAnswer: row.correct_answer,
      attemptedAt: row.attempted_at,
      isRetest: row.is_retest,
      evidenceQuality: row.evidence_quality,
    })),
  };
}

function normalizeReviewStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return REVIEW_STATUSES.has(status) ? status : "new";
}

function normalizeDiagnosis(value) {
  const diagnosis = String(value || "").trim().toLowerCase();
  return DIAGNOSIS_VALUES.has(diagnosis) ? diagnosis : "unclassified";
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function byOldestOutstandingThenEvidence(a, b) {
  if (a.priorityGroup !== b.priorityGroup) return a.priorityGroup - b.priorityGroup;

  const aOutstanding = new Date(a.outstandingAt || 0).getTime();
  const bOutstanding = new Date(b.outstandingAt || 0).getTime();
  if (aOutstanding !== bOutstanding) return aOutstanding - bOutstanding;

  const aFailures = a.evidence?.failureCount || 0;
  const bFailures = b.evidence?.failureCount || 0;
  if (aFailures !== bFailures) return bFailures - aFailures;

  const aLatest = new Date(a.evidence?.latestAttemptedAt || a.updatedAt || 0).getTime();
  const bLatest = new Date(b.evidence?.latestAttemptedAt || b.updatedAt || 0).getTime();
  if (aLatest !== bLatest) return bLatest - aLatest;

  return String(a.id).localeCompare(String(b.id));
}

function getPriorityGroup(mistake, evidence) {
  const reviewStatus = mistake.reviewStatus;
  if (evidence.masteryStatus === "mastered") return 99;
  if (evidence.isRepeatedError && reviewStatus === "retest_due") return 1;
  if (evidence.masteryStatus === "verify_again") return 2;
  if (reviewStatus === "retest_due") return 3;
  if (evidence.isRepeatedError && reviewStatus === "new") return 4;
  if (reviewStatus === "new") return 5;
  if (reviewStatus === "reviewed") return 6;
  return 7;
}

function getPriorityLabel(priorityGroup) {
  if (priorityGroup === 1) return "Repeated Error + Retest Due";
  if (priorityGroup === 2) return "Verify Again";
  if (priorityGroup === 3) return "Retest Due";
  if (priorityGroup === 4) return "Repeated Error";
  if (priorityGroup === 5) return "New";
  if (priorityGroup === 6) return "Reviewed";
  return "Watch";
}

function estimateMinutes(summary) {
  if (summary.evidence.masteryStatus === "verify_again") return 2;
  if (summary.evidence.isRepeatedError) return 4;
  return 3;
}

function groupAttemptsByQuestion(attempts = []) {
  const map = new Map();
  attempts.forEach((attempt) => {
    const key = String(attempt.question_id || "");
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(attempt);
  });
  return map;
}

function summarizeMistake(mistake, attemptsByQuestion) {
  const questionId = mistake.question_id || mistake.questionId || mistake.id;
  const attempts = attemptsByQuestion.get(String(questionId)) || [];
  const evidence = buildAttemptEvidence(attempts);
  const reviewStatus = normalizeReviewStatus(mistake.review_status || mistake.reviewStatus);
  const diagnosis = normalizeDiagnosis(mistake.error_type || mistake.errorType);
  const createdAt = toIso(mistake.created_at || mistake.createdAt);
  const updatedAt = toIso(mistake.updated_at || mistake.updatedAt);
  const reviewedAt = toIso(mistake.reviewed_at || mistake.reviewedAt);
  const base = {
    id: mistake.id,
    questionId,
    questionText: mistake.question_text || mistake.questionText || "",
    subject: mistake.subject || "",
    topic: mistake.topic || "",
    paper: mistake.paper || "GS",
    sourceType: mistake.source_type || mistake.sourceType || "unknown",
    sourceRef: mistake.source_ref || mistake.sourceRef || null,
    selectedAnswer: mistake.selected_answer || mistake.selectedAnswer || null,
    correctAnswer: mistake.correct_answer || mistake.correctAnswer || null,
    answerStatus: mistake.answer_status || mistake.answerStatus || null,
    diagnosis,
    diagnosisLabel: DIAGNOSIS_LABELS[diagnosis],
    reviewStatus,
    reviewStatusLabel: REVIEW_LABELS[reviewStatus],
    masteryStatus: evidence.masteryStatus,
    masteryLabel: MASTERY_LABELS[evidence.masteryStatus] || MASTERY_LABELS.unverified,
    createdAt,
    updatedAt,
    reviewedAt,
    outstandingAt: reviewedAt || updatedAt || createdAt,
    evidence,
  };
  const priorityGroup = getPriorityGroup(base, evidence);

  return {
    ...base,
    priorityGroup,
    priorityLabel: getPriorityLabel(priorityGroup),
    estimatedMinutes: estimateMinutes({ ...base, priorityGroup }),
  };
}

function buildPatternIntelligence(activeMistakes) {
  const diagnosisMap = new Map();
  const subjectMap = new Map();

  activeMistakes.forEach((mistake) => {
    if (mistake.diagnosis !== "unclassified") {
      const current = diagnosisMap.get(mistake.diagnosis) || {
        diagnosis: mistake.diagnosis,
        label: mistake.diagnosisLabel,
        questionCount: 0,
        repeatedCount: 0,
        verifiedFailureCount: 0,
      };
      current.questionCount += 1;
      if (mistake.evidence.isRepeatedError) current.repeatedCount += 1;
      current.verifiedFailureCount += mistake.evidence.failureCount;
      diagnosisMap.set(mistake.diagnosis, current);
    }

    const subject = mistake.subject || "Unmapped";
    const currentSubject = subjectMap.get(subject) || {
      subject,
      questionCount: 0,
      repeatedCount: 0,
      verifyAgainCount: 0,
      verifiedFailureCount: 0,
      score: 0,
    };
    currentSubject.questionCount += 1;
    if (mistake.evidence.isRepeatedError) currentSubject.repeatedCount += 1;
    if (mistake.evidence.masteryStatus === "verify_again") currentSubject.verifyAgainCount += 1;
    currentSubject.verifiedFailureCount += mistake.evidence.failureCount;
    currentSubject.score += 1 + (mistake.evidence.isRepeatedError ? 2 : 0) + (mistake.evidence.failureCount * 0.5);
    subjectMap.set(subject, currentSubject);
  });

  const diagnosisBreakdown = Array.from(diagnosisMap.values()).sort((a, b) => {
    if (b.repeatedCount !== a.repeatedCount) return b.repeatedCount - a.repeatedCount;
    if (b.verifiedFailureCount !== a.verifiedFailureCount) return b.verifiedFailureCount - a.verifiedFailureCount;
    return b.questionCount - a.questionCount;
  });

  const weakestSubjects = Array.from(subjectMap.values())
    .sort((a, b) => b.score - a.score || b.verifiedFailureCount - a.verifiedFailureCount)
    .slice(0, 5)
    .map(({ score, ...subject }) => subject);

  return {
    strongestPattern: diagnosisBreakdown[0] || {
      diagnosis: "unclassified",
      label: "Diagnosis Needed",
      questionCount: activeMistakes.length,
      repeatedCount: activeMistakes.filter((m) => m.evidence.isRepeatedError).length,
      verifiedFailureCount: activeMistakes.reduce((sum, m) => sum + m.evidence.failureCount, 0),
    },
    diagnosisBreakdown: diagnosisBreakdown.slice(0, 6),
    weakestSubjects,
  };
}

export function buildMistakeBookIntelligence({ mistakes = [], attempts = [] } = {}) {
  const prelimsMistakes = mistakes.filter((mistake) =>
    String(mistake.stage || "prelims").toLowerCase() === "prelims"
  );
  const attemptsByQuestion = groupAttemptsByQuestion(attempts);
  const summaries = prelimsMistakes.map((mistake) => summarizeMistake(mistake, attemptsByQuestion));
  const activeMistakes = summaries.filter((mistake) => mistake.evidence.masteryStatus !== "mastered");
  const masteredMistakes = summaries.filter((mistake) => mistake.evidence.masteryStatus === "mastered");
  const sortedActive = activeMistakes.slice().sort(byOldestOutstandingThenEvidence);
  const priorityMistakes = sortedActive.filter((mistake) => mistake.priorityGroup < 99).slice(0, 5);
  const minutes = priorityMistakes.reduce((sum, mistake) => sum + mistake.estimatedMinutes, 0);
  const totals = summaries.reduce((acc, mistake) => {
    acc.recordedAttempts += mistake.evidence.recordedAttempts;
    acc.verifiedAttempts += mistake.evidence.verifiedAttempts;
    acc.verifiedFailures += mistake.evidence.failureCount;
    if (mistake.evidence.isRepeatedError) acc.repeatedErrors += 1;
    if (mistake.evidence.masteryStatus === "verify_again") acc.verifyAgain += 1;
    if (mistake.reviewStatus === "retest_due" && mistake.evidence.masteryStatus !== "mastered") acc.retestDue += 1;
    if (mistake.reviewStatus === "new" && mistake.evidence.masteryStatus !== "mastered") acc.newMistakes += 1;
    return acc;
  }, {
    mistakes: summaries.length,
    activeMistakes: activeMistakes.length,
    mastered: masteredMistakes.length,
    repeatedErrors: 0,
    verifyAgain: 0,
    retestDue: 0,
    newMistakes: 0,
    recordedAttempts: 0,
    verifiedAttempts: 0,
    verifiedFailures: 0,
  });

  const patternIntelligence = buildPatternIntelligence(activeMistakes);
  const verdict = totals.mistakes === 0
    ? {
        status: "clear",
        headline: "Mistake Book Clear",
        detail: "Attempt Prelims questions and the Mistake Book will build a repair queue.",
      }
    : totals.verifiedAttempts === 0
      ? {
          status: "building",
          headline: "Building Mistake Pattern",
          detail: "Mistake rows exist, but verified attempt history is limited. Treat the queue as a starting point.",
        }
      : {
          status: "ready",
          headline: totals.repeatedErrors > 0
            ? `${totals.repeatedErrors} repeated error${totals.repeatedErrors === 1 ? "" : "s"} need attention`
            : "Your Prelims repair queue is current",
          detail: `${totals.activeMistakes} active mistake${totals.activeMistakes === 1 ? "" : "s"} with ${totals.verifiedAttempts} verified attempt${totals.verifiedAttempts === 1 ? "" : "s"}.`,
        };

  const today = {
    mistakes: priorityMistakes,
    estimatedMinutes: minutes,
    empty: priorityMistakes.length === 0,
  };

  return {
    stage: "prelims",
    generatedAt: new Date().toISOString(),
    verdict,
    totals,
    today,
    todaysFix: today,
    priorityMistakes,
    priorityQueue: sortedActive,
    patternIntelligence,
    masteryProgress: {
      mastered: totals.mastered,
      verifyAgain: totals.verifyAgain,
      active: totals.activeMistakes,
      recordedAttempts: totals.recordedAttempts,
      verifiedAttempts: totals.verifiedAttempts,
    },
    mistakes: summaries,
  };
}
