import { query } from '../db/index.js';
import { MOULIKA_PROFILE } from './mentorProfile.js';
import { detectStaleSession } from '../utils/staleSessionUtils.js';

export function buildMentorCommand({ profile, blocks, pendingBlocks, staleBlock, activeBlock, pausedBlock, hasPreviousDayLeakage }) {
  const csatBlock = pendingBlocks.find(b => (b.subject && b.subject.toUpperCase().includes('CSAT')) || (b.title && b.title.toUpperCase().includes('CSAT')));
  const revisionBlock = pendingBlocks.find(b => (b.subject && b.subject.toUpperCase().includes('REVISION')) || (b.title && b.title.toUpperCase().includes('REVISION')));
  const firstPending = pendingBlocks[0];

  let mentorCommand = null;

  if (staleBlock) {
    mentorCommand = {
      priority: 'high',
      title: 'Stale Session Recovery Required',
      instruction: 'Resolve the earlier open study session before starting new work.',
      reason: 'A session was left running for too long and is now considered stale. It blocks further tracking.',
      evidence: [staleBlock.title || staleBlock.subject],
      completionProof: 'Session is stopped, confirmed, or abandoned.',
      mustNotStart: 'Any new block.'
    };
  } else if (activeBlock) {
    mentorCommand = {
      priority: 'high',
      title: 'Active Block in Progress',
      instruction: `Continue the active ${activeBlock.subject || 'task'}. Do not open a second task.`,
      reason: 'Focusing on one task prevents context switching and maintains quality.',
      evidence: [activeBlock.title || activeBlock.subject],
      completionProof: 'The current block is marked complete.',
      mustNotStart: 'Any new block.'
    };
  } else if (pausedBlock) {
    mentorCommand = {
      priority: 'high',
      title: 'Paused Block Waiting',
      instruction: 'Decide whether to resume or stop the paused block before moving forward.',
      reason: 'A paused block is occupying your schedule and preventing new commitments.',
      evidence: [pausedBlock.title || pausedBlock.subject],
      completionProof: 'The block is resumed or stopped.',
      mustNotStart: 'Any new block.'
    };
  } else if (hasPreviousDayLeakage && pendingBlocks.length > 0) {
    mentorCommand = {
      priority: 'medium',
      title: 'Previous Day Leakage',
      instruction: 'You have unfinished work from yesterday. Address it or formally drop it before proceeding with today’s plan.',
      reason: 'Carrying over debt destroys your execution standard.',
      evidence: ['Incomplete blocks from yesterday'],
      completionProof: 'Leakage addressed.',
      mustNotStart: 'None.'
    };
  } else if (csatBlock) {
    mentorCommand = {
      priority: 'high',
      title: 'CSAT Risk',
      instruction: 'Complete today’s CSAT block before optional subject expansion.',
      reason: 'CSAT instability is a known weakness that requires consistent practice.',
      evidence: [csatBlock.title || csatBlock.subject],
      completionProof: 'CSAT block is completed.',
      mustNotStart: 'Any new non-CSAT block.'
    };
  } else if (revisionBlock) {
    mentorCommand = {
      priority: 'high',
      title: 'Revision Due',
      instruction: 'Complete your pending revision block.',
      reason: 'Revision is critical to retaining information.',
      evidence: [revisionBlock.title || revisionBlock.subject],
      completionProof: 'Revision block is completed.',
      mustNotStart: 'New subjects before revision.'
    };
  } else if (firstPending) {
    mentorCommand = {
      priority: 'normal',
      title: 'Next Scheduled Block',
      instruction: `Start your next block: ${firstPending.title || firstPending.subject}.`,
      reason: 'This is the next logical step in your plan.',
      evidence: [firstPending.title || firstPending.subject],
      completionProof: 'Block is completed.',
      mustNotStart: 'Blocks out of sequence unnecessarily.'
    };
  } else if (blocks.length === 0) {
    mentorCommand = {
      priority: 'critical',
      title: 'No Accepted Plan',
      instruction: 'Upload and accept today’s plan before beginning execution.',
      reason: 'You cannot execute effectively without a schedule.',
      evidence: [],
      completionProof: 'Plan is generated and accepted.',
      mustNotStart: 'Any tracking.'
    };
  } else {
    mentorCommand = {
      priority: 'normal',
      title: 'Day Complete',
      instruction: 'Today’s accepted plan is complete. Record the night review and stop.',
      reason: 'Rest is necessary for consistent performance.',
      evidence: ['All blocks completed'],
      completionProof: 'Night review submitted.',
      mustNotStart: 'Extra work without explicit override.'
    };
  }

  return mentorCommand;
}

export async function getMentorState(userId, dayKey) {
  // 1. Fetch today's plan
  const { rows: blocks } = await query(
    `SELECT * FROM public.study_blocks WHERE user_id = $1 AND day_key = $2 ORDER BY planned_start ASC, updated_at ASC`,
    [userId, dayKey]
  );

  let activeBlock = null;
  let pausedBlock = null;
  let staleBlock = null;
  const pendingBlocks = [];
  const completedBlocks = [];
  let plannedMinutes = 0;
  let completedMinutes = 0;

  for (const block of blocks) {
    plannedMinutes += block.planned_minutes || 0;
    
    if (block.status === 'completed' || block.status === 'done') {
      completedBlocks.push(block);
      completedMinutes += block.actual_minutes || 0;
      continue;
    }

    if (block.status === 'active' || block.status === 'paused') {
      const staleData = detectStaleSession(block, new Date().toISOString());
      if (staleData.isStale) {
        staleBlock = block;
        continue;
      }
      if (block.status === 'active') activeBlock = block;
      if (block.status === 'paused') pausedBlock = block;
      continue;
    }

    if (['planned', 'upcoming', 'skipped_rescue'].includes(block.status)) {
      pendingBlocks.push(block);
    }
  }

  // Check previous day incomplete work
  const [yyyy, mm, dd] = dayKey.split('-').map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterdayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  
  const { rows: yesterdayBlocks } = await query(
    `SELECT * FROM public.study_blocks WHERE user_id = $1 AND day_key = $2 AND status IN ('planned', 'upcoming', 'active', 'paused') LIMIT 1`,
    [userId, yesterdayKey]
  );
  const hasPreviousDayLeakage = yesterdayBlocks.length > 0;

  const mentorCommand = buildMentorCommand({
    profile: MOULIKA_PROFILE,
    blocks,
    pendingBlocks,
    staleBlock,
    activeBlock,
    pausedBlock,
    hasPreviousDayLeakage
  });

  const executionPercent = plannedMinutes > 0 ? Math.round((completedMinutes / plannedMinutes) * 100) : 0;
  const cappedPercent = executionPercent > 100 ? 100 : executionPercent;

  return {
    generatedAt: new Date().toISOString(),
    dayKey,
    student: {
      name: MOULIKA_PROFILE.name,
      primaryGoal: MOULIKA_PROFILE.primaryGoal,
      strategicTarget: MOULIKA_PROFILE.strategicTarget
    },
    today: {
      plannedBlocks: blocks.length,
      completedBlocks: completedBlocks.length,
      activeBlock,
      pausedBlock,
      pendingBlocks,
      plannedMinutes,
      completedMinutes,
      executionPercent: cappedPercent
    },
    risks: [],
    mentorCommand,
    conversationContext: {
      openingQuestion: 'Good morning, Moulika. Before we begin, tell me honestly—how is your energy today: low, medium, or high?',
      followUpQuestions: [],
      commitmentQuestion: 'What will you commit to completing first?'
    }
  };
}
