import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

// GET /api/notifications/unread?userId=...
router.get('/unread', async (req, res) => {
  const userId = req.query.userId?.toLowerCase()?.trim();
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required' });
  }

  try {
    const unreadRes = await query(
      `SELECT 
        id, 
        notification_type AS type, 
        source_id AS "sourceId", 
        payload_json, 
        created_at AS "createdAt"
       FROM public.notification_events
       WHERE user_id = $1 
         AND channel_type = 'IN_APP' 
         AND status = 'sent'
       ORDER BY created_at DESC`,
      [userId]
    );

    const notifications = unreadRes.rows.map(row => {
      // Create a friendly message from payload if available, else generic
      let message = row.payload_json?.alertText || "You have a new notification.";
      let title = "Notification";
      let severity = "info";

      if (row.type === 'DISTRACTION_ALERT') {
        title = "Focus Drift Detected";
        severity = "warning";
        message = row.payload_json?.message || `You have been distracted for ${row.payload_json?.totalMinutes || 0} minutes by ${row.payload_json?.topApp || 'an app'}. Return to mission now.`;
      }

      return {
        id: row.id,
        type: row.type,
        title,
        message,
        severity,
        createdAt: row.createdAt,
        sourceId: row.sourceId
      };
    });

    return res.json({ ok: true, notifications });
  } catch (err) {
    console.error('[GET /notifications/unread] Error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId is required in body' });
  }

  try {
    await query(
      `UPDATE public.notification_events
       SET status = 'read'
       WHERE id = $1 AND user_id = $2 AND channel_type = 'IN_APP'`,
      [id, userId.toLowerCase().trim()]
    );
    return res.json({ ok: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error('[POST /notifications/:id/read] Error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
