import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { verifyToken } from "../utils/tokenUtils.js";

const router = express.Router();
const TIMEZONE = "Asia/Kolkata";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MASTER_INDEX_PATH = path.join(__dirname, "..", "data", "pyq_index", "pyq_master_index.json");

let questionMetaCache = null;

function metric(value, status, sampleSize = 0, meta = {}) {
  return {
    value,
    status,
    sampleSize,
    ...meta,
  };
}

function getSignedAuthUserId(req) {
  const authHeader = req.headers?.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  const payload = verifyToken(token);
  return payload?.sub ? String(payload.sub).toLowerCase().trim() : null;
}

function available(value, sampleSize = 1, meta = {}) {
  return metric(value, "available", sampleSize, meta);
}

function insufficient(meta = {}) {
  return metric(null, "insufficient_evidence", 0, meta);
}

function round(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getISTDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function addDays(dayKey, days) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayRange(endDayKey, days) {
  return {
    start: addDays(endDayKey, -(days - 1)),
    end: endDayKey,
  };
}

function istDateFromTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return getISTDayKey(d);
}

async function safeQuery(label, sql, params, errors) {
  try {
    const result = await query(sql, params);
    return result.rows || [];
  } catch (error) {
    errors.push({ source: label, message: error.message });
    console.error(`[performance] ${label} query failed`, error.message);
    return [];
  }
}

function loadQuestionMeta() {
  if (questionMetaCache) return questionMetaCache;
  questionMetaCache = {};

  try {
    const raw = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, "utf8"));
    const records = Array.isArray(raw) ? raw : Object.values(raw || {});
    for (const item of records) {
      if (!item || !item.id) continue;
      questionMetaCache[String(item.id)] = {
        subject: item.subject || item.paper || "",
        topic: item.topic || item.sourceTopicBucket || item.section || "",
        nodeId: item.syllabusNodeId || item.nodeId || "",
        paper: String(item.paper || "").toUpperCase() === "CSAT" ? "CSAT" : "GS",
      };
    }
  } catch (error) {
    console.warn("[performance] PYQ master metadata unavailable", error.message);
  }

  return questionMetaCache;
}

function statusLower(value) {
  return String(value || "").toLowerCase().trim();
}

function blockActualMinutes(block, logsByBlock) {
  const logMinutes = logsByBlock.get(String(block.id)) || 0;
  if (logMinutes > 0) return logMinutes;

  const stored = Number(block.actual_minutes || 0);
  if (stored > 0) return stored;

  const start = block.started_at ? new Date(block.started_at).getTime() : 0;
  const end = block.ended_at ? new Date(block.ended_at).getTime() : 0;
  if (start && end && end > start) {
    const pauseSeconds = Number(block.total_pause_seconds || 0);
    return Math.max(0, Math.round(((end - start) / 1000 - pauseSeconds) / 60));
  }

  return 0;
}

function buildLogsByBlock(logs) {
  const byBlock = new Map();
  for (const log of logs) {
    const key = String(log.block_id || "");
    if (!key) continue;
    byBlock.set(key, (byBlock.get(key) || 0) + Number(log.actual_minutes || 0));
  }
  return byBlock;
}

function summarizeBlocks(blocks, logs, startDayKey, endDayKey) {
  const logsByBlock = buildLogsByBlock(logs);
  const scoped = blocks.filter((block) => block.day_key >= startDayKey && block.day_key <= endDayKey);
  const totalBlocks = scoped.length;
  let completed = 0;
  let partial = 0;
  let missed = 0;
  let plannedMinutes = 0;
  let actualMinutes = 0;
  let deepWorkMinutes = 0;
  let interruptions = 0;

  for (const block of scoped) {
    const s = statusLower(block.status);
    const actual = blockActualMinutes(block, logsByBlock);
    plannedMinutes += Number(block.planned_minutes || 0);
    actualMinutes += actual;
    if (actual >= 90) deepWorkMinutes += actual;
    interruptions += Number(block.pauses_count || 0);

    if (["completed", "done"].includes(s)) completed++;
    else if (["partial"].includes(s)) partial++;
    else if (["missed", "skipped"].includes(s) || (s === "planned" && block.day_key < endDayKey && !block.started_at)) missed++;
  }

  return {
    totalBlocks,
    completed,
    partial,
    missed,
    plannedMinutes,
    actualMinutes,
    deepWorkMinutes,
    interruptions,
  };
}

