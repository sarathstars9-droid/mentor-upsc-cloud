import { query } from '../db/index.js';
import { getDailyExecutionSummary } from './dailyExecutionSummaryService.js';
import { sendNotification } from './notificationService.js';
import { formatHoursAndMins } from './reportGeneratorService.js';
import * as telegramService from './telegramService.js';
import { formatSubjectTopic } from './computeBlockState.js';

function getYesterdayKeyFromDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function generateNightMentorReviewMessage(userId, dayKey) {
  const summary = await getDailyExecutionSummary(userId, dayKey);
  const userRes = await query(`SELECT name FROM public.users WHERE id = $1`, [userId]);
  const userName = userRes.rows[0]?.name || "Moulika";

  // Check if study_blocks data exists for this day
  const hasData = summary.totalBlocks > 0;

  let achievements = "";
  let misses = "";
  let mentorObservation = "";
  let recommendedFirstBlock = "";
  let reflectionQuestion = "";
  let achievementsJson = {};
  let missesJson = {};

  if (!hasData) {
    // No study blocks registered for today
    achievements = "No study blocks were planned for today.";
    misses = "No study tasks were registered.";
    mentorObservation = `You spent the day without a plan. Flying blind is the easiest way to waste time. A serious candidate does not start the day without knowing what to execute.`;
    recommendedFirstBlock = "Set up a structured schedule for tomorrow. Start with 60m of Geography Optional or a core GS subject.";
    reflectionQuestion = "Why did you skip planning your study day today?";
    
    achievementsJson = {
      studied_hours: 0,
      planned_hours: 0,
      blocks_completed: 0,
      blocks_total: 0,
      subjects_completed: []
    };
    
    missesJson = {
      blocks_missed: 0,
      subjects_postponed: [],
      missed_details: []
    };
  } else {
    // Achievements calculation
    const studiedHrs = summary.studiedMinutes / 60;
    const plannedHrs = summary.plannedMinutes / 60;
    const completedBlocks = summary.completedBlocks;
    const totalBlocks = summary.totalBlocks;
    
    const completedBlocksList = summary.blockRows.filter(b => b.isCompleted);
    
    achievementsJson = {
      studied_hours: Number(studiedHrs.toFixed(2)),
      planned_hours: Number(plannedHrs.toFixed(2)),
      blocks_completed: completedBlocks,
      blocks_total: totalBlocks,
      subjects_completed: summary.subjectsCompleted,
      completed_details: completedBlocksList.map(b => ({
        subject: b.subject,
        topic: b.title || b.topic,
        actual_minutes: b.actualMinutes || b.effectiveMinutes
      }))
    };

    achievements = `• studied hours: ${formatHoursAndMins(studiedHrs)} (Planned: ${formatHoursAndMins(plannedHrs)})\n` +
                   `• blocks completed: ${completedBlocks}/${totalBlocks}\n` +
                   `• subjects completed: ${summary.subjectsCompleted.length > 0 ? summary.subjectsCompleted.join(', ') : 'None'}`;

    // Misses calculation
    const missedBlocksList = summary.blockRows.filter(b => b.isMissed);
    const missedSubjectDetails = missedBlocksList.map(b => b.title);
    
    // Postponed subjects must come from the same canonical classification logic.
    // So postponedSubjects is the list of unique subjects of the missed/postponed blocks.
    const postponedSubjects = [...new Set(missedBlocksList.map(b => b.subject).filter(Boolean))];

    // Repeated avoidance patterns
    const repeatedAvoidance = [];
    try {
      const pastBlocksRes = await query(
        `SELECT subject, status FROM public.study_blocks
         WHERE user_id = $1
           AND day_key >= ($2::DATE - INTERVAL '7 days')::TEXT
           AND day_key < $2::TEXT
         ORDER BY day_key DESC`,
        [userId, dayKey]
      );
      
      const pastMisses = {};
      for (const b of pastBlocksRes.rows) {
        const sub = b.subject;
        if (!sub) continue;
        const st = (b.status || '').toLowerCase();
        if (['missed', 'skipped'].includes(st)) {
          pastMisses[sub] = (pastMisses[sub] || 0) + 1;
        }
      }

      // Check postponed or missed subjects today
      for (const sub of postponedSubjects) {
        const missesCount = pastMisses[sub] || 0;
        if (missesCount >= 2) {
          repeatedAvoidance.push(sub);
        }
      }
    } catch (err) {
      console.error('[MentorReviewService] Repeated avoidance check failed:', err.message);
    }

    missesJson = {
      blocks_missed: missedBlocksList.length,
      subjects_postponed: postponedSubjects,
      missed_details: missedBlocksList.map(b => ({
        subject: b.subject,
        topic: b.title || b.topic,
        planned_minutes: b.plannedMinutes
      })),
      repeated_avoidance: repeatedAvoidance
    };

    const missesLines = [];
    if (missedBlocksList.length > 0) {
      missesLines.push(`• missed blocks: ${missedBlocksList.length} (${missedSubjectDetails.join(', ')})`);
    } else {
      missesLines.push(`• missed blocks: 0`);
    }
    if (postponedSubjects.length > 0) {
      missesLines.push(`• subjects postponed: ${postponedSubjects.join(', ')}`);
    }
    if (repeatedAvoidance.length > 0) {
      missesLines.push(`• repeated avoidance pattern: ${repeatedAvoidance.join(', ')} is slipping. You avoided it multiple times this week.`);
    }
    misses = missesLines.join('\n');

    // Mentor observation & Reflection question & Recommended first block
    const executionRate = summary.executionRate;
    if (executionRate >= 95) {
      mentorObservation = `Flawless execution today, ${userName}. You sat down, followed the plan, and got it done. This is the level of discipline required to clear this exam. But remember: tomorrow is a fresh start. Don't let today's victory make you complacent.`;
      reflectionQuestion = `How did you manage to stay so focused today, and how can we replicate this tomorrow?`;
      recommendedFirstBlock = summary.blockRows[0]?.subject || "Geography Optional";
    } else if (executionRate >= 70) {
      mentorObservation = `Solid effort today, but we let a few areas slip. You got the main blocks done, but that last block was left out. Consistency isn't just about doing what's easy. It's about doing what is scheduled.`;
      reflectionQuestion = `What was the main reason you couldn't finish the last block today?`;
      recommendedFirstBlock = missedBlocksList[0]?.subject || summary.blockRows[0]?.subject || "CSAT";
    } else if (executionRate >= 40) {
      mentorObservation = `A compromised day. You studied, but the execution was partial. Only ${completedBlocks} out of ${totalBlocks} blocks were completed. Let's rebuild focus tomorrow.`;
      reflectionQuestion = `Why did your momentum drop in the afternoon?`;
      recommendedFirstBlock = missedBlocksList[0]?.subject || "Geography Optional";
    } else if (executionRate > 0) {
      mentorObservation = `This was a struggle. You touched the books, but only did ${formatHoursAndMins(studiedHrs)} out of ${formatHoursAndMins(plannedHrs)} planned. Let's make sure we start tomorrow's blocks on time to rebuild momentum.`;
      reflectionQuestion = `What got in the way of starting your scheduled blocks today?`;
      recommendedFirstBlock = missedBlocksList[0]?.subject || "Geography Optional";
    } else {
      // 0% study
      mentorObservation = `A complete zero day. The plan was there, but execution did not begin. Remember, starting is the hardest part. Let's start tomorrow with just one small 25-minute block to break the inertia.`;
      reflectionQuestion = `What caused this total block today? Let's trace it honestly.`;
      recommendedFirstBlock = missedBlocksList[0]?.subject || "Geography Optional";
    }
  }

  // Save to database
  await query(
    `INSERT INTO public.daily_mentor_reviews (
       user_id, date, achievements_json, misses_json, mentor_observation, 
       recommended_first_block, reflection_question, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id, date) DO UPDATE SET
       achievements_json = EXCLUDED.achievements_json,
       misses_json = EXCLUDED.misses_json,
       mentor_observation = EXCLUDED.mentor_observation,
       recommended_first_block = EXCLUDED.recommended_first_block,
       reflection_question = EXCLUDED.reflection_question,
       created_at = NOW()`,
    [
      userId, dayKey, JSON.stringify(achievementsJson), JSON.stringify(missesJson),
      mentorObservation, recommendedFirstBlock, reflectionQuestion
    ]
  );

  // Build the review text
  let reviewText = `🌙 ${userName}, today's review.

First, the good side:
${achievements}

Now the uncomfortable part:
${misses}

My observation:
${mentorObservation}

Tomorrow's first priority:
${recommendedFirstBlock}

One question:
${reflectionQuestion}

Reply with the number that best matches the reason:
1 Fear
2 Confusion
3 Tiredness
4 Distraction
5 Family/Health
6 Didn't know where to start`;

  return { reviewText, achievementsJson, missesJson, mentorObservation, recommendedFirstBlock, reflectionQuestion };
}

