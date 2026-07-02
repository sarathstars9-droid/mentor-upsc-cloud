import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

const VALID_STATUS = ['done', 'partial', 'missed'];
const VALID_QUALITY = ['strong', 'normal', 'weak', null, ''];
const VALID_REASON_CODES = {
  partial: [
    'time_underestimated', 'distracted', 'difficult_topic', 'slow_writing',
    'phone_interruption', 'low_energy', 'overthinking', 'other'
  ],
  missed: [
    'overslept', 'burnout', 'unexpected_work', 'family_interruption',
    'mobile_distraction', 'anxiety_stress', 'plan_unrealistic',
    'shifted_to_another_block', 'health_issue'
  ]
};

// 1. POST /api/behaviour/signals
router.post('/signals', async (req, res) => {
  try {
    const {
      userId,
      blockId = null,
      stableBlockId = null,
      dayKey,
      subject,
      topic,
      status,
      quality,
      completionPercent,
      reasonCode,
      studiedSomethingElse = false,
      alternateSubject,
      energyState,
      hourBucket,
      plannedMinutes,
      actualMinutes,
      metadataJson = {}
    } = req.body;

    if (!userId || !dayKey || !status) {
      return res.status(400).json({ ok: false, error: "userId, dayKey, status are required." });
    }

    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}` });
    }

    if (quality && !VALID_QUALITY.includes(quality)) {
      return res.status(400).json({ ok: false, error: `Invalid quality. Must be one of: ${VALID_QUALITY.filter(Boolean).join(', ')}` });
    }

    if (reasonCode && status !== 'done') {
      const allowedReasons = VALID_REASON_CODES[status] || [];
      if (!allowedReasons.includes(reasonCode)) {
        return res.status(400).json({ ok: false, error: `Invalid reasonCode for status ${status}.` });
      }
    }

    const effectiveBlockId = blockId || null;
    const effectiveStableBlockId = stableBlockId || blockId || 'unknown';

    const sql = `
      INSERT INTO public.behaviour_signals (
        user_id, block_id, stable_block_id, day_key, subject, topic, status, quality,
        completion_percent, reason_code, studied_something_else, alternate_subject,
        energy_state, hour_bucket, planned_minutes, actual_minutes, metadata_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (user_id, day_key, stable_block_id)
      DO UPDATE SET
        subject = EXCLUDED.subject,
        topic = EXCLUDED.topic,
        status = EXCLUDED.status,
        quality = EXCLUDED.quality,
        completion_percent = EXCLUDED.completion_percent,
        reason_code = EXCLUDED.reason_code,
        studied_something_else = EXCLUDED.studied_something_else,
        alternate_subject = EXCLUDED.alternate_subject,
        energy_state = EXCLUDED.energy_state,
        hour_bucket = EXCLUDED.hour_bucket,
        planned_minutes = EXCLUDED.planned_minutes,
        actual_minutes = EXCLUDED.actual_minutes,
        metadata_json = EXCLUDED.metadata_json
      RETURNING *;
    `;

    const values = [
      userId,
      effectiveBlockId,
      effectiveStableBlockId,
      dayKey,
      subject || null,
      topic || null,
      status,
      quality || null,
      completionPercent || null,
      reasonCode || null,
      studiedSomethingElse,
      alternateSubject || null,
      energyState || null,
      hourBucket || null,
      plannedMinutes || null,
      actualMinutes || null,
      metadataJson
    ];

    const result = await query(sql, values);
    res.json({ ok: true, data: result.rows[0] });

  } catch (err) {
    console.error("[POST /api/behaviour/signals] ERROR", err);
    res.json({ ok: true, saved: false, fallback: true });
  }
});

function calculateDailySummary(signals) {
  let plannedMinutes = 0;
  let completedMinutes = 0;
  let doneCount = 0;
  let partialCount = 0;
  let missedCount = 0;

  const subjectQualities = {};
  const reasonCounts = {};
  const hourBucketMisses = {};

  for (const sig of signals) {
    plannedMinutes += (sig.planned_minutes || 0);
    completedMinutes += (sig.actual_minutes || 0);

    if (sig.status === 'done') doneCount++;
    if (sig.status === 'partial') partialCount++;
    if (sig.status === 'missed') missedCount++;

    if (sig.subject && sig.quality) {
      if (!subjectQualities[sig.subject]) subjectQualities[sig.subject] = { score: 0, count: 0 };
      if (sig.quality === 'strong') subjectQualities[sig.subject].score += 3;
      if (sig.quality === 'normal') subjectQualities[sig.subject].score += 2;
      if (sig.quality === 'weak') subjectQualities[sig.subject].score += 1;
      subjectQualities[sig.subject].count++;
    }

    if (sig.reason_code) {
      reasonCounts[sig.reason_code] = (reasonCounts[sig.reason_code] || 0) + 1;
    }

    if (sig.status === 'missed' && sig.hour_bucket) {
      hourBucketMisses[sig.hour_bucket] = (hourBucketMisses[sig.hour_bucket] || 0) + 1;
    }
  }

  const executionRate = plannedMinutes > 0 ? Math.round((completedMinutes / plannedMinutes) * 100) : 0;

  let strongestSubject = null;
  let maxAvg = 0;
  for (const [sub, stat] of Object.entries(subjectQualities)) {
    const avg = stat.score / stat.count;
    if (avg > maxAvg) { maxAvg = avg; strongestSubject = sub; }
  }

  let mainFailureReason = null;
  let maxReasonCount = 0;
  for (const [reason, count] of Object.entries(reasonCounts)) {
    if (count > maxReasonCount) { maxReasonCount = count; mainFailureReason = reason; }
  }

  let weakHourBucket = null;
  let maxHourCount = 0;
  for (const [hour, count] of Object.entries(hourBucketMisses)) {
    if (count > maxHourCount) { maxHourCount = count; weakHourBucket = hour; }
  }

  let mentorInsight = "Solid effort. Keep pushing forward.";
  if (executionRate < 50) {
    mentorInsight = `Rough day. Focus on getting started rather than perfection. ${mainFailureReason ? 'Watch out for ' + mainFailureReason.replace(/_/g, ' ') + '.' : ''}`;
  } else if (executionRate >= 90) {
    mentorInsight = "Incredible execution! You are well on track.";
  } else if (partialCount > doneCount) {
    mentorInsight = "A lot of partial completions. Try to underestimate your time blocks slightly to finish strong.";
  }

  return {
    planned_minutes: plannedMinutes,
    completed_minutes: completedMinutes,
    execution_rate: executionRate,
    done_count: doneCount,
    partial_count: partialCount,
    missed_count: missedCount,
    strongest_subject: strongestSubject,
    weak_hour_bucket: weakHourBucket,
    main_failure_reason: mainFailureReason,
    mentor_insight: mentorInsight
  };
}

function calculateWeeklySummary(signals) {
  const missedSubjects = {};
  const reasonCounts = {};
  const successHours = {};
  const weakHours = {};

  let realismPenalty = 0;
  const totalBlocks = signals.length;

  for (const sig of signals) {
    if (sig.status === 'missed' && sig.subject) {
      missedSubjects[sig.subject] = (missedSubjects[sig.subject] || 0) + 1;
    }
    
    if (sig.reason_code) {
      reasonCounts[sig.reason_code] = (reasonCounts[sig.reason_code] || 0) + 1;
      if (['time_underestimated', 'plan_unrealistic', 'overthinking'].includes(sig.reason_code)) {
        realismPenalty++;
      }
    }

    if (sig.hour_bucket) {
      if (sig.status === 'done' || sig.quality === 'strong') {
        successHours[sig.hour_bucket] = (successHours[sig.hour_bucket] || 0) + 1;
      }
      if (sig.status === 'missed' || sig.status === 'partial') {
        weakHours[sig.hour_bucket] = (weakHours[sig.hour_bucket] || 0) + 1;
      }
    }
  }

  const repeatedMissedSubjects = Object.keys(missedSubjects).filter(sub => missedSubjects[sub] > 1);
  const repeatedReasons = Object.keys(reasonCounts).filter(r => reasonCounts[r] > 1);

  let bestTimeWindow = null;
  let maxSuccess = 0;
  for (const [hour, count] of Object.entries(successHours)) {
    if (count > maxSuccess) { maxSuccess = count; bestTimeWindow = hour; }
  }

  let weakTimeWindow = null;
  let maxWeak = 0;
  for (const [hour, count] of Object.entries(weakHours)) {
    if (count > maxWeak) { maxWeak = count; weakTimeWindow = hour; }
  }

  const planRealismScore = totalBlocks > 0 ? Math.max(0, 100 - Math.round((realismPenalty / totalBlocks) * 100)) : 100;

  return {
    repeated_missed_subjects: repeatedMissedSubjects,
    repeated_reasons: repeatedReasons,
    best_time_window: bestTimeWindow,
    weak_time_window: weakTimeWindow,
    plan_realism_score: planRealismScore
  };
}

function calculateMonthlySummary(signals) {
  let doneCount = 0;
  let partialCount = 0;
  let missedCount = 0;
  let burnoutSignals = 0;
  let overplannerSignals = 0;
  let revisionMissed = 0;
  let optionalMissedOrDrifted = 0;
  let slowSignals = 0;
  const totalBlocks = signals.length;

  for (const sig of signals) {
    if (sig.status === 'done') doneCount++;
    if (sig.status === 'partial') partialCount++;
    if (sig.status === 'missed') missedCount++;

    if (['burnout', 'anxiety_stress', 'health_issue', 'low_energy'].includes(sig.reason_code)) {
      burnoutSignals++;
    }

    if (['time_underestimated', 'plan_unrealistic'].includes(sig.reason_code)) {
      overplannerSignals++;
    }

    if (sig.status === 'missed' && sig.subject && sig.subject.toLowerCase().includes('revision')) {
      revisionMissed++;
    }

    if ((sig.subject && sig.subject.toLowerCase().includes('optional')) && 
        (sig.status === 'missed' || sig.studied_something_else)) {
      optionalMissedOrDrifted++;
    }

    if (['slow_writing', 'difficult_topic'].includes(sig.reason_code)) {
      slowSignals++;
    }
  }

  const executionPct = totalBlocks > 0 ? (doneCount / totalBlocks) * 100 : 0;
  const burnoutPct = totalBlocks > 0 ? (burnoutSignals / totalBlocks) * 100 : 0;
  const overplannerPct = totalBlocks > 0 ? (overplannerSignals / totalBlocks) * 100 : 0;
  const slowPct = totalBlocks > 0 ? (slowSignals / totalBlocks) * 100 : 0;

  let identityPattern = 'balanced_student';

  if (totalBlocks === 0) {
    identityPattern = 'insufficient_data';
  } else if (executionPct >= 80) {
    identityPattern = 'strong_executor';
  } else if (burnoutPct >= 15 || burnoutSignals > 5) {
    identityPattern = 'burnout_risk';
  } else if (overplannerPct >= 20 || overplannerSignals > 7) {
    identityPattern = 'overplanner';
  } else if (revisionMissed >= 4) {
    identityPattern = 'revision_avoider';
  } else if (optionalMissedOrDrifted >= 5) {
    identityPattern = 'optional_drifter';
  } else if (slowPct >= 20 || slowSignals > 7) {
    identityPattern = 'disciplined_but_slow';
  }

  return {
    identity_pattern: identityPattern,
    total_blocks_analyzed: totalBlocks,
    execution_rate: Math.round(executionPct),
    key_metrics: {
      burnout_signals: burnoutSignals,
      overplanner_signals: overplannerSignals,
      slow_signals: slowSignals,
      revision_missed: revisionMissed,
      optional_drifted: optionalMissedOrDrifted
    }
  };
}

// 2. GET /api/behaviour/daily-summary
router.get('/daily-summary', async (req, res) => {
  try {
    const { userId = 'moulika', dayKey } = req.query;
    if (!dayKey) return res.status(400).json({ ok: false, error: "dayKey is required." });

    const result = await query(`SELECT * FROM public.behaviour_signals WHERE user_id = $1 AND day_key = $2`, [userId, dayKey]);
    const summary = calculateDailySummary(result.rows);
    res.json({ ok: true, data: summary });

  } catch (err) {
    console.error("[GET /api/behaviour/daily-summary] ERROR", err);
    res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
});

// 3. GET /api/behaviour/weekly-summary
router.get('/weekly-summary', async (req, res) => {
  try {
    const { userId = 'moulika' } = req.query;
    const result = await query(`
      SELECT * FROM public.behaviour_signals 
      WHERE user_id = $1 AND day_key >= (CURRENT_DATE - INTERVAL '7 days')
    `, [userId]);
    const summary = calculateWeeklySummary(result.rows);
    res.json({ ok: true, data: summary });

  } catch (err) {
    console.error("[GET /api/behaviour/weekly-summary] ERROR", err);
    res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
});

// 4. GET /api/behaviour/monthly-summary
router.get('/monthly-summary', async (req, res) => {
  try {
    const { userId = 'moulika' } = req.query;
    const result = await query(`
      SELECT * FROM public.behaviour_signals 
      WHERE user_id = $1 AND day_key >= (CURRENT_DATE - INTERVAL '30 days')
    `, [userId]);
    const summary = calculateMonthlySummary(result.rows);
    res.json({ ok: true, data: summary });

  } catch (err) {
    console.error("[GET /api/behaviour/monthly-summary] ERROR", err);
    res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
});

export default router;
