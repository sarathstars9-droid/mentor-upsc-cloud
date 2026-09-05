import assert from "node:assert/strict";
import test from "node:test";
import { buildMistakeBookIntelligence } from "../services/prelimsMistakeBookIntelligenceBuilder.js";

const baseDate = "2026-01-01T00:00:00.000Z";

function mistake(overrides) {
  return {
    id: overrides.id,
    user_id: "user_1",
    stage: "prelims",
    question_id: overrides.question_id || overrides.id,
    question_text: overrides.question_text || `Question ${overrides.id}`,
    subject: overrides.subject || "Polity",
    topic: overrides.topic || "Federalism",
    paper: "GS",
    source_type: overrides.source_type || "pyq",
    source_ref: overrides.source_ref || "fixture",
    selected_answer: "A",
    correct_answer: "B",
    answer_status: "wrong",
    error_type: overrides.error_type || "concept_gap",
    review_status: overrides.review_status || "new",
    created_at: overrides.created_at || baseDate,
    updated_at: overrides.updated_at || overrides.created_at || baseDate,
    reviewed_at: overrides.reviewed_at || null,
  };
}

function attempt(questionId, overrides = {}) {
  return {
    id: overrides.id || `${questionId}-${overrides.attempt_id || "a"}`,
    user_id: "user_1",
    attempt_id: overrides.attempt_id || `${questionId}:attempt`,
    question_id: questionId,
    selected_answer: overrides.selected_answer || "A",
    correct_answer: "B",
    answer_status: overrides.answer_status || "wrong",
    source_type: overrides.source_type || "pyq",
    source_ref: overrides.source_ref || "fixture",
    evidence_quality: overrides.evidence_quality || "verified",
    history_complete: overrides.history_complete ?? true,
    is_retest: overrides.is_retest ?? false,
    attempted_at: overrides.attempted_at || baseDate,
    created_at: overrides.attempted_at || baseDate,
  };
}