export async function sendNightMentorReview(userId, dayKey) {
  const { reviewText } = await generateNightMentorReviewMessage(userId, dayKey);

  // Send via Telegram
  const { rows: channels } = await query(
    `SELECT destination_id FROM public.notification_channels 
     WHERE user_id = $1 AND channel_type = 'TELEGRAM' AND is_enabled = TRUE LIMIT 1`,
    [userId]
  );

  if (channels.length > 0) {
    const chatId = channels[0].destination_id;
    await telegramService.sendMessage(chatId, reviewText);
    
    // Log as sent in notification_events manually
    await query(
      `INSERT INTO public.notification_events 
         (user_id, notification_type, source_type, source_id, channel_type, status, sent_at)
       VALUES ($1, 'NIGHT_MENTOR_REVIEW', 'daily_date', $2, 'TELEGRAM', 'sent', NOW())
       ON CONFLICT (user_id, notification_type, source_type, source_id, channel_type) 
       DO UPDATE SET status = 'sent', sent_at = NOW()`,
      [userId, dayKey]
    );
    return true;
  }
  return false;
}

export async function generateMorningRecallMessage(userId, date) {
  const yesterdayKey = getYesterdayKeyFromDate(date);
  
  // Try retrieving saved nightly review first
  const { rows } = await query(
    `SELECT * FROM public.daily_mentor_reviews 
     WHERE user_id = $1 AND date = $2`,
    [userId, yesterdayKey]
  );
  
  let yesterdayCompleted = "";
  let yesterdayMissed = "";
  let recommendedFirstBlock = "";
  
  if (rows.length > 0) {
    const review = rows[0];
    const achievements = review.achievements_json || {};
    const misses = review.misses_json || {};
    
    // completed
    if (achievements.completed_details && achievements.completed_details.length > 0) {
      yesterdayCompleted = achievements.completed_details.map(d => `- ${formatSubjectTopic(d.subject, d.topic)}`).join('\n');
    } else {
      yesterdayCompleted = "- No study blocks completed.";
    }
    
    // missed
    if (misses.missed_details && misses.missed_details.length > 0) {
      yesterdayMissed = misses.missed_details.map(d => `- ${formatSubjectTopic(d.subject, d.topic)}`).join('\n');
    } else {
      yesterdayMissed = "- No missed tasks.";
    }
    
    recommendedFirstBlock = review.recommended_first_block || "Geography Optional";
  } else {
    // If review not found in DB, try to calculate on-the-fly from study_blocks
    try {
      const summary = await getDailyExecutionSummary(userId, yesterdayKey);
      if (summary.totalBlocks > 0) {
        const completedList = summary.blockRows.filter(b => b.isCompleted);
        const missedList = summary.blockRows.filter(b => b.isMissed);
        
        if (completedList.length > 0) {
          yesterdayCompleted = completedList.map(b => `- ${formatSubjectTopic(b.subject, b.title || b.topic)}`).join('\n');
        } else {
          yesterdayCompleted = "- No study blocks completed.";
        }
        
        if (missedList.length > 0) {
          yesterdayMissed = missedList.map(b => `- ${formatSubjectTopic(b.subject, b.title || b.topic)}`).join('\n');
          recommendedFirstBlock = missedList[0].subject;
        } else {
          yesterdayMissed = "- No missed tasks.";
          recommendedFirstBlock = summary.blockRows[0]?.subject || "Geography Optional";
        }
      } else {
        // Human fallback when absolutely no data
        return `Good. Plan received.

Before you begin, remember: we don't have study logs or reviews from yesterday. Let's make sure today is tracked from block 1.

Do not start with an easy comfort topic.

Press Start.`;
      }
    } catch (err) {
      console.error('[MentorReviewService] Fallback calculation failed:', err.message);
      return `Good. Plan received.

Before you begin, remember: we don't have study logs or reviews from yesterday. Let's make sure today is tracked from block 1.

Do not start with an easy comfort topic.

Press Start.`;
    }
  }

  if (yesterdayMissed.includes("No missed tasks")) {
    return `Good. Plan received.

Before you begin, remember yesterday.

You completed:
${yesterdayCompleted}

No missed tasks yesterday. Start today with your first planned priority: ${recommendedFirstBlock}.

Press Start.`;
  }

  return `Good. Plan received.

Before you begin, remember yesterday.

You completed:
${yesterdayCompleted}

But you missed:
${yesterdayMissed}

So today's first block should repair that gap:
${recommendedFirstBlock}

Do not start with an easy comfort topic if yesterday's important work is still pending.

Press Start.`;
}

