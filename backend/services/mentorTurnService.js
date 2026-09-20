// backend/services/mentorTurnService.js
// Canonical MentorOS Turn Processor shared by HTTP routes and Voice Gateway.
// Guaranteed Single-Path Reasoning, Idempotency, and Persistence.

import { randomUUID as uuidv4 } from 'node:crypto';
import { query, withTransaction } from '../db/index.js';
import { generateMentorReply } from './aiAdapterService.js';
import { recordMentorTurnUsage } from './mentorUsageService.js';

export async function processMentorTurn({ userId, sessionId, userMessage, requestId, stage = null }) {
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    const err = new Error('Message content is required');
    err.statusCode = 400;
    throw err;
  }

  if (!requestId) {
    const err = new Error('requestId is required for idempotency');
    err.statusCode = 400;
    throw err;
  }

  const { rows: sessions } = await query(
    `SELECT * FROM public.mentor_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  if (sessions.length === 0) {
    const err = new Error('Session not found or unauthorized');
    err.statusCode = 403;
    throw err;
  }

  const session = sessions[0];

  if (session.status === 'completed') {
    const err = new Error('Cannot modify completed session');
    err.statusCode = 400;
    throw err;
  }

  const { rows: history } = await query(
    `SELECT role, content, stage FROM public.mentor_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );

  // Rate limit to 40 messages total (20 turns)
  if (history.length >= 40) {
    const err = new Error('Session rate limit exceeded');
    err.statusCode = 429;
    throw err;
  }

  return await withTransaction(async (client) => {
    // Check idempotency: if request_id already processed
    const { rows: existingMsg } = await client.query(
      `SELECT stage, content, metadata FROM public.mentor_messages WHERE session_id = $1 AND request_id = $2 AND role = 'user'`,
      [sessionId, requestId]
    );

    if (existingMsg.length > 0) {
      const { rows: latestMentor } = await client.query(
        `SELECT content, metadata FROM public.mentor_messages WHERE session_id = $1 AND role = 'mentor' ORDER BY created_at DESC LIMIT 1`,
        [sessionId]
      );

      const meta = latestMentor[0]?.metadata || {};
      return {
        mentorReply: latestMentor[0]?.content || '',
        source: meta.source || 'ai',
        metadata: process.env.NODE_ENV !== 'production' ? meta : undefined,
        session: { id: session.id, current_stage: session.current_stage, status: session.status }
      };
    }

    if (stage && session.current_stage !== stage) {
      const err = new Error('INVALID_STAGE');
      err.statusCode = 400;
      throw err;
    }

    // Save canonical user message
    await client.query(
      `INSERT INTO public.mentor_messages (id, session_id, role, content, stage, request_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), sessionId, 'user', userMessage.trim(), session.current_stage, requestId]
    );

    // Call authoritative AI reasoning (DeepSeek V4.1 Flash)
    const reply = await generateMentorReply({
      profile: session.mentor_state_snapshot?.student,
      mentorState: session.mentor_state_snapshot,
      conversationHistory: history,
      currentStage: session.current_stage,
      userMessage: userMessage.trim()
    });

    const nextStage = reply.nextStage || session.current_stage;
    const modelMeta = reply.modelMetadata || {};
    modelMeta.source = reply.source;

    // Save canonical mentor message
    await client.query(
      `INSERT INTO public.mentor_messages (id, session_id, role, content, stage, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), sessionId, 'mentor', reply.message, nextStage, JSON.stringify(modelMeta)]
    );

    // Update session stage & extracted commitments
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (nextStage !== session.current_stage) {
      updateFields.push(`current_stage = $${paramIndex++}`);
      updateValues.push(nextStage);
      session.current_stage = nextStage;
    }

    if (reply.extracted) {
      for (const [key, val] of Object.entries(reply.extracted)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        updateValues.push(val);
        session[key] = val;
      }
    }

    if (updateFields.length > 0) {
      updateValues.push(sessionId);
      await client.query(
        `UPDATE public.mentor_sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }

    // Asynchronously record turn token usage in mentor_ai_usage
    if (modelMeta.usage) {
      recordMentorTurnUsage({
        userId,
        sessionId,
        provider: modelMeta.provider || 'deepseek',
        model: modelMeta.model || 'deepseek-flash',
        usage: modelMeta.usage,
        metadata: { stage: session.current_stage, nextStage }
      }).catch(err => console.error('[MentorTurn] Usage tracking error:', err.message));
    }

    return {
      mentorReply: reply.message,
      source: reply.source,
      metadata: process.env.NODE_ENV !== 'production' ? modelMeta : undefined,
      session: {
        id: session.id,
        current_stage: session.current_stage,
        status: session.status
      }
    };
  });
}
