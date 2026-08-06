import { query } from '../db/index.js';
import { getStreak } from '../repositories/reportRepository.js';
import { safeExecutionPercent } from '../utils/mathUtils.js';

// Derived actual seconds expression to calculate actual study hours consistently
const ACTUAL_SECONDS_EXPR = `
  CASE
    WHEN started_at IS NULL THEN 0
    WHEN status IN ('completed','partial','missed','skipped') AND ended_at IS NOT NULL
         THEN GREATEST(0,
                EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
                - total_pause_seconds)
    WHEN status = 'paused' AND paused_at IS NOT NULL
         THEN GREATEST(0,
                EXTRACT(EPOCH FROM (paused_at - started_at))::INTEGER
                - total_pause_seconds)
    WHEN status = 'active'
         THEN GREATEST(0,
                EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
                - total_pause_seconds)
    ELSE 0
  END
`.trim();

// Map paper selection to study_blocks subject filtering clause
function getStudyBlockSubjectFilter(paper) {
  if (!paper || paper === 'all') return '';
  if (paper === 'GS1') {
    return "AND (subject = 'GS1' OR subject LIKE 'GS1 - %' OR subject ILIKE '%General Studies 1%')";
  }
  if (paper === 'GS2') {
    return "AND (subject = 'GS2' OR subject LIKE 'GS2 - %' OR subject ILIKE '%General Studies 2%')";
  }
  if (paper === 'GS3') {
    return "AND (subject = 'GS3' OR subject LIKE 'GS3 - %' OR subject ILIKE '%General Studies 3%')";
  }
  if (paper === 'Ethics') {
    return "AND (subject = 'GS4 Ethics' OR subject = 'GS4' OR subject = 'Ethics' OR subject ILIKE '%Ethics, Integrity & Aptitude%')";
  }
  if (paper === 'Essay') {
    return "AND (subject = 'Essay' OR subject ILIKE '%GS Paper I Essay%')";
  }
  if (paper === 'Geography Optional') {
    return "AND (subject = 'Geography Optional' OR subject = 'Optional Geography' OR subject = 'Geography')";
  }
  return '';
}

// Map paper selection to attempts/mistakes paper filtering clause
function getAttemptPaperFilter(paper, tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  if (!paper || paper === 'all') return '';
  if (paper === 'GS1') {
    return `AND (${prefix}paper = 'GS1' OR ${prefix}paper ILIKE '%General Studies 1%')`;
  }
  if (paper === 'GS2') {
    return `AND (${prefix}paper = 'GS2' OR ${prefix}paper ILIKE '%General Studies 2%')`;
  }
  if (paper === 'GS3') {
    return `AND (${prefix}paper = 'GS3' OR ${prefix}paper ILIKE '%General Studies 3%')`;
  }
  if (paper === 'Ethics') {
    return `AND (${prefix}paper IN ('GS4', 'Ethics', 'GS4 Ethics') OR ${prefix}paper ILIKE '%Ethics, Integrity%')`;
  }
  if (paper === 'Essay') {
    return `AND (${prefix}paper = 'Essay' OR ${prefix}paper ILIKE '%Essay%')`;
  }
  if (paper === 'Geography Optional') {
    return `AND (${prefix}paper IN ('Geography Optional', 'Geography') OR ${prefix}paper ILIKE '%Optional Geography%')`;
  }
  return '';
}