test("Phase 4 ranks Today’s Fix by repeated retest due, verify again, retest due, repeated new, new, reviewed", () => {
  const result = buildMistakeBookIntelligence({
    mistakes: [
      mistake({ id: "reviewed", question_id: "q_reviewed", review_status: "reviewed", created_at: "2026-01-06T00:00:00Z" }),
      mistake({ id: "new", question_id: "q_new", review_status: "new", created_at: "2026-01-05T00:00:00Z" }),
      mistake({ id: "repeat-new", question_id: "q_repeat_new", review_status: "new", created_at: "2026-01-04T00:00:00Z" }),
      mistake({ id: "retest", question_id: "q_retest", review_status: "retest_due", created_at: "2026-01-03T00:00:00Z" }),
      mistake({ id: "verify", question_id: "q_verify", review_status: "reviewed", created_at: "2026-01-02T00:00:00Z" }),
      mistake({ id: "repeat-retest", question_id: "q_repeat_retest", review_status: "retest_due", created_at: "2026-01-01T00:00:00Z" }),
    ],
    attempts: [
      attempt("q_repeat_retest", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
      attempt("q_repeat_retest", { attempt_id: "2", answer_status: "wrong", attempted_at: "2026-01-02T01:00:00Z" }),
      attempt("q_verify", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
      attempt("q_verify", { attempt_id: "2", answer_status: "correct", is_retest: true, attempted_at: "2026-01-02T01:00:00Z" }),
      attempt("q_retest", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
      attempt("q_repeat_new", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
      attempt("q_repeat_new", { attempt_id: "2", answer_status: "unattempted", attempted_at: "2026-01-02T01:00:00Z" }),
      attempt("q_new", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
      attempt("q_reviewed", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
    ],
  });

  assert.deepEqual(result.todaysFix.mistakes.map((m) => m.id), [
    "repeat-retest",
    "verify",
    "retest",
    "repeat-new",
    "new",
  ]);
});

test("Phase 4 excludes mastered mistakes from the active priority queue", () => {
  const result = buildMistakeBookIntelligence({
    mistakes: [mistake({ id: "mastered", question_id: "q_mastered", review_status: "retest_due" })],
    attempts: [
      attempt("q_mastered", { attempt_id: "1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
      attempt("q_mastered", { attempt_id: "2", answer_status: "correct", is_retest: true, attempted_at: "2026-01-02T01:00:00Z" }),
      attempt("q_mastered", { attempt_id: "3", answer_status: "correct", is_retest: true, attempted_at: "2026-01-03T01:00:00Z" }),
    ],
  });

  assert.equal(result.totals.mastered, 1);
  assert.equal(result.totals.activeMistakes, 0);
  assert.equal(result.todaysFix.mistakes.length, 0);
});

test("Phase 4 treats legacy uncertain attempts as non-verified evidence", () => {
  const result = buildMistakeBookIntelligence({
    mistakes: [mistake({ id: "legacy", question_id: "q_legacy" })],
    attempts: [
      attempt("q_legacy", { attempt_id: "1", evidence_quality: "legacy_uncertain" }),
      attempt("q_legacy", { attempt_id: "2", evidence_quality: "legacy_uncertain" }),
    ],
  });

  assert.equal(result.totals.verifiedAttempts, 0);
  assert.equal(result.mistakes[0].evidence.isRepeatedError, false);
  assert.equal(result.verdict.status, "building");
});

test("Phase 4 only summarizes Prelims rows", () => {
  const result = buildMistakeBookIntelligence({
    mistakes: [
      mistake({ id: "prelims", question_id: "q_prelims" }),
      { ...mistake({ id: "mains", question_id: "q_mains" }), stage: "mains" },
    ],
    attempts: [attempt("q_prelims")],
  });

  assert.equal(result.totals.mistakes, 1);
  assert.equal(result.mistakes[0].id, "prelims");
});

test("Phase 4 uses older outstanding action before failure count inside the same priority group", () => {
  const result = buildMistakeBookIntelligence({
    mistakes: [
      mistake({ id: "older", question_id: "q_older", review_status: "retest_due", updated_at: "2026-01-01T00:00:00Z" }),
      mistake({ id: "newer", question_id: "q_newer", review_status: "retest_due", updated_at: "2026-01-05T00:00:00Z" }),
    ],
    attempts: [
      attempt("q_older", { attempt_id: "1", answer_status: "wrong" }),
      attempt("q_newer", { attempt_id: "1", answer_status: "wrong" }),
    ],
  });

  assert.deepEqual(result.todaysFix.mistakes.map((m) => m.id), ["older", "newer"]);
});

test("Phase 4 empty state returns a clean clear contract", () => {
  const result = buildMistakeBookIntelligence({ mistakes: [], attempts: [] });

  assert.equal(result.verdict.status, "clear");
  assert.equal(result.verdict.headline, "Mistake Book Clear");
  assert.equal(result.totals.mistakes, 0);
  assert.equal(result.today.mistakes.length, 0);
  assert.equal(result.priorityMistakes.length, 0);
});

test("Phase 4 insufficient evidence avoids a fake unclassified dominant pattern", () => {
  const result = buildMistakeBookIntelligence({
    mistakes: [mistake({ id: "needs-diagnosis", question_id: "q_needs_diagnosis", error_type: "unclassified" })],
    attempts: [],
  });

  assert.equal(result.verdict.status, "building");
  assert.equal(result.verdict.headline, "Building Mistake Pattern");
  assert.equal(result.patternIntelligence.strongestPattern.label, "Diagnosis Needed");
});

test("Phase 4 weak subject ranking favors repeated verified failures and excludes mastered questions", () => {
  const polityMistakes = Array.from({ length: 4 }, (_, index) =>
    mistake({ id: `polity-${index}`, question_id: `q_polity_${index}`, subject: "Polity" })
  );
  const geographyMistakes = Array.from({ length: 5 }, (_, index) =>
    mistake({ id: `geo-${index}`, question_id: `q_geo_${index}`, subject: "Geography" })
  );
  const mastered = mistake({ id: "mastered-polity", question_id: "q_mastered_polity", subject: "Polity" });
  const attempts = [
    ...polityMistakes.flatMap((m, index) => [
      attempt(m.question_id, { attempt_id: `${index}-1`, answer_status: "wrong" }),
      ...(index < 2 ? [attempt(m.question_id, { attempt_id: `${index}-2`, answer_status: "wrong" })] : []),
    ]),
    ...geographyMistakes.map((m, index) =>
      attempt(m.question_id, { attempt_id: `${index}-1`, answer_status: "wrong" })
    ),
    attempt("q_mastered_polity", { attempt_id: "m-1", answer_status: "wrong", attempted_at: "2026-01-01T01:00:00Z" }),
    attempt("q_mastered_polity", { attempt_id: "m-2", answer_status: "correct", is_retest: true, attempted_at: "2026-01-02T01:00:00Z" }),
    attempt("q_mastered_polity", { attempt_id: "m-3", answer_status: "correct", is_retest: true, attempted_at: "2026-01-03T01:00:00Z" }),
  ];

  const result = buildMistakeBookIntelligence({
    mistakes: [...polityMistakes, ...geographyMistakes, mastered],
    attempts,
  });

  assert.equal(result.patternIntelligence.weakestSubjects[0].subject, "Polity");
  assert.equal(result.patternIntelligence.weakestSubjects[0].questionCount, 4);
  assert.equal(result.totals.mastered, 1);
});