function buildCompletionSeries(blocks, logs, todayKey, days) {
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(todayKey, -i);
    const summary = summarizeBlocks(blocks, logs, day, day);
    points.push({
      date: day,
      ...(
        summary.totalBlocks
          ? available(round((summary.completed / summary.totalBlocks) * 100, 0), summary.totalBlocks)
          : insufficient()
      ),
    });
  }
  return points;
}

function buildMinuteSeries(blocks, logs, todayKey, days, predicate = () => true) {
  const logsByBlock = buildLogsByBlock(logs);
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(todayKey, -i);
    const dayBlocks = blocks.filter((block) => block.day_key === day && predicate(block));
    const minutes = dayBlocks.reduce((sum, block) => sum + blockActualMinutes(block, logsByBlock), 0);
    points.push({
      date: day,
      ...(dayBlocks.length ? available(round(minutes, 0), dayBlocks.length, { unit: "minutes" }) : insufficient({ unit: "minutes" })),
    });
  }
  return points;
}

function normalizeScore(raw) {
  const match = String(raw || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeEvaluationScore(row) {
  const direct = Number(row?.score);
  if (Number.isFinite(direct)) return direct;

  const total = Number(row?.total_score);
  if (!Number.isFinite(total)) return null;
  const max = Number(row?.max_score);
  return Number.isFinite(max) && max > 0 ? round((total / max) * 10, 1) : total;
}

function scoreFromAvailability(parts) {
  const availableParts = parts.filter((part) => part.metric.status === "available" && Number.isFinite(Number(part.metric.value)));
  const totalWeight = availableParts.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return insufficient();
  const weighted = availableParts.reduce((sum, part) => sum + Number(part.metric.value) * part.weight, 0) / totalWeight;
  return available(round(weighted, 0), availableParts.reduce((sum, part) => sum + (part.metric.sampleSize || 0), 0), {
    availableComponents: availableParts.map((part) => part.name),
    omittedComponents: parts.filter((part) => part.metric.status !== "available").map((part) => part.name),
  });
}

function isCsatBlock(block) {
  const text = [block.paper, block.subject, block.subject_id, block.topic, block.block_type, block.mode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes("csat");
}

function buildPrelimsSummary(attempts, responses, days, todayKey, paper = null) {
  const range = dayRange(todayKey, days);
  const scopedAttempts = attempts.filter((attempt) => {
    const day = istDateFromTimestamp(attempt.submitted_at || attempt.updated_at || attempt.created_at);
    const paperOk = paper ? String(attempt.paper || "").toUpperCase() === paper : true;
    return paperOk && day >= range.start && day <= range.end;
  });
  const attemptIds = new Set(scopedAttempts.map((attempt) => String(attempt.id)));
  const scopedResponses = responses.filter((response) => {
    const skipped = response.is_skipped === true;
    return attemptIds.has(String(response.attempt_id)) && !skipped && response.is_correct !== null;
  });
  const attempted = scopedResponses.length;
  const correct = scopedResponses.filter((response) => response.is_correct === true).length;
  const wrong = scopedResponses.filter((response) => response.is_correct === false).length;
  const accuracy = attempted ? round((correct / attempted) * 100, 1) : null;

  return { scopedAttempts, scopedResponses, attempted, correct, wrong, accuracy };
}

function buildAccuracySeries(attempts, responses, todayKey, days, paper = null) {
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(todayKey, -i);
    const dayAttempts = attempts.filter((attempt) => {
      const attemptDay = istDateFromTimestamp(attempt.submitted_at || attempt.updated_at || attempt.created_at);
      const paperOk = paper ? String(attempt.paper || "").toUpperCase() === paper : true;
      return attemptDay === day && paperOk;
    });
    const attemptIds = new Set(dayAttempts.map((attempt) => String(attempt.id)));
    const dayResponses = responses.filter((response) => (
      attemptIds.has(String(response.attempt_id)) &&
      response.is_skipped !== true &&
      response.is_correct !== null
    ));
    const correct = dayResponses.filter((response) => response.is_correct === true).length;
    points.push({
      date: day,
      ...(dayResponses.length ? available(round((correct / dayResponses.length) * 100, 1), dayResponses.length) : insufficient()),
    });
  }
  return points;
}

function buildTopicPerformance(responses, attempts) {
  const meta = loadQuestionMeta();
  const attemptsById = new Map(attempts.map((attempt) => [String(attempt.id), attempt]));
  const groups = new Map();

  for (const response of responses) {
    if (response.is_skipped === true || response.is_correct === null) continue;
    const attempt = attemptsById.get(String(response.attempt_id));
    const q = meta[String(response.question_id)] || {};
    const nodeId = q.nodeId || attempt?.node_id || response.question_id;
    const topicName = q.topic || nodeId || "Unknown topic";
    const subject = q.subject || attempt?.paper || "";
    const key = nodeId || topicName;
    if (!groups.has(key)) {
      groups.set(key, { id: key, topicName, subject, attempted: 0, correct: 0, wrong: 0 });
    }
    const group = groups.get(key);
    group.attempted++;
    if (response.is_correct === true) group.correct++;
    else group.wrong++;
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      accuracy: available(round((group.correct / group.attempted) * 100, 1), group.attempted),
      trend: insufficient({ reason: "needs chronological topic history" }),
      status: group.attempted < 3
        ? "insufficient_evidence"
        : group.correct / group.attempted >= 0.75
          ? "strong"
          : group.correct / group.attempted >= 0.6
            ? "stable"
            : group.correct / group.attempted >= 0.45
              ? "warning"
              : "critical",
    }))
    .sort((a, b) => Number(a.accuracy.value) - Number(b.accuracy.value))
    .slice(0, 12);
}

