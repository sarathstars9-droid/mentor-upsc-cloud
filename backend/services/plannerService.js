// backend/services/plannerService.js
// Adaptive Planner Engine — production-grade recommendation system.
//
// ── Scoring weights ───────────────────────────────────────────────────────────
//   +4  block was missed / skipped on a recent past day
//   +3  subject flagged as weak (low time coverage, < 15% share)
//   +2  subject has > 40% incomplete blocks (high abandonment)
//   +1  subject occupies < 10% of total study time (low allocation)
//   ─────────────────────────────────────────────────────────────────────
//   -1  topic suggested 1–2 times in last 14 days (light decay)
//   -2  topic suggested 3 times               (medium decay)
//   -3  topic suggested ≥ 4 times             (strong suppression)
//   -3  topic completed recently              (no longer needed)
//
// ── Diversity ─────────────────────────────────────────────────────────────────
//   Max 2 recommendations per subject in the final top-5.
//   If top-5 cannot be filled with diversity, slots are backfilled in score order.
//
// ── Caching ───────────────────────────────────────────────────────────────────
//   In-process LRU-style Map. Key = userId::endKey. TTL = 12 min.
//   Only fresh computations are logged to planner_suggestions_log.
//
// ── Confidence score (0–100) ──────────────────────────────────────────────────
//   Base 35. Boosted by: sufficient study days, enough data blocks,
//   clear missed/weak signals, significant performance gap.
//   Penalised for insufficient data.

import {
  getRangeAggregate,
  getSubjectWiseSplit,
  getTopicWiseSplit,
  getDayWiseBreakdown,
  countStudyDays,
  getMissedBlocks,
} from '../repositories/reportRepository.js';
import {
  getRecentSuggestionCounts,
  logSuggestions,
  pruneOldSuggestions,
} from '../repositories/plannerRepository.js';
import { fmtSec } from './reportService.js';

const DEFAULT_USER   = process.env.DEFAULT_USER_ID || 'moulika';
const CACHE_TTL_MS   = 12 * 60 * 1000;   // 12 minutes
const MAX_RECS       = 5;
const MAX_PER_SUBJ   = 2;
const DECAY_WINDOW   = 14;               // days to look back for decay
const PRACTICE_KEYS  = ['prelims', 'pyq', 'mcq', 'mock test', 'practice', 'institutional'];

// ── In-process cache ──────────────────────────────────────────────────────────

const _cache = new Map();

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.val;
}

function cacheSet(key, val) {
  // Evict entries over 200 to prevent unbounded growth
  if (_cache.size > 200) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, { val, exp: Date.now() + CACHE_TTL_MS });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function coerceAgg(agg) {
  return {
    total_actual_seconds:  Number(agg?.total_actual_seconds  || 0),
    total_planned_minutes: Number(agg?.total_planned_minutes || 0),
    total_blocks:          Number(agg?.total_blocks          || 0),
    completed_blocks:      Number(agg?.completed_blocks      || 0),
  };
}

function decayPenalty(count) {
  if (count >= 4) return -3;
  if (count === 3) return -2;
  if (count >= 1) return -1;
  return 0;
}

// Confidence score: how much data we have to make a reliable recommendation.
function computeConfidence({ studyDays, totalBlocks, missedCount, weakSubjectCount, underPerformedBy }) {
  let s = 35;

  // Study day coverage
  if (studyDays >= 5) s += 15;
  else if (studyDays >= 3) s += 8;
  else if (studyDays < 2) s -= 15;

  // Data volume
  if (totalBlocks >= 15) s += 15;
  else if (totalBlocks >= 7) s += 8;
  else if (totalBlocks < 3) s -= 12;

  // Signal strength: missed blocks
  if (missedCount >= 3) s += 15;
  else if (missedCount >= 1) s += 8;

  // Signal strength: weak subjects
  if (weakSubjectCount >= 2) s += 10;
  else if (weakSubjectCount >= 1) s += 5;

  // Signal strength: performance gap
  if (underPerformedBy > 60) s += 10;
  else if (underPerformedBy > 20) s += 5;

  // Hard caps for low-data scenarios — prevent false confidence
  if (studyDays < 2)   s = Math.min(s, 50);
  else if (totalBlocks < 5) s = Math.min(s, 60);

  return Math.min(100, Math.max(20, s));
}

