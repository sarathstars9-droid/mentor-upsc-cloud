// backend/services/reportService.js
// Produces daily, weekly, and monthly study reports from PostgreSQL only.
// No Google Calendar, no Google Sheets, no frontend timing.
//
// ── Consistency Score formula ─────────────────────────────────────────────────
//
//   score = studyDayRatio × 0.40
//         + adherenceRatio × 0.40
//         + streakBonus    × 0.20
//   result = Math.round(score × 100)  → 0..100
//
//   studyDayRatio  = min(studyDays  / calendarDays,    1.0)
//   adherenceRatio = min(actualMin  / max(plannedMin, 1), 1.0)
//   streakBonus    = min(streak     / calendarDays,    1.0)

import {
  getDayAggregate,
  getRangeAggregate,
  getStudiedBlocks,
  getSubjectWiseSplit,
  getTopicWiseSplit,
  getStageWiseSplit,
  getSourceTypeSplit,
  getDayWiseBreakdown,
  getWeeklyBreakdown,
  getStreak,
  countStudyDays,
  getMissedBlocks,
} from '../repositories/reportRepository.js';

// Phase 8: Knowledge Linkage — lazy import to avoid crash if migration not applied
let _linkageRepoLoaded = false;
let _getKnowledgeLinkageSummary = null;

async function ensureLinkageRepo() {
  if (_linkageRepoLoaded) return;
  try {
    const mod = await import('../repositories/reportRepository.js');
    _getKnowledgeLinkageSummary = mod.getKnowledgeLinkageSummary || null;
  } catch {}
  _linkageRepoLoaded = true;
}

async function buildLinkageMetrics(userId, startKey, endKey) {
  await ensureLinkageRepo();
  if (!_getKnowledgeLinkageSummary) return null;
  try {
    const raw = await _getKnowledgeLinkageSummary(userId, startKey, endKey);
    if (!raw) return null;

    const studied   = Number(raw.studied_topics_count || 0);
    const practiced = Number(raw.practiced_topics_count || 0);
    const skipped   = Number(raw.skipped_practice_count || 0);
    const attempted = Number(raw.total_attempted || 0);
    const correct   = Number(raw.total_correct || 0);
    const wrong     = Number(raw.total_wrong || 0);

    return {
      studiedTopicsCount:     studied,
      practicedTopicsCount:   practiced,
      skippedPracticeCount:   skipped,
      revisionGeneratedCount: wrong,
      followThroughRate:      studied > 0 ? Math.round((practiced / studied) * 100) : 0,
      totalAttempted:         attempted,
      totalCorrect:           correct,
      totalWrong:             wrong,
      avgPyqAccuracy:         attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    };
  } catch (err) {
    console.error('[reportService] buildLinkageMetrics failed:', err.message);
    return null;
  }
}