function buildSubjectPerformance(topicRows) {
  const groups = new Map();
  for (const topic of topicRows) {
    const key = topic.subject || "Unknown";
    if (!groups.has(key)) groups.set(key, { id: key.toLowerCase().replace(/\s+/g, "_"), name: key, attempted: 0, correct: 0 });
    const group = groups.get(key);
    group.attempted += topic.attempted;
    group.correct += topic.correct;
  }
  return [...groups.values()].map((group) => ({
    ...group,
    score: available(round((group.correct / group.attempted) * 100, 1), group.attempted),
    accuracy: available(round((group.correct / group.attempted) * 100, 1), group.attempted),
    trend: insufficient({ reason: "needs chronological subject history" }),
  }));
}

router.get("/", requireAuth, async (req, res) => {
  const userId = getSignedAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, message: "Unauthorized: signed user token required." });
  }

  const todayKey = getISTDayKey();
  const sevenDay = dayRange(todayKey, 7);
  const thirtyDay = dayRange(todayKey, 30);
  const errors = [];

  const blocks = await safeQuery(
    "study_blocks",
    `SELECT * FROM public.study_blocks
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3`,
    [userId, thirtyDay.start, todayKey],
    errors
  );

  const blockIds = blocks.map((block) => block.id).filter(Boolean);
  const logs = blockIds.length
    ? await safeQuery("block_logs", `SELECT * FROM public.block_logs WHERE block_id = ANY($1::uuid[]) AND user_id = $2`, [blockIds, userId], errors)
    : [];

  const studyEvents = blockIds.length
    ? await safeQuery("study_events", `SELECT * FROM public.study_events WHERE block_id = ANY($1::uuid[]) AND user_id = $2`, [blockIds, userId], errors)
    : [];

  const attempts = await safeQuery(
    "prelims_test_attempts",
    `SELECT * FROM public.prelims_test_attempts
     WHERE user_id = $1 AND status = 'submitted'
       AND ((submitted_at AT TIME ZONE '${TIMEZONE}')::date::text >= $2
         OR (updated_at AT TIME ZONE '${TIMEZONE}')::date::text >= $2
         OR (created_at AT TIME ZONE '${TIMEZONE}')::date::text >= $2)`,
    [userId, thirtyDay.start],
    errors
  );

  const attemptIds = attempts.map((attempt) => attempt.id).filter(Boolean);
  const responses = attemptIds.length
    ? await safeQuery(
      "prelims_test_responses",
      `SELECT * FROM public.prelims_test_responses WHERE attempt_id = ANY($1::uuid[]) AND user_id = $2`,
      [attemptIds, userId],
      errors
    )
    : [];

  const revisionRows = await safeQuery(
    "revision_items",
    `SELECT * FROM public.revision_items WHERE user_id = $1`,
    [userId],
    errors
  );

  const mistakeRows = await safeQuery(
    "mistakes",
    `SELECT * FROM public.mistakes WHERE user_id = $1`,
    [userId],
    errors
  );

  const mainsAttempts = await safeQuery(
    "mains_answer_attempts",
    `SELECT * FROM public.mains_answer_attempts
     WHERE user_id = $1 AND status != 'draft'
       AND (updated_at AT TIME ZONE '${TIMEZONE}')::date::text >= $2`,
    [userId, thirtyDay.start],
    errors
  );

  const mainsEvaluations = await safeQuery(
    "mains_answer_evaluations",
    `SELECT * FROM public.mains_answer_evaluations
     WHERE user_id = $1
       AND (created_at AT TIME ZONE '${TIMEZONE}')::date::text >= $2`,
    [userId, thirtyDay.start],
    errors
  );

  const consistencyRows = await safeQuery(
    "daily_consistency",
    `SELECT * FROM public.daily_consistency
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3
     ORDER BY day_key DESC`,
    [userId, thirtyDay.start, todayKey],
    errors
  );

  const todayBlocks = summarizeBlocks(blocks, logs, todayKey, todayKey);
  const sevenBlocks = summarizeBlocks(blocks, logs, sevenDay.start, todayKey);
  const thirtyBlocks = summarizeBlocks(blocks, logs, thirtyDay.start, todayKey);

  const executionCompletionRate = sevenBlocks.totalBlocks
    ? available(round((sevenBlocks.completed / sevenBlocks.totalBlocks) * 100, 0), sevenBlocks.totalBlocks)
    : insufficient({ reason: "no study blocks in the 7-day IST window" });

  const hoursAdherence = sevenBlocks.plannedMinutes > 0
    ? available(round(clamp((sevenBlocks.actualMinutes / sevenBlocks.plannedMinutes) * 100, 0, 120), 0), sevenBlocks.totalBlocks)
    : insufficient({ reason: "no planned study minutes in the 7-day IST window" });

  const deepWorkBlocks = blocks.filter((block) => block.day_key >= sevenDay.start && block.day_key <= todayKey && blockActualMinutes(block, buildLogsByBlock(logs)) >= 90);
  const interruptionEvents = studyEvents.filter((event) => String(event.event_type || "").toLowerCase().includes("interruption"));
  const interruptionCount = sevenBlocks.interruptions + interruptionEvents.length;

  let streak = 0;
  if (consistencyRows.length) {
    const consistencyByDay = new Map(consistencyRows.map((row) => [row.day_key, row]));
    for (let day = todayKey; ; day = addDays(day, -1)) {
      const row = consistencyByDay.get(day);
      if (!row) break;
      const score = Number(row.score || 0);
      if (score <= 0 && !["strong", "partial"].includes(statusLower(row.status))) break;
      streak++;
    }
  } else {
    const logsByBlock = buildLogsByBlock(logs);
    for (let day = todayKey; ; day = addDays(day, -1)) {
      const hasActivity = blocks.some((block) => block.day_key === day && blockActualMinutes(block, logsByBlock) > 0);
      if (!hasActivity) break;
      streak++;
    }
  }

  const prelims30 = buildPrelimsSummary(attempts, responses, 30, todayKey);
  const prelims7 = buildPrelimsSummary(attempts, responses, 7, todayKey);
  const csat7 = buildPrelimsSummary(attempts, responses, 7, todayKey, "CSAT");
  const topicPerformance = buildTopicPerformance(prelims30.scopedResponses, attempts);
  const subjectPerformance = buildSubjectPerformance(topicPerformance);

  const gsWrong = prelims30.scopedAttempts
    .filter((attempt) => String(attempt.paper || "").toUpperCase() === "GS")
    .reduce((sum, attempt) => sum + Number(attempt.wrong_count || 0), 0);
  const csatWrong = prelims30.scopedAttempts
    .filter((attempt) => String(attempt.paper || "").toUpperCase() === "CSAT")
    .reduce((sum, attempt) => sum + Number(attempt.wrong_count || 0), 0);
  const negativeMarksLost = prelims30.scopedAttempts.length
    ? available(round(gsWrong * 0.66 + csatWrong * 0.83, 2), prelims30.scopedAttempts.length, { unit: "marks" })
    : insufficient({ reason: "no submitted Prelims attempts in the 30-day IST window", unit: "marks" });

  const dueDate = (row) => istDateFromTimestamp(row.next_review_at || row.due_date);
  const completedDate = (row) => istDateFromTimestamp(row.completed_at || row.updated_at);
  const pendingRevision = (row) => statusLower(row.status) === "pending";
  const completedRevision = (row) => ["completed", "revised", "reviewed"].includes(statusLower(row.status));
  const dueTodayRows = revisionRows.filter((row) => pendingRevision(row) && dueDate(row) === todayKey);
  const overdueRows = revisionRows.filter((row) => pendingRevision(row) && dueDate(row) && dueDate(row) < todayKey);
  const completedTodayRows = revisionRows.filter((row) => completedRevision(row) && completedDate(row) === todayKey);
  const dueSevenRows = revisionRows.filter((row) => {
    const d = dueDate(row);
    return d && d >= sevenDay.start && d <= todayKey;
  });
  const completedSevenRows = dueSevenRows.filter((row) => completedRevision(row));

  const revisionSuccessRate = dueSevenRows.length
    ? available(round((completedSevenRows.length / dueSevenRows.length) * 100, 0), dueSevenRows.length)
    : insufficient({ reason: "no revision items due in the 7-day IST window" });

  const csatBlocks7 = blocks.filter((block) => block.day_key >= sevenDay.start && block.day_key <= todayKey && isCsatBlock(block));
  const csatTodayBlocks = csatBlocks7.filter((block) => block.day_key === todayKey);
  const csatMinutesSeries = buildMinuteSeries(blocks, logs, todayKey, 7, isCsatBlock);
  const csatActivityDays = new Set([
    ...csatBlocks7.filter((block) => blockActualMinutes(block, buildLogsByBlock(logs)) > 0 || Number(block.planned_minutes || 0) > 0).map((block) => block.day_key),
    ...csat7.scopedAttempts.map((attempt) => istDateFromTimestamp(attempt.submitted_at || attempt.updated_at || attempt.created_at)),
  ].filter(Boolean));
  const anyCsatEvidence = csatBlocks7.length > 0 || csat7.scopedAttempts.length > 0;
  const last2Start = addDays(todayKey, -1);
  const last2Touched = anyCsatEvidence
    ? available([...csatActivityDays].some((day) => day >= last2Start && day <= todayKey), csatActivityDays.size)
    : insufficient({ reason: "no CSAT practice evidence in the 7-day IST window" });

  const mainsScores = [
    ...mainsAttempts.map((row) => normalizeScore(row.current_score)),
    ...mainsEvaluations.map((row) => normalizeEvaluationScore(row)),
  ].filter(Number.isFinite);

  const openMistakes = mistakeRows.filter((row) => statusLower(row.status || "open") === "open");
  const resolvedMistakes = mistakeRows.filter((row) => ["resolved", "closed"].includes(statusLower(row.status)));
  const mistakes30 = mistakeRows.filter((row) => {
    const d = istDateFromTimestamp(row.created_at);
    return d >= thirtyDay.start && d <= todayKey;
  });

  const executionScore = scoreFromAvailability([
    { name: "completion", weight: 0.6, metric: executionCompletionRate },
    { name: "hours_adherence", weight: 0.4, metric: hoursAdherence },
  ]);
  const academicScore = prelims30.attempted
    ? available(prelims30.accuracy, prelims30.attempted)
    : insufficient({ reason: "no submitted Prelims responses in the 30-day IST window" });
  const revisionScore = revisionSuccessRate;
  const consistencyScore = streak || consistencyRows.length
    ? available(round(clamp(streak * 12.5, 0, 100), 0), Math.max(streak, consistencyRows.length))
    : insufficient({ reason: "no daily consistency or study activity streak evidence" });
  const performanceScore = scoreFromAvailability([
    { name: "execution", weight: 0.35, metric: executionScore },
    { name: "academic", weight: 0.35, metric: academicScore },
    { name: "revision", weight: 0.2, metric: revisionScore },
    { name: "consistency", weight: 0.1, metric: consistencyScore },
  ]);

  return res.json({
    ok: true,
    evidence: {
      asOf: new Date().toISOString(),
      timezone: TIMEZONE,
      today: todayKey,
      windows: { sevenDay, thirtyDay },
      userScoped: true,
      userId,
      database: errors.length ? { status: "partial", errors } : { status: "available" },
      sources: {
        studyBlocks: blocks.length,
        blockLogs: logs.length,
        studyEvents: studyEvents.length,
        prelimsAttempts: attempts.length,
        prelimsResponses: responses.length,
        revisionItems: revisionRows.length,
        mistakes: mistakeRows.length,
        mainsAttempts: mainsAttempts.length,
        mainsEvaluations: mainsEvaluations.length,
        dailyConsistency: consistencyRows.length,
      },
    },
    execution: {
      plannedHoursToday: todayBlocks.totalBlocks ? available(round(todayBlocks.plannedMinutes / 60, 1), todayBlocks.totalBlocks, { unit: "hours" }) : insufficient({ unit: "hours" }),
      actualHoursToday: todayBlocks.totalBlocks ? available(round(todayBlocks.actualMinutes / 60, 1), todayBlocks.totalBlocks, { unit: "hours" }) : insufficient({ unit: "hours" }),
      plannedHours7d: sevenBlocks.totalBlocks ? available(round(sevenBlocks.plannedMinutes / 60, 1), sevenBlocks.totalBlocks, { unit: "hours" }) : insufficient({ unit: "hours" }),
      actualHours7d: sevenBlocks.totalBlocks ? available(round(sevenBlocks.actualMinutes / 60, 1), sevenBlocks.totalBlocks, { unit: "hours" }) : insufficient({ unit: "hours" }),
      completionRate: executionCompletionRate,
      hoursAdherence,
      completedBlocks: sevenBlocks.totalBlocks ? available(sevenBlocks.completed, sevenBlocks.totalBlocks) : insufficient(),
      partialBlocks: sevenBlocks.totalBlocks ? available(sevenBlocks.partial, sevenBlocks.totalBlocks) : insufficient(),
      missedBlocks: sevenBlocks.totalBlocks ? available(sevenBlocks.missed, sevenBlocks.totalBlocks) : insufficient(),
      deepWorkHours: deepWorkBlocks.length ? available(round(sevenBlocks.deepWorkMinutes / 60, 1), deepWorkBlocks.length, { unit: "hours", definition: "sum of >=90 minute focused blocks" }) : insufficient({ unit: "hours", reason: "no >=90 minute completed/logged blocks in the 7-day IST window" }),
      interruptions: sevenBlocks.totalBlocks || interruptionEvents.length ? available(interruptionCount, sevenBlocks.totalBlocks + interruptionEvents.length) : insufficient(),
      streakDays: streak || consistencyRows.length || blocks.length ? available(streak, Math.max(streak, consistencyRows.length, blocks.length ? 1 : 0), { unit: "days" }) : insufficient({ unit: "days" }),
      focusScore: insufficient({ reason: "no dedicated focus quality score source found" }),
      score: executionScore,
    },
    academic: {
      prelimsAccuracy30d: prelims30.attempted ? available(prelims30.accuracy, prelims30.attempted, { correct: prelims30.correct, wrong: prelims30.wrong }) : insufficient(),
      prelimsAccuracy7d: prelims7.attempted ? available(prelims7.accuracy, prelims7.attempted, { correct: prelims7.correct, wrong: prelims7.wrong }) : insufficient(),
      prelimsAttempts30d: prelims30.scopedAttempts.length ? available(prelims30.scopedAttempts.length, prelims30.scopedAttempts.length) : insufficient(),
      negativeMarksLost,
      subjectPerformance,
      topicPerformance,
      score: academicScore,
    },
    revision: {
      dueToday: revisionRows.length ? available(dueTodayRows.length, revisionRows.length) : insufficient(),
      overdue: revisionRows.length ? available(overdueRows.length, revisionRows.length) : insufficient(),
      completedToday: revisionRows.length ? available(completedTodayRows.length, revisionRows.length) : insufficient(),
      revisionSuccessRate,
      retentionScore: insufficient({ reason: "retention tests/recall checks are not recorded separately yet" }),
      score: revisionScore,
    },
    csat: {
      todayMinutes: csatTodayBlocks.length ? available(round(summarizeBlocks(csatTodayBlocks, logs, todayKey, todayKey).actualMinutes, 0), csatTodayBlocks.length, { unit: "minutes" }) : insufficient({ unit: "minutes" }),
      weeklyMinutes: csatBlocks7.length ? available(round(summarizeBlocks(csatBlocks7, logs, sevenDay.start, todayKey).actualMinutes, 0), csatBlocks7.length, { unit: "minutes" }) : insufficient({ unit: "minutes" }),
      practiceConsistency: anyCsatEvidence ? available(csatActivityDays.size, csatActivityDays.size, { denominator: 7, unit: "days" }) : insufficient({ denominator: 7, unit: "days" }),
      last2DayTouched: last2Touched,
      score: csat7.attempted ? available(csat7.accuracy, csat7.attempted) : insufficient(),
      weakestArea: insufficient({ reason: "CSAT topic mapping needs enough submitted CSAT responses" }),
    },
    mains: {
      answersWritten7d: mainsAttempts.filter((row) => istDateFromTimestamp(row.updated_at || row.created_at) >= sevenDay.start).length
        ? available(mainsAttempts.filter((row) => istDateFromTimestamp(row.updated_at || row.created_at) >= sevenDay.start).length, mainsAttempts.length)
        : insufficient(),
      answersWritten30d: mainsAttempts.length ? available(mainsAttempts.length, mainsAttempts.length) : insufficient(),
      averageScore: mainsScores.length ? available(round(mainsScores.reduce((sum, value) => sum + value, 0) / mainsScores.length, 1), mainsScores.length) : insufficient(),
    },
    mistakes: {
      total30d: mistakes30.length ? available(mistakes30.length, mistakes30.length) : insufficient(),
      open: mistakeRows.length ? available(openMistakes.length, mistakeRows.length) : insufficient(),
      resolved: mistakeRows.length ? available(resolvedMistakes.length, mistakeRows.length) : insufficient(),
      mustRevise: mistakeRows.length ? available(mistakeRows.filter((row) => row.must_revise === true).length, mistakeRows.length) : insufficient(),
    },
    trends: {
      sevenDay: {
        completion: buildCompletionSeries(blocks, logs, todayKey, 7),
        prelimsAccuracy: buildAccuracySeries(attempts, responses, todayKey, 7),
        revisionCompletion: Array.from({ length: 7 }, (_, index) => {
          const day = addDays(todayKey, -(6 - index));
          const due = revisionRows.filter((row) => dueDate(row) === day);
          const completed = due.filter((row) => completedRevision(row));
          return {
            date: day,
            ...(due.length ? available(round((completed.length / due.length) * 100, 0), due.length) : insufficient()),
          };
        }),
        csatMinutes: csatMinutesSeries,
      },
      thirtyDay: {
        completion: buildCompletionSeries(blocks, logs, todayKey, 30),
        prelimsAccuracy: buildAccuracySeries(attempts, responses, todayKey, 30),
      },
    },
    score: {
      execution: executionScore,
      academic: academicScore,
      revision: revisionScore,
      consistency: consistencyScore,
      overall: performanceScore,
      weights: {
        execution: 35,
        academic: 35,
        revision: 20,
        consistency: 10,
      },
    },
  });
});

export default router;