// Classify each recommendation's study type.
function classifyType(subject, reasons) {
  const subj = (subject || '').toLowerCase();
  if (PRACTICE_KEYS.some((k) => subj.includes(k))) return 'PRACTICE';
  // Phase 8: Knowledge linkage signals
  if (reasons.some((r) => r.includes('PYQ'))) return 'PRACTICE';
  if (reasons.some((r) => r.includes('Revision overdue'))) return 'REVISION';
  if (reasons.some((r) => r.includes('Missed'))) return 'REVISION';
  if (reasons.some((r) => r.includes('0%') || r.includes('Not studied'))) return 'NEW';
  return 'REVISION';
}

// Derive a sensible session length (minutes) for the recommendation.
function suggestedMinutes(subject, topic, type, missedBlocks, subjectSplit) {
  // Try to use the planned time from a matching missed block
  const matched = missedBlocks.filter(
    (b) => b.subject === subject && (!topic || b.topic === topic) && b.plannedMinutes > 0
  );
  if (matched.length > 0) {
    const max = Math.max(...matched.map((b) => b.plannedMinutes));
    return Math.min(Math.max(max, 25), 120);
  }

  // Use average session length for this subject from recent data
  const sd = subjectSplit.find((s) => (s.subject || 'Unknown') === subject);
  if (sd) {
    const avg = Number(sd.planned_minutes || 0) / Math.max(Number(sd.block_count || 1), 1);
    if (avg > 5) return Math.min(Math.max(Math.round(avg), 25), 120);
  }

  // Defaults by type
  if (type === 'NEW')      return 60;
  if (type === 'PRACTICE') return 30;
  return 45;
}

// Detect subjects that need attention.
function detectWeakSubjects(subjectSplit, totalSeconds) {
  if (!subjectSplit || subjectSplit.length < 2) return [];

  const total    = Math.max(totalSeconds, 1);
  const enriched = subjectSplit.map((s) => ({
    subject:         s.subject          || 'Unknown',
    actual_seconds:  Number(s.actual_seconds  || 0),
    block_count:     Number(s.block_count     || 0),
    completed_count: Number(s.completed_count || 0),
    ratio:           Number(s.actual_seconds  || 0) / total,
    incompleteRatio: Number(s.block_count || 0) > 0
      ? (Number(s.block_count || 0) - Number(s.completed_count || 0)) / Number(s.block_count || 0)
      : 0,
  }));

  const result = [];

  // Lowest time share (< 15% — meaningfully under-indexed)
  const withTime = enriched.filter((s) => s.actual_seconds > 0);
  if (withTime.length >= 2) {
    const lowest = withTime.reduce((l, s) => s.actual_seconds < l.actual_seconds ? s : l);
    if (lowest.ratio < 0.15) {
      result.push({
        subject:   lowest.subject,
        reason:    `Low coverage (${Math.round(lowest.ratio * 100)}% of total study time)`,
        weakScore: 3,
      });
    }
  }

  // Highest incomplete ratio among subjects with ≥ 2 blocks, > 40% incomplete
  const withMultiple = enriched.filter((s) => s.block_count >= 2);
  if (withMultiple.length > 0) {
    const worst = withMultiple.reduce((w, s) => s.incompleteRatio > w.incompleteRatio ? s : w);
    if (worst.incompleteRatio > 0.4) {
      const note = `${Math.round(worst.incompleteRatio * 100)}% of planned sessions not completed`;
      const existing = result.find((r) => r.subject === worst.subject);
      if (existing) {
        existing.reason    += ` · ${note}`;
        existing.weakScore += 1;
      } else {
        result.push({ subject: worst.subject, reason: note, weakScore: 2 });
      }
    }
  }

  return result;
}

