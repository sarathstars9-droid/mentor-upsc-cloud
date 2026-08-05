import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMentorState } from '../services/mentorStateService.js';
import { randomUUID as uuidv4 } from 'node:crypto';
import { query, withTransaction } from '../db/index.js';
import { generateMentorReply } from '../services/aiAdapterService.js';

const router = express.Router();

router.use(requireAuth);

router.get('/state/today', async (req, res) => {
  try {
    const dayKey = req.query.dayKey || new Date().toISOString().split('T')[0];
    const state = await getMentorState(req.user.id, dayKey);
    res.json(state);
  } catch (error) {
    console.error('[MentorRoute] Error fetching mentor state:', error);
    res.status(500).json({ error: 'Failed to fetch mentor state' });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const dayKey = req.body.dayKey || new Date().toISOString().split('T')[0];
    const state = await getMentorState(req.user.id, dayKey);
    const sessionId = uuidv4();

    await query(
      `INSERT INTO public.mentor_sessions (id, user_id, day_key, mentor_state_snapshot, current_stage)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, req.user.id, dayKey, JSON.stringify(state), 'energy']
    );

    const initialMessage = {
      role: 'mentor',
      content: state.conversationContext.openingQuestion
    };

    await query(
      `INSERT INTO public.mentor_messages (id, session_id, role, content, stage)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), sessionId, 'mentor', initialMessage.content, 'energy']
    );

    res.status(201).json({
      session: {
        id: sessionId,
        user_id: req.user.id,
        current_stage: 'energy'
      },
      initialMessage
    });
  } catch (error) {
    console.error('[MentorRoute] Error creating session:', error);
    res.status(500).json({ error: 'Failed to create mentor session' });
  }
});

router.post('/sessions/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, stage, requestId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required for idempotency' });
    }

    const { rows: sessions } = await query(
      `SELECT * FROM public.mentor_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id]
    );

    if (sessions.length === 0) return res.status(403).json({ error: 'Session not found' });
    const session = sessions[0];

    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify completed session' });
    }

    const { rows: history } = await query(
      `SELECT role, content, stage FROM public.mentor_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    // Limit to 40 messages total (20 turns)
    if (history.length >= 40) {
      return res.status(429).json({ error: 'Session rate limit exceeded' });
    }

    const result = await withTransaction(async (client) => {
      // Check idempotency
      const { rows: existingMsg } = await client.query(
        `SELECT stage, content, metadata FROM public.mentor_messages WHERE session_id = $1 AND request_id = $2 AND role = 'user'`,
        [sessionId, requestId]
      );

      if (existingMsg.length > 0) {
        // Already processed. Just return the current state and latest mentor reply
        const { rows: latestMentor } = await client.query(
          `SELECT content, metadata FROM public.mentor_messages WHERE session_id = $1 AND role = 'mentor' ORDER BY created_at DESC LIMIT 1`,
          [sessionId]
        );

        const meta = latestMentor[0]?.metadata || {};
        return {
          mentorReply: latestMentor[0]?.content || '',
          source: meta.source || 'ai',
          session: { id: session.id, current_stage: session.current_stage, status: session.status }
        };
      }

      if (stage && session.current_stage !== stage) {
        throw new Error('INVALID_STAGE');
      }

      // Save user message
      await client.query(
        `INSERT INTO public.mentor_messages (id, session_id, role, content, stage, request_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), sessionId, 'user', message, session.current_stage, requestId]
      );

      // AI Adapter generates reply based on stage and state
      const reply = await generateMentorReply({
        profile: session.mentor_state_snapshot?.student,
        mentorState: session.mentor_state_snapshot,
        conversationHistory: history,
        currentStage: session.current_stage,
        userMessage: message
      });

      const nextStage = reply.nextStage || session.current_stage;

      const modelMeta = reply.modelMetadata || {};
      modelMeta.source = reply.source; // store source in metadata

      // Save mentor message
      await client.query(
        `INSERT INTO public.mentor_messages (id, session_id, role, content, stage, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), sessionId, 'mentor', reply.message, nextStage, JSON.stringify(modelMeta)]
      );

      // Update stage and commitment details based on AI parsing
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

      return {
        mentorReply: reply.message,
        source: reply.source,
        session: {
          id: session.id,
          current_stage: session.current_stage,
          status: session.status
        }
      };
    });

    res.json(result);
  } catch (error) {
    if (error.message === 'INVALID_STAGE') {
      return res.status(400).json({ error: 'Invalid stage transition' });
    }
    console.error('[MentorRoute] Error handling message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

router.post('/sessions/:sessionId/commit', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rows: sessions } = await query(
      `SELECT * FROM public.mentor_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id]
    );

    if (sessions.length === 0) return res.status(403).json({ error: 'Session not found or unauthorized' });

    await query(
      `UPDATE public.mentor_sessions
       SET status = 'completed', completed_at = NOW(), current_stage = 'completed'
       WHERE id = $1`,
      [sessionId]
    );

    res.json({ status: 'completed' });
  } catch (error) {
    console.error('[MentorRoute] Error committing session:', error);
    res.status(500).json({ error: 'Failed to commit session' });
  }
});

router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rows: sessions } = await query(
      `SELECT * FROM public.mentor_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id]
    );

    if (sessions.length === 0) return res.status(403).json({ error: 'Session not found or unauthorized' });

    const { rows: messages } = await query(
      `SELECT role, content, stage, created_at FROM public.mentor_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    res.json({ session: sessions[0], messages });
  } catch (error) {
    console.error('[MentorRoute] Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