export async function getReportsDashboardData(userId = 'moulika', range = 'week', paper = 'all') {
  // 1. Time range date calculations in Asia/Kolkata timezone
  const kolkataStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let dateConditionBlock = '';
  let dateConditionCreated = '';
  let dateConditionRevision = '';

  if (range === 'today') {
    dateConditionBlock = `AND day_key = '${todayStr}'`;
    dateConditionCreated = `AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = '${todayStr}'`;
    dateConditionRevision = `AND (ri.created_at AT TIME ZONE 'Asia/Kolkata')::date = '${todayStr}'`;
  } else if (range === 'week') {
    const start = new Date(d);
    start.setDate(d.getDate() - 6);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    dateConditionBlock = `AND day_key >= '${startStr}'`;
    dateConditionCreated = `AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= '${startStr}'`;
    dateConditionRevision = `AND (ri.created_at AT TIME ZONE 'Asia/Kolkata')::date >= '${startStr}'`;
  } else if (range === 'month') {
    const start = new Date(d);
    start.setDate(d.getDate() - 29);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    dateConditionBlock = `AND day_key >= '${startStr}'`;
    dateConditionCreated = `AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= '${startStr}'`;
    dateConditionRevision = `AND (ri.created_at AT TIME ZONE 'Asia/Kolkata')::date >= '${startStr}'`;
  }

  // Subject filters
  const blockFilter = getStudyBlockSubjectFilter(paper);
  const attemptFilter = getAttemptPaperFilter(paper);
  const mistakeFilter = getAttemptPaperFilter(paper);
  const revisionPaperFilter = getAttemptPaperFilter(paper, 'm_combined');

  // ── 1. EXECUTION SUMMARY ──
  const studyQuery = `
    SELECT
      COUNT(*)::int as total_blocks,
      COUNT(*) FILTER (WHERE status IN ('completed','partial','done'))::int as completed_blocks,
      COUNT(*) FILTER (WHERE status IN ('missed','skipped') OR (started_at IS NULL AND day_key < '${todayStr}'))::int as missed_blocks,
      SUM(planned_minutes)::int as total_planned_minutes,
      SUM(${ACTUAL_SECONDS_EXPR})::int as total_actual_seconds
    FROM public.study_blocks
    WHERE user_id = $1 ${dateConditionBlock} ${blockFilter}
  `;
  const { rows: studyRows } = await query(studyQuery, [userId]);
  const sAgg = studyRows[0] || {};

  const plannedBlocks = sAgg.total_blocks || 0;
  const completedBlocks = sAgg.completed_blocks || 0;
  const missedBlocks = sAgg.missed_blocks || 0;
  const executionRate = safeExecutionPercent(completedBlocks, plannedBlocks);
  const totalPlannedHours = Math.round(((sAgg.total_planned_minutes || 0) / 60) * 10) / 10;
  const totalCompletedHours = Math.round(((sAgg.total_actual_seconds || 0) / 3600) * 10) / 10;

  // Streak (using today's date in Kolkata timezone)
  const streak = await getStreak(userId, todayStr);

  // ── 2. ANSWER WRITING SUMMARY ──
  // Regex parsing extracts score float reliably (e.g. "5.5/10" -> 5.5, "6" -> 6.0, ignores non-numeric strings)
  const scoreParserSql = `
    NULLIF(regexp_replace(regexp_replace(current_score, '/.*', ''), '[^0-9.]', '', 'g'), '')
  `;
  
  const answersQuery = `
    SELECT 
      COUNT(*)::int as total_written,
      COALESCE(AVG((${scoreParserSql})::numeric), 0)::float as avg_score
    FROM public.mains_answer_attempts
    WHERE user_id = $1 AND status != 'draft' AND current_score IS NOT NULL ${dateConditionCreated} ${attemptFilter}
  `;
  const { rows: answerRows } = await query(answersQuery, [userId]);
  const aAgg = answerRows[0] || {};
  const totalWritten = aAgg.total_written || 0;
  const averageScore = Math.round(aAgg.avg_score * 10) / 10;

  // Latest attempts
  const latestQuery = `
    SELECT id, attempt_id, paper, subject, topic, current_score, target_score, created_at
    FROM public.mains_answer_attempts
    WHERE user_id = $1 AND status != 'draft' ${dateConditionCreated} ${attemptFilter}
    ORDER BY created_at DESC
    LIMIT 5
  `;
  const { rows: latestAttempts } = await query(latestQuery, [userId]);

  // Score trend (grouped by day, sorted chronologically)
  const trendQuery = `
    SELECT 
      (created_at AT TIME ZONE 'Asia/Kolkata')::date::text as date,
      ROUND(AVG((${scoreParserSql})::numeric), 1)::float as avg_score
    FROM public.mains_answer_attempts
    WHERE user_id = $1 AND status != 'draft' AND current_score IS NOT NULL ${dateConditionCreated} ${attemptFilter}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const { rows: scoreTrend } = await query(trendQuery, [userId]);

  // Paper split
  const paperSplitQuery = `
    SELECT paper, COUNT(*)::int as count 
    FROM public.mains_answer_attempts
    WHERE user_id = $1 AND status != 'draft' ${dateConditionCreated} ${attemptFilter}
    GROUP BY paper
  `;
  const { rows: paperSplitRows } = await query(paperSplitQuery, [userId]);
  const paperSplit = {};
  paperSplitRows.forEach(r => {
    if (r.paper) paperSplit[r.paper] = r.count;
  });

  // ── 3. MISTAKE SUMMARY ──
  const mistakesQuery = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'open')::int as open_count,
      COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved_count,
      COUNT(*) FILTER (WHERE must_revise = TRUE)::int as must_revise_count,
      COUNT(*) FILTER (WHERE severity = 'high')::int as high_severity_count
    FROM public.mistakes
    WHERE user_id = $1 AND source_type = 'mains_answer' ${dateConditionCreated} ${mistakeFilter}
  `;
  const { rows: mistakeRows } = await query(mistakesQuery, [userId]);
  const mAgg = mistakeRows[0] || {};
  const totalOpen = mAgg.open_count || 0;
  const totalResolved = mAgg.resolved_count || 0;
  const mustRevise = mAgg.must_revise_count || 0;
  const highSeverity = mAgg.high_severity_count || 0;

  // Repeated mistake types
  const repeatedQuery = `
    SELECT mistake_type as type, COUNT(*)::int as count
    FROM public.mistakes
    WHERE user_id = $1 AND source_type = 'mains_answer' ${dateConditionCreated} ${mistakeFilter}
    GROUP BY mistake_type
    ORDER BY count DESC
    LIMIT 5
  `;
  const { rows: repeatedTypes } = await query(repeatedQuery, [userId]);

  // Top weak papers
  const weakPapersQuery = `
    SELECT paper, COUNT(*)::int as count
    FROM public.mistakes
    WHERE user_id = $1 AND status = 'open' AND source_type = 'mains_answer' ${dateConditionCreated} ${mistakeFilter}
    GROUP BY paper
    ORDER BY count DESC
    LIMIT 5
  `;
  const { rows: topWeakPapers } = await query(weakPapersQuery, [userId]);

  // Top weak areas
  const weakAreasQuery = `
    SELECT topic as area, COUNT(*)::int as count
    FROM public.mistakes
    WHERE user_id = $1 AND status = 'open' AND source_type = 'mains_answer' AND topic IS NOT NULL AND topic != '' ${dateConditionCreated} ${mistakeFilter}
    GROUP BY topic
    ORDER BY count DESC
    LIMIT 5
  `;
  const { rows: topWeakAreas } = await query(weakAreasQuery, [userId]);

  // ── 4. REVISION SUMMARY ──
  const revisionQuery = `
    WITH m_combined AS (
      SELECT id, paper, severity, must_revise FROM public.mistakes
    )
    SELECT
      COUNT(*) FILTER (WHERE ri.status = 'pending' AND ri.next_review_at <= NOW())::int as due_today,
      COUNT(*) FILTER (WHERE ri.status = 'pending' AND ri.next_review_at < '${todayStr}T00:00:00Z')::int as overdue,
      COUNT(*) FILTER (WHERE ri.status IN ('completed', 'revised', 'reviewed'))::int as completed,
      COUNT(*) FILTER (WHERE ri.status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE ri.status = 'pending' AND COALESCE(m.severity, m2.severity, 'medium') = 'high')::int as high_priority_pending,
      COUNT(*) FILTER (WHERE ri.status = 'pending' AND (m.must_revise = TRUE OR m2.must_revise = TRUE))::int as must_revise_pending
    FROM public.revision_items ri
    LEFT JOIN public.mistakes m ON ri.mistake_id = m.id
    LEFT JOIN public.mistakes m2 ON ri.mistake_id IS NULL AND ri.question_id = m2.question_id
    LEFT JOIN m_combined ON m_combined.id = COALESCE(ri.mistake_id, m2.id)
    WHERE ri.user_id = $1 ${dateConditionRevision} ${revisionPaperFilter}
  `;
  const { rows: revRows } = await query(revisionQuery, [userId]);
  const rAgg = revRows[0] || {};

  const dueToday = rAgg.due_today || 0;
  const overdue = rAgg.overdue || 0;
  const completedRevisions = rAgg.completed || 0;
  const pendingRevisions = rAgg.pending || 0;
  const highPriorityPending = rAgg.high_priority_pending || 0;
  const mustRevisePending = rAgg.must_revise_pending || 0;

  const totalRevisions = completedRevisions + pendingRevisions;
  const revisionCompletionRate = totalRevisions > 0 ? Math.round((completedRevisions / totalRevisions) * 100) : 0;

  // ── 5. IMPROVEMENT TRENDS ──
  // Calculate weak paper count and trends
  const trendMistakesCreated = totalOpen + totalResolved; // mistakes logged in this period
  const trendMistakesResolved = totalResolved;

  // ── 6. MENTOR PRESCRIPTION GENERATION ──
  let prescription = "";
  if (plannedBlocks === 0 && totalWritten === 0 && totalOpen === 0) {
    prescription = "No sufficient data found for this period. Start by completing study blocks and submitting one evaluated answer.";
  } else {
    const weakestPaper = topWeakPapers[0]?.paper || "General Studies";
    const mostRepeatedTypeRaw = repeatedTypes[0]?.type || "";
    // Format mistake type readable
    const mostRepeatedType = mostRepeatedTypeRaw
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    const bullets = [];
    if (executionRate < 60) {
      bullets.push(`Execution rate is currently low at ${executionRate}%. Focus on fully completing your planned study blocks before taking on extra tasks.`);
    }
    if (overdue > 0) {
      bullets.push(`You have ${overdue} overdue revision tasks. Today, allocate the first 20 minutes to clear these pending card reviews.`);
    }
    if (mustRevisePending > 0) {
      bullets.push(`There are ${mustRevisePending} critical 'Must Revise' pending mistakes. Prioritize reviewing these core conceptual gaps before writing new answers.`);
    }
    if (totalWritten > 0 && averageScore < 5.0) {
      bullets.push(`Your average score is ${averageScore}/10, which indicates a scope for styling and depth improvement. Focus on structural coherence and introducing standard case diagrams in ${weakestPaper}.`);
    }
    if (repeatedTypes.length > 0) {
      bullets.push(`Repeated errors of type '${mostRepeatedType}' detected. Focus on reviewing this weakness under ${weakestPaper} in your Mistake Book before submitting attempts.`);
    }

    if (bullets.length === 0) {
      bullets.push(`Execution is strong (${executionRate}%) and revisions are on track. Continue with your current study pattern and do a brief review of optional geography papers today.`);
    }
    prescription = bullets.join(" ");
  }

  return {
    execution: {
      plannedBlocks,
      completedBlocks,
      missedBlocks,
      executionRate,
      totalPlannedHours,
      totalCompletedHours,
      streak
    },
    answers: {
      totalWritten,
      averageScore,
      latestAttempts,
      trend: scoreTrend,
      paperSplit
    },
    mistakes: {
      totalOpen,
      totalResolved,
      mustRevise,
      highSeverity,
      repeatedTypes,
      topWeakPapers,
      topWeakAreas
    },
    revisions: {
      dueToday,
      overdue,
      completed: completedRevisions,
      completionRate: revisionCompletionRate,
      highPriorityPending,
      mustRevisePending
    },
    trends: {
      mistakesCreated: trendMistakesCreated,
      mistakesResolved: trendMistakesResolved,
      revisionsDue: totalRevisions,
      revisionsCompleted: completedRevisions
    },
    prescription
  };
}