// Core scoring + diversity selection.
function buildRecommendations({
  missedBlocks, weakSubjects, subjectSplit, topicSplit,
  performance, decayCounts, subjectSplitRaw,
  // Phase 8: Knowledge linkage data (may be empty arrays if migration pending)
  noFollowThroughBlocks = [], highMistakeNodes = [], overdueRevisionNodes = [],
}) {
  const scoreMap  = new Map(); // key  → raw score
  const reasonMap = new Map(); // key  → string[]
  const originMap = new Map(); // key  → 'missed' | 'weak' | 'low'

  function add(subject, topic, score, reason, origin) {
    const key = `${subject}::${topic || ''}`;
    scoreMap.set(key, (scoreMap.get(key) || 0) + score);
    const reasons = reasonMap.get(key) || [];
    if (!reasons.includes(reason)) reasons.push(reason);
    reasonMap.set(key, reasons);
    if (!originMap.has(key)) originMap.set(key, origin);
  }

  // 1. Missed / skipped blocks (+4 each)
  for (const b of missedBlocks) {
    add(b.subject, b.topic, 4, `Missed on ${b.dayKey}`, 'missed');
  }

  // 2. Weak subjects (+3/+2) — surface their least-studied topics
  for (const w of weakSubjects) {
    const subjectTopics = topicSplit
      .filter((t) => (t.subject || 'Unknown') === w.subject)
      .sort((a, b) => Number(a.actual_seconds) - Number(b.actual_seconds))
      .slice(0, 3);

    if (subjectTopics.length > 0) {
      for (const t of subjectTopics) {
        add(w.subject, t.topic || null, w.weakScore, w.reason, 'weak');
      }
    } else {
      add(w.subject, null, w.weakScore, w.reason, 'weak');
    }
  }

  // 3. Low time-share subjects (+1) — catch neglected subjects with no topic data
  const totalSecs = subjectSplit.reduce((s, r) => s + Number(r.actual_seconds || 0), 0);
  for (const s of subjectSplit) {
    const ratio = Number(s.actual_seconds || 0) / Math.max(totalSecs, 1);
    if (ratio < 0.10 && Number(s.actual_seconds || 0) > 0) {
      add(s.subject || 'Unknown', null, 1, `Only ${Math.round(ratio * 100)}% of total study time`, 'low');
    }
  }

  // Phase 8: Knowledge linkage signals (additive only)

  // 4. PYQ follow-through: studied a node but never attempted linked PYQs (+3)
  for (const b of noFollowThroughBlocks.slice(0, 5)) {
    const subj = b.subject || 'Unknown';
    add(subj, b.topic || null, 3, `Studied but no PYQs attempted — ${b.recommended_question_count || 0} available`, 'linkage');
  }

  // 5. High mistake density: node has >3 mistakes with <50% accuracy (+2)
  for (const m of highMistakeNodes.slice(0, 5)) {
    const subj = m.subject || 'Unknown';
    const accuracy = m.mistake_count > 0
      ? Math.round((Number(m.correct_count || 0) / Number(m.mistake_count)) * 100)
      : 0;
    add(subj, null, 2, `Low PYQ accuracy (${accuracy}%) — ${m.mistake_count} mistakes`, 'linkage');
  }

  // 6. Revision backlog: node has ≥3 overdue revision items (+2)
  for (const r of overdueRevisionNodes.slice(0, 5)) {
    add('Revision', r.node_id || null, 2, `Revision overdue — ${r.overdue_count} items pending`, 'linkage');
  }

  // Build decay lookup: Map<"subject::topic", count>
  const decayMap = new Map(
    decayCounts.map((r) => [`${r.subject}::${r.topic || ''}`, Number(r.suggestion_count)])
  );

  // Apply decay and assemble candidates
  const candidates = [...scoreMap.entries()].map(([key, rawScore]) => {
    const count   = decayMap.get(key) || 0;
    const penalty = decayPenalty(count);
    const [subject, topic] = key.split('::');
    return {
      _key:    key,
      subject,
      topic:   topic || null,
      score:   rawScore + penalty,
      rawScore,
      decayCount: count,
      reasons: reasonMap.get(key) || [],
      origin:  originMap.get(key) || 'low',
    };
  });

  // Sort by adjusted score descending
  candidates.sort((a, b) => b.score - a.score);

  // Diversity selection: max MAX_PER_SUBJ per subject
  const subjectCount = new Map();
  const selected     = [];

  for (const c of candidates) {
    if (selected.length >= MAX_RECS) break;
    const n = subjectCount.get(c.subject) || 0;
    if (n >= MAX_PER_SUBJ) continue;
    selected.push(c);
    subjectCount.set(c.subject, n + 1);
  }

  // Back-fill if diversity pruning left gaps
  if (selected.length < MAX_RECS) {
    const usedKeys = new Set(selected.map((s) => s._key));
    for (const c of candidates) {
      if (selected.length >= MAX_RECS) break;
      if (!usedKeys.has(c._key)) {
        selected.push(c);
        usedKeys.add(c._key);
      }
    }
  }

  // Enrich each recommendation
  const recommendedBlocks = selected.map((c) => {
    const type    = classifyType(c.subject, c.reasons);
    const minutes = suggestedMinutes(c.subject, c.topic, type, missedBlocks, subjectSplitRaw);
    return {
      subject:          c.subject,
      topic:            c.topic,
      reason:           c.reasons.join(' · '),
      type,
      suggestedMinutes: minutes,
      score:            c.score,
    };
  });

  // Priority
  let priority;
  if (performance.underPerformedBy > 60 || missedBlocks.length > 4) {
    priority = 'HIGH';
  } else if (performance.underPerformedBy > 20 || missedBlocks.length > 1 || weakSubjects.length > 0) {
    priority = 'MEDIUM';
  } else {
    priority = 'LOW';
  }

  // Strategy sentence
  let strategy;
  if (missedBlocks.length > 3) {
    strategy = `Recover the ${missedBlocks.length} missed sessions before starting new topics`;
  } else if (weakSubjects.length > 1) {
    strategy = `Strengthen ${weakSubjects.slice(0, 2).map((w) => w.subject).join(' and ')} — currently under-represented`;
  } else if (performance.underPerformedBy > 60) {
    strategy = 'Prioritise consistency — close the gap to planned time before expanding scope';
  } else if (priority === 'LOW') {
    strategy = 'Strong week — maintain current pace and continue the planned schedule';
  } else {
    strategy = 'Address weak and missed areas first, then resume the regular plan';
  }

  return { recommendedBlocks, priority, strategy };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateSuggestions(userId = DEFAULT_USER, { endDate } = {}) {
  const endKey   = String(endDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cacheKey = `${userId}::${endKey}`;

  // Serve from cache if available
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, _cached: true };

  // ── Fetch all DB data in parallel ────────────────────────────────────────
  const end    = new Date(endKey);
  const start  = new Date(end);
  start.setDate(end.getDate() - 6);
  const startKey = start.toISOString().slice(0, 10);

  // Phase 8: lazy-load linkage repo (safe if module/migration not yet deployed)
  let linkageRepo = null;
  try {
    linkageRepo = await import('../repositories/knowledgeLinkageRepository.js');
  } catch { /* knowledge linkage module not deployed yet */ }

  const [agg, subjectSplit, topicSplit, dayBreakdown, studyDays, missedBlockRows, decayCounts,
         noFollowThroughBlocks, highMistakeNodes, overdueRevisionNodes] =
    await Promise.all([
      getRangeAggregate(userId, startKey, endKey),
      getSubjectWiseSplit(userId, startKey, endKey),
      getTopicWiseSplit(userId, startKey, endKey),
      getDayWiseBreakdown(userId, startKey, endKey),
      countStudyDays(userId, startKey, endKey),
      getMissedBlocks(userId, startKey, endKey),
      getRecentSuggestionCounts(userId, DECAY_WINDOW),
      // Phase 8: Knowledge linkage queries (return [] if unavailable)
      linkageRepo ? linkageRepo.getNoFollowThroughBlocks(userId).catch(() => []) : [],
      linkageRepo ? linkageRepo.getHighMistakeDensityNodes(userId).catch(() => []) : [],
      linkageRepo ? linkageRepo.getOverdueRevisionCountsByNode(userId).catch(() => []) : [],
    ]);

  // ── Derive context ───────────────────────────────────────────────────────
  const a          = coerceAgg(agg);
  const actualMin  = Math.floor(a.total_actual_seconds / 60);
  const gap        = actualMin - a.total_planned_minutes;

  const performance = {
    gap,
    underPerformedBy: Math.max(0, -gap),
    studyDays,
    activeDays: (dayBreakdown || []).filter((d) => Number(d.actual_seconds) > 0).length,
  };

  const weakSubjects = detectWeakSubjects(subjectSplit, a.total_actual_seconds);

  const missedBlocks = missedBlockRows.map((r) => ({
    subject:        r.subject,
    topic:          r.topic  || null,
    dayKey:         r.day_key,
    status:         r.status,
    plannedMinutes: Number(r.planned_minutes || 0),
  }));

  // ── Build recommendations ────────────────────────────────────────────────
  const { recommendedBlocks, priority, strategy } = buildRecommendations({
    missedBlocks,
    weakSubjects,
    subjectSplit,
    topicSplit,
    performance,
    decayCounts,
    subjectSplitRaw: subjectSplit,
    // Phase 8: Knowledge linkage signals
    noFollowThroughBlocks,
    highMistakeNodes,
    overdueRevisionNodes,
  });

  // ── Compute confidence ───────────────────────────────────────────────────
  const confidence = computeConfidence({
    studyDays,
    totalBlocks:      a.total_blocks,
    missedCount:      missedBlocks.length,
    weakSubjectCount: weakSubjects.length,
    underPerformedBy: performance.underPerformedBy,
  });

  const result = {
    userId,
    basePeriod:  { start: startKey, end: endKey },
    generatedAt: new Date().toISOString(),

    recommendedBlocks,
    priority,
    confidence,
    strategy,

    context: {
      studyDays,
      totalStudyHours:      Math.round((a.total_actual_seconds / 3600) * 10) / 10,
      totalStudyDisplay:    fmtSec(a.total_actual_seconds),
      performanceGap:       gap,
      performanceGapDisplay: `${gap >= 0 ? '+' : ''}${gap}m vs planned`,
      missedBlocks:         missedBlocks.length,
      weakSubjectsCount:    weakSubjects.length,
    },

    weakSubjects,
    missedBlocks,
    _cached: false,
  };

  // ── Cache, log, and probabilistic pruning (all non-blocking) ────────────
  cacheSet(cacheKey, result);

  logSuggestions(userId, recommendedBlocks).catch((err) =>
    console.error('[plannerService] logSuggestions failed:', err.message)
  );

  // 1-in-100 chance: prune old suggestion logs to prevent table bloat
  if (Math.random() < 0.01) {
    pruneOldSuggestions(30).catch(() => {});
  }

  return result;
}

// Explicit cache invalidation — call after a block is completed / plan changes.
export function invalidateSuggestionsCache(userId) {
  for (const key of _cache.keys()) {
    if (key.startsWith(`${userId}::`)) _cache.delete(key);
  }
}