export async function handleMentorReviewReply(userId, option) {
  const optionMap = {
    '1': 'Fear',
    '2': 'Confusion',
    '3': 'Tiredness',
    '4': 'Distraction',
    '5': 'Family/Health',
    '6': "Didn't know where to start"
  };

  const choice = optionMap[option];
  if (!choice) return null;

  const userRes = await query(`SELECT name FROM public.users WHERE id = $1`, [userId]);
  const userName = userRes.rows[0]?.name || "Moulika";

  const replyTextMap = {
    '1': `Fear of failure or fear of not understanding the topic is common, ${userName}. But avoiding the block only makes the fear grow. Tomorrow, we will start with just 10 minutes. No perfection, just sit down.`,
    '2': `Confusion means the material is challenging or the next step isn't clear. Don't try to master it in one go, ${userName}. Break it down, write a simple summary, or check a PYQ explanation first. Let's tackle it slowly tomorrow.`,
    '3': `Tiredness is a real signal. If you were exhausted today, ${userName}, rest was the right decision. But make sure it doesn't become a pattern of escaping. Sleep early tonight and start fresh tomorrow.`,
    '4': `Distraction is the enemy of focus, ${userName}. The phone, social media, or other tasks. Tomorrow, when you start the block, keep all notifications off and place the phone in another room. Protect your study space.`,
    '5': `Family and health must come first. Don't beat yourself up for missing blocks due to genuine emergencies, ${userName}. Take care of what's important, and return to the desk when you can with a clear mind.`,
    '6': `Not knowing where to start usually means the block's scope was too broad, ${userName}. Tomorrow, write down exactly one resource and page number you will open. Clear the ambiguity before starting.`
  };

  // Find latest review for user
  const { rows } = await query(
    `SELECT date, user_reply FROM public.daily_mentor_reviews 
     WHERE user_id = $1 
     ORDER BY date DESC LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    return `I couldn't find any recent mentor reviews to record your reply for. Let's focus on tomorrow's plan!`;
  }

  const latestReview = rows[0];
  
  // Update the reply
  await query(
    `UPDATE public.daily_mentor_reviews 
     SET user_reply = $1 
     WHERE user_id = $2 AND date = $3`,
    [choice, userId, latestReview.date]
  );

  return replyTextMap[option];
}
