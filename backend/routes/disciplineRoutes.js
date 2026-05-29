import express from 'express';
import * as rescueModeService from '../services/rescueModeService.js';
import * as disciplineEventService from '../services/disciplineEventService.js';

const router = express.Router();

router.post('/rescue/start', async (req, res) => {
  const userId = req.body.userId || 'moulika';
  const result = await rescueModeService.startRescueMode(userId);
  if (result.success) {
    return res.json({ ok: true, message: result.message });
  }
  return res.status(500).json({ ok: false, error: result.error });
});

router.post('/events/untracked-log', async (req, res) => {
  const userId = req.body.userId || 'moulika';
  const { dateKey, textReply, eventId } = req.body;
  
  const id = await disciplineEventService.createUntrackedStudyLog(userId, dateKey, textReply, eventId);
  if (id) {
    if (eventId) {
      await disciplineEventService.resolveEvent(eventId, { resolved_via: 'api' });
    }
    return res.json({ ok: true, id });
  }
  return res.status(500).json({ ok: false, error: 'Failed to create untracked study log' });
});

export default router;
