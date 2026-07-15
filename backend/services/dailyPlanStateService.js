import { query } from '../db/index.js';

/**
 * Resolves the plan state from blocks and plan events using deterministic precedence rules.
 * 
 * Classification precedence per block:
 * 1. Recovery Block
 * 2. System-generated Suggestion
 * 3. Proven User-plan Block
 * 4. Unknown
 * 
 * State resolution precedence:
 * - Any proven user block -> USER_PLAN_PRESENT
 * - Otherwise, no blocks -> NO_PLAN (or AMBIGUOUS if PLAN_ACCEPTED event exists)
 * - Otherwise, only recovery blocks -> RECOVERY_ONLY
 * - Otherwise, one or more system blocks and no unknown blocks -> SYSTEM_PLAN_ONLY
 * - Otherwise -> AMBIGUOUS
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.dayKey
 * @param {string} params.timezone
 * @param {Array<Object>} params.blocks
 * @param {Array<Object>} params.planEvents
 * @returns {Object} Resolved plan state
 */
export function resolveDailyPlanState({ userId, dayKey, blocks = [], planEvents = [] }) {
  const hasPlanAcceptedEvent = planEvents.some(
    e => e.event_type === 'PLAN_ACCEPTED' && 
         (e.metadata_json && String(e.metadata_json.date) === String(dayKey))
  );

  let userPlanBlockCount = 0;
  let recoveryBlockCount = 0;
  let systemGeneratedBlockCount = 0;
  let unknownBlockCount = 0;

  for (const b of blocks) {
    const isRecovery = b.block_type === 'recovery' || 
                       (b.block_id && String(b.block_id).startsWith('rec_')) ||
                       (b.source_meta && b.source_meta.is_recovery === true);

    if (isRecovery) {
      recoveryBlockCount++;
      continue;
    }

    const isSystem = ['system', 'placeholder', 'suggestion'].includes((b.source_type || '').toLowerCase()) ||
                     (b.source_meta && b.source_meta.is_system === true);

    if (isSystem) {
      systemGeneratedBlockCount++;
      continue;
    }

    const isUser = b.source_type === 'uploaded_plan' || 
                   b.source_type === 'user_uploaded' ||
                   (b.source_type === 'ocr' && hasPlanAcceptedEvent);

    if (isUser) {
      userPlanBlockCount++;
    } else {
      unknownBlockCount++;
    }
  }

  // Determine state precedence
  let state = 'AMBIGUOUS';

  if (userPlanBlockCount > 0) {
    state = 'USER_PLAN_PRESENT';
  } else if (blocks.length === 0) {
    state = hasPlanAcceptedEvent ? 'AMBIGUOUS' : 'NO_PLAN';
  } else if (recoveryBlockCount > 0 && systemGeneratedBlockCount === 0 && unknownBlockCount === 0) {
    state = 'RECOVERY_ONLY';
  } else if (systemGeneratedBlockCount > 0 && unknownBlockCount === 0) {
    state = 'SYSTEM_PLAN_ONLY';
  } else {
    state = 'AMBIGUOUS';
  }

  return {
    state,
    userPlanBlockCount,
    recoveryBlockCount,
    systemGeneratedBlockCount,
    evidence: {
      hasPlanAcceptedEvent,
      hasUploadedPlanBlocks: blocks.some(b => b.source_type === 'uploaded_plan'),
      totalBlocks: blocks.length,
      unknownBlockCount
    },
    userMessageKey: state
  };
}

export async function getDailyPlanState({ userId, dayKey, queryFn = query }) {
  // Query study_blocks where user_id = userId AND day_key = dayKey
  const { rows: blocks } = await queryFn(
    `SELECT id, block_id, day_key, title, subject, topic, planned_minutes, status, source_type, block_type, source_meta 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, dayKey]
  );

  // Query study_events where user_id = userId AND event_type = 'PLAN_ACCEPTED'
  const { rows: planEvents } = await queryFn(
    `SELECT id, event_type, metadata_json 
     FROM public.study_events 
     WHERE user_id = $1 AND event_type = 'PLAN_ACCEPTED'`,
    [userId]
  );

  return resolveDailyPlanState({ userId, dayKey, blocks, planEvents });
}

/**
 * Safe DB wrapper falling back to AMBIGUOUS on any error.
 */
export async function getSafeDailyPlanState({ userId, dayKey, queryFn = query }) {
  try {
    return await getDailyPlanState({ userId, dayKey, queryFn });
  } catch (err) {
    console.error("[getDailyPlanState ERROR] falling back to AMBIGUOUS:", err.message);
    return {
      state: 'AMBIGUOUS',
      userPlanBlockCount: 0,
      recoveryBlockCount: 0,
      systemGeneratedBlockCount: 0,
      evidence: {
        hasPlanAcceptedEvent: false,
        hasUploadedPlanBlocks: false,
        totalBlocks: 0,
        unknownBlockCount: 0,
        error: err.message
      },
      userMessageKey: 'AMBIGUOUS',
      diagnosticReason: 'PLAN_STATE_RESOLUTION_FAILED'
    };
  }
}

/**
 * Reminder decision helper.
 * Fired at 6 AM and 9 AM if plan is not USER_PLAN_PRESENT.
 */
export function shouldSendMissingPlanReminder(planState) {
  return planState.state !== 'USER_PLAN_PRESENT';
}

/**
 * Dynamic message builder.
 */
export function buildMissingPlanReminder({ planState, userName, notificationType }) {
  const dynamicName = userName || 'User';
  if (notificationType === 'PLAN_NOT_UPLOADED') {
    let msg = `Good morning ${dynamicName}.\n\nToday’s full study plan is still not uploaded.\n\nPlease upload or confirm it now so MentorOS can schedule your blocks and reminders correctly.`;
    if (planState.recoveryBlockCount > 0) {
      msg += `\n\nA recovery task is already available, but it is not a substitute for today’s complete plan.`;
    }
    return msg;
  } else if (notificationType === 'NO_PLAN_STRICT_9AM') {
    return `Your study plan is still pending.\n\nWithout today’s plan, MentorOS cannot accurately guide your schedule, priorities or review.\n\nPlease upload or confirm today’s plan now.`;
  }
  return '';
}