const DEFAULT_USER = process.env.DEFAULT_USER_ID || 'moulika';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtSec(sec) {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function coerce(agg) {
  return {
    total_blocks:          Number(agg?.total_blocks          || 0),
    started_blocks:        Number(agg?.started_blocks        || 0),
    completed_blocks:      Number(agg?.completed_blocks      || 0),
    total_planned_minutes: Number(agg?.total_planned_minutes || 0),
    total_actual_seconds:  Number(agg?.total_actual_seconds  || 0),
    total_pause_seconds:   Number(agg?.total_pause_seconds   || 0),
    subjects_studied:      Number(agg?.subjects_studied      || 0),
  };
}

function enrichSplit(rows, totalSec) {
  const total = Math.max(totalSec, 1);
  return rows.map((r) => ({
    ...r,
    actual_seconds:         Number(r.actual_seconds  || 0),
    planned_minutes:        Number(r.planned_minutes || 0),
    block_count:            Number(r.block_count     || 0),
    completed_count:        Number(r.completed_count || 0),
    ratio:                  Math.round((Number(r.actual_seconds || 0) / total) * 1000) / 10,
    actual_minutes_display: fmtSec(r.actual_seconds),
  }));
}

function normalizeBlock(row) {
  return {
    id:             row.id,
    blockId:        row.block_id,
    dayKey:         row.day_key,
    subject:        row.subject     || 'Unknown',
    topic:          row.topic       || '',
    nodeId:         row.node_id     || '',
    stage:          row.stage       || '',
    sourceType:     row.source_type || '',
    plannedMinutes: Number(row.planned_minutes    || 0),
    actualSeconds:  Number(row.actual_seconds     || 0),
    actualMinutes:  Math.floor(Number(row.actual_seconds || 0) / 60),
    pauseSeconds:   Number(row.total_pause_seconds || 0),
    pausesCount:    Number(row.pauses_count        || 0),
    status:         row.status,
    startedAt:      row.started_at || null,
    endedAt:        row.ended_at   || null,
    display:        fmtSec(row.actual_seconds),
  };
}

function consistencyScore({ studyDays, calendarDays, actualMin, plannedMin, streak }) {
  const days  = Math.max(calendarDays, 1);
  const ratio = Math.min(studyDays  / days, 1);
  const adh   = Math.min(actualMin  / Math.max(plannedMin, 1), 1);
  const str   = Math.min(streak     / days, 1);
  return Math.round((ratio * 0.40 + adh * 0.40 + str * 0.20) * 100);
}

function calendarDays(startKey, endKey) {
  const ms = new Date(endKey).getTime() - new Date(startKey).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// ── Performance insights ──────────────────────────────────────────────────────

function computePerformanceInsights(dayWiseBreakdown, agg, studyDays) {
  const actualMin  = Math.floor(agg.total_actual_seconds / 60);
  const plannedMin = agg.total_planned_minutes;
  const gap        = actualMin - plannedMin;

  const activeDays = (dayWiseBreakdown || []).filter((d) => Number(d.actual_seconds) > 0);

  const bestDay = activeDays.length > 0
    ? activeDays.reduce((b, d) => Number(d.actual_seconds) > Number(b.actual_seconds) ? d : b)
    : null;

  const worstDay = activeDays.length > 1
    ? activeDays.reduce((w, d) => Number(d.actual_seconds) < Number(w.actual_seconds) ? d : w)
    : null;

  const avgDailySeconds = studyDays > 0
    ? Math.round(agg.total_actual_seconds / studyDays)
    : 0;

  return {
    performanceGap:        gap,
    performanceGapDisplay: `${gap >= 0 ? '+' : ''}${gap}m vs planned`,
    overPerformed:         gap >= 0,
    bestDay:  bestDay  ? { dayKey: bestDay.day_key,  display: fmtSec(bestDay.actual_seconds)  } : null,
    worstDay: worstDay ? { dayKey: worstDay.day_key, display: fmtSec(worstDay.actual_seconds) } : null,
    avgDailyStudyDisplay:  fmtSec(avgDailySeconds),
    avgDailySeconds,
  };
}

// ── Weak subject detection ────────────────────────────────────────────────────

function computeWeakSubjects(enrichedSubjects) {
  if (!enrichedSubjects || enrichedSubjects.length < 2) return [];

  const result = [];

  // Subject with lowest actual study time (only among those with any time)
  const withTime = enrichedSubjects.filter((s) => Number(s.actual_seconds) > 0);
  if (withTime.length >= 2) {
    const lowestTime = withTime.reduce((low, s) =>
      Number(s.actual_seconds) < Number(low.actual_seconds) ? s : low);
    result.push({
      subject: lowestTime.subject,
      reason:  `Lowest study time (${fmtSec(lowestTime.actual_seconds)})`,
    });
  }

  // Subject with highest incomplete ratio (among those with ≥ 2 blocks)
  const withMultiple = enrichedSubjects.filter((s) => Number(s.block_count) >= 2);
  if (withMultiple.length > 0) {
    const withRatio = withMultiple.map((s) => ({
      ...s,
      incompleteRatio: (Number(s.block_count) - Number(s.completed_count)) / Number(s.block_count),
    }));
    const worst = withRatio.reduce((w, s) => s.incompleteRatio > w.incompleteRatio ? s : w);
    if (worst.incompleteRatio > 0.4) {
      const note = `${Math.round(worst.incompleteRatio * 100)}% of planned blocks incomplete`;
      const existing = result.find((r) => r.subject === worst.subject);
      if (existing) {
        existing.reason += ` · ${note}`;
      } else {
        result.push({ subject: worst.subject, reason: note });
      }
    }
  }

  return result;
}

// ── AI summary via Anthropic Messages API (native fetch, no SDK required) ─────

async function generateAiSummary({
  period, totalStudySeconds, studyDays, calendarDays: calDays,
  completionRate, streakCount, consistencyScore: cScore,
  subjectWiseSplit, weakSubjects, missedCount, performanceGapDisplay,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const topSubjects = subjectWiseSplit.slice(0, 5)
    .map((s) => `${s.subject} (${fmtSec(s.actual_seconds)})`)
    .join(', ') || 'none';
  const weakList = weakSubjects.map((w) => w.subject).join(', ') || 'none identified';

  const prompt =
    `You are a UPSC exam study coach. Write a 3-4 sentence performance summary for a student.\n` +
    `Be specific with numbers. Use plain English. End with one concrete, actionable suggestion.\n\n` +
    `Period: ${period}\n` +
    `Total study: ${fmtSec(totalStudySeconds)}\n` +
    `Days studied: ${studyDays} of ${calDays}\n` +
    `Block completion rate: ${completionRate}%\n` +
    `Current streak: ${streakCount} days\n` +
    `Consistency score: ${cScore}/100\n` +
    `Performance vs planned: ${performanceGapDisplay}\n` +
    `Subjects covered: ${topSubjects}\n` +
    `Weak areas: ${weakList}\n` +
    `Missed/skipped sessions: ${missedCount}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error('[generateAiSummary] Anthropic API error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[generateAiSummary]', err.message);
    return null;
  }
}

// ── Daily report ──────────────────────────────────────────────────────────────

export async function getDailyReport(userId = DEFAULT_USER, date) {
  const dayKey = String(date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  const [agg, blocks, subjectSplit, topicSplit, stageSplit, sourceSplit] = await Promise.all([
    getDayAggregate(userId, dayKey),
    getStudiedBlocks(userId, dayKey, dayKey),
    getSubjectWiseSplit(userId, dayKey, dayKey),
    getTopicWiseSplit(userId, dayKey, dayKey),
    getStageWiseSplit(userId, dayKey, dayKey),
    getSourceTypeSplit(userId, dayKey, dayKey),
  ]);

  const a = coerce(agg);
  const actualMin = Math.floor(a.total_actual_seconds / 60);
  const performanceGap = actualMin - a.total_planned_minutes;

  return {
    date:   dayKey,
    userId,

    totalStudySeconds:   a.total_actual_seconds,
    totalPauseSeconds:   a.total_pause_seconds,
    totalPlannedMinutes: a.total_planned_minutes,
    totalActualMinutes:  actualMin,
    totalStudyDisplay:   fmtSec(a.total_actual_seconds),

    totalBlocks:     a.total_blocks,
    startedBlocks:   a.started_blocks,
    completedBlocks: a.completed_blocks,
    completionRate:  a.total_blocks > 0
      ? Math.round((a.completed_blocks / a.total_blocks) * 100)
      : 0,

    performanceGap,
    performanceGapDisplay: `${performanceGap >= 0 ? '+' : ''}${performanceGap}m vs planned`,

    subjectWiseSplit: enrichSplit(subjectSplit, a.total_actual_seconds),
    topicWiseSplit:   topicSplit.map((r) => ({
      ...r,
      actual_seconds:         Number(r.actual_seconds || 0),
      block_count:            Number(r.block_count    || 0),
      actual_minutes_display: fmtSec(r.actual_seconds),
    })),
    stageWiseSplit:  stageSplit.map((r) => ({ ...r, actual_seconds: Number(r.actual_seconds || 0) })),
    sourceTypeSplit: sourceSplit.map((r) => ({ ...r, actual_seconds: Number(r.actual_seconds || 0) })),

    studiedBlocks: blocks.map(normalizeBlock),
    _reportedAt:   new Date().toISOString(),
  };
}

// ── Weekly report ─────────────────────────────────────────────────────────────

export async function getWeeklyReport(userId = DEFAULT_USER, endDate) {
  const endKey   = String(endDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const end      = new Date(endKey);
  const start    = new Date(end);
  start.setDate(end.getDate() - 6);
  const startKey = start.toISOString().slice(0, 10);

  const [agg, blocks, subjectSplit, topicSplit, stageSplit, dayBreakdown, streak, studyDays, missedBlockRows] =
    await Promise.all([
      getRangeAggregate(userId, startKey, endKey),
      getStudiedBlocks(userId, startKey, endKey),
      getSubjectWiseSplit(userId, startKey, endKey),
      getTopicWiseSplit(userId, startKey, endKey),
      getStageWiseSplit(userId, startKey, endKey),
      getDayWiseBreakdown(userId, startKey, endKey),
      getStreak(userId, endKey),
      countStudyDays(userId, startKey, endKey),
      getMissedBlocks(userId, startKey, endKey),
    ]);

  const a         = coerce(agg);
  const actualMin = Math.floor(a.total_actual_seconds / 60);
  const score     = consistencyScore({
    studyDays, calendarDays: 7,
    actualMin, plannedMin: a.total_planned_minutes, streak,
  });

  const enrichedSubjects = enrichSplit(subjectSplit, a.total_actual_seconds);
  const completionRate   = a.total_blocks > 0
    ? Math.round((a.completed_blocks / a.total_blocks) * 100)
    : 0;

  const insights     = computePerformanceInsights(dayBreakdown, a, studyDays);
  const weakSubjects = computeWeakSubjects(enrichedSubjects);
  const missedBlocks = missedBlockRows.map((r) => ({
    subject:        r.subject,
    topic:          r.topic,
    dayKey:         r.day_key,
    status:         r.status,
    plannedMinutes: Number(r.planned_minutes || 0),
  }));

  const aiSummary = await generateAiSummary({
    period:               `${startKey} to ${endKey}`,
    totalStudySeconds:    a.total_actual_seconds,
    studyDays,
    calendarDays:         7,
    completionRate,
    streakCount:          streak,
    consistencyScore:     score,
    subjectWiseSplit:     enrichedSubjects,
    weakSubjects,
    missedCount:          missedBlocks.length,
    performanceGapDisplay: insights.performanceGapDisplay,
  });

  return {
    weekStart: startKey,
    weekEnd:   endKey,
    userId,

    totalStudySeconds:   a.total_actual_seconds,
    totalPauseSeconds:   a.total_pause_seconds,
    totalPlannedMinutes: a.total_planned_minutes,
    totalActualMinutes:  actualMin,
    totalStudyDisplay:   fmtSec(a.total_actual_seconds),

    totalBlocks:     a.total_blocks,
    completedBlocks: a.completed_blocks,
    completionRate,

    studyDaysCount:       studyDays,
    avgDailyStudyMinutes: studyDays > 0 ? Math.round(actualMin / studyDays) : 0,
    streakCount:          streak,
    consistencyScore:     score,

    subjectWiseSplit: enrichedSubjects,
    topicWiseSplit:   topicSplit.map((r) => ({
      ...r,
      actual_seconds:         Number(r.actual_seconds || 0),
      actual_minutes_display: fmtSec(r.actual_seconds),
    })),
    stageWiseSplit: stageSplit.map((r) => ({
      ...r,
      actual_seconds: Number(r.actual_seconds || 0),
    })),
    dayWiseBreakdown: dayBreakdown.map((d) => ({
      ...d,
      actual_seconds:         Number(d.actual_seconds  || 0),
      planned_minutes:        Number(d.planned_minutes || 0),
      actual_minutes_display: fmtSec(d.actual_seconds),
    })),

    // ── Intelligence layer ──────────────────────────────────────────────────
    insights,
    weakSubjects,
    missedBlocks,
    aiSummary,

    // Phase 8: Knowledge Linkage metrics
    knowledgeLinkage: await buildLinkageMetrics(userId, startKey, endKey),

    studiedBlocks: blocks.map(normalizeBlock),
    _reportedAt:   new Date().toISOString(),
  };
}

// ── Monthly report ────────────────────────────────────────────────────────────

export async function getMonthlyReport(userId = DEFAULT_USER, month) {
  const m        = String(month || new Date().toISOString().slice(0, 7)).slice(0, 7);
  const startKey = `${m}-01`;
  const lastDay  = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0);
  const endKey   = lastDay.toISOString().slice(0, 10);
  const calDays  = calendarDays(startKey, endKey);

  const [agg, blocks, subjectSplit, topicSplit, stageSplit,
         dayBreakdown, weekBreakdown, streak, studyDays, missedBlockRows] = await Promise.all([
    getRangeAggregate(userId, startKey, endKey),
    getStudiedBlocks(userId, startKey, endKey),
    getSubjectWiseSplit(userId, startKey, endKey),
    getTopicWiseSplit(userId, startKey, endKey),
    getStageWiseSplit(userId, startKey, endKey),
    getDayWiseBreakdown(userId, startKey, endKey),
    getWeeklyBreakdown(userId, startKey, endKey),
    getStreak(userId, endKey),
    countStudyDays(userId, startKey, endKey),
    getMissedBlocks(userId, startKey, endKey),
  ]);

  const a         = coerce(agg);
  const actualMin = Math.floor(a.total_actual_seconds / 60);
  const score     = consistencyScore({
    studyDays, calendarDays: calDays,
    actualMin, plannedMin: a.total_planned_minutes, streak,
  });

  const enrichedSubjects = enrichSplit(subjectSplit, a.total_actual_seconds);
  const completionRate   = a.total_blocks > 0
    ? Math.round((a.completed_blocks / a.total_blocks) * 100)
    : 0;

  const insights     = computePerformanceInsights(dayBreakdown, a, studyDays);
  const weakSubjects = computeWeakSubjects(enrichedSubjects);
  const missedBlocks = missedBlockRows.map((r) => ({
    subject:        r.subject,
    topic:          r.topic,
    dayKey:         r.day_key,
    status:         r.status,
    plannedMinutes: Number(r.planned_minutes || 0),
  }));

  const aiSummary = await generateAiSummary({
    period:               new Date(startKey).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    totalStudySeconds:    a.total_actual_seconds,
    studyDays,
    calendarDays:         calDays,
    completionRate,
    streakCount:          streak,
    consistencyScore:     score,
    subjectWiseSplit:     enrichedSubjects,
    weakSubjects,
    missedCount:          missedBlocks.length,
    performanceGapDisplay: insights.performanceGapDisplay,
  });

  return {
    month: m,
    monthStart: startKey,
    monthEnd:   endKey,
    calendarDays: calDays,
    userId,

    totalStudySeconds:   a.total_actual_seconds,
    totalPauseSeconds:   a.total_pause_seconds,
    totalPlannedMinutes: a.total_planned_minutes,
    totalActualMinutes:  actualMin,
    totalStudyDisplay:   fmtSec(a.total_actual_seconds),

    totalBlocks:     a.total_blocks,
    completedBlocks: a.completed_blocks,
    completionRate,

    activeStudyDays:      studyDays,
    avgDailyStudyMinutes: studyDays > 0 ? Math.round(actualMin / studyDays) : 0,
    streakCount:          streak,
    consistencyScore:     score,

    subjectWiseSplit: enrichedSubjects,
    topicWiseSplit:   topicSplit.map((r) => ({
      ...r,
      actual_seconds:         Number(r.actual_seconds || 0),
      actual_minutes_display: fmtSec(r.actual_seconds),
    })),
    stageWiseSplit: stageSplit.map((r) => ({
      ...r,
      actual_seconds: Number(r.actual_seconds || 0),
    })),
    dayWiseBreakdown: dayBreakdown.map((d) => ({
      ...d,
      actual_seconds:         Number(d.actual_seconds  || 0),
      planned_minutes:        Number(d.planned_minutes || 0),
      actual_minutes_display: fmtSec(d.actual_seconds),
    })),
    weeklyBreakdown: weekBreakdown.map((w) => ({
      ...w,
      actual_seconds:         Number(w.actual_seconds || 0),
      actual_minutes_display: fmtSec(w.actual_seconds),
    })),

    topStudiedSubjects: enrichedSubjects.slice(0, 5)
      .map((r) => ({ subject: r.subject, actual_seconds: r.actual_seconds, display: fmtSec(r.actual_seconds) })),
    topStudiedTopics: [...topicSplit]
      .sort((a, b) => Number(b.actual_seconds) - Number(a.actual_seconds))
      .slice(0, 10)
      .map((r) => ({
        subject: r.subject, topic: r.topic,
        actual_seconds: Number(r.actual_seconds), display: fmtSec(r.actual_seconds),
      })),

    // ── Intelligence layer ──────────────────────────────────────────────────
    insights,
    weakSubjects,
    missedBlocks,
    aiSummary,

    // Phase 8: Knowledge Linkage metrics
    knowledgeLinkage: await buildLinkageMetrics(userId, startKey, endKey),

    studiedBlocks: blocks.map(normalizeBlock),
    _reportedAt:   new Date().toISOString(),
  };
}
