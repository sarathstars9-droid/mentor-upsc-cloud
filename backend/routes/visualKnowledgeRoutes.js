/**
 * backend/routes/visualKnowledgeRoutes.js
 *
 * REST API Router for Shared Visual Knowledge Layer (Phase 2B).
 * Base path: /api/visual-knowledge
 */

import express from 'express';
import {
  searchTopics,
  resolveTopicByQuery,
  getTopicVisualPack,
  getVisualAssetById,
  setUserVisualState,
  getUserVisualState,
  findMatchingVisualForQuestion
} from '../services/visualKnowledge/visualKnowledgeService.js';
import { generateVisualPackForTopic } from '../services/visualGeneration/visualGenerationService.js';

const router = express.Router();

/**
 * GET /api/visual-knowledge/topics/search
 * Search knowledge topics with keyword & filters.
 */
router.get('/topics/search', async (req, res) => {
  try {
    const { q = '', examContext = 'both', region = null } = req.query;
    const topics = await searchTopics(q, { examContext, region });
    res.json({
      success: true,
      total: topics.length,
      topics
    });
  } catch (err) {
    console.error('[VisualKnowledge API] GET /topics/search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/visual-knowledge/topics/resolve
 * Resolve a query string to a canonical topic.
 */
router.post('/topics/resolve', async (req, res) => {
  try {
    const { queryText } = req.body;
    const topic = await resolveTopicByQuery(queryText);
    if (!topic) {
      return res.json({
        success: true,
        resolved: false,
        message: 'No matching canonical topic found in Visual Knowledge catalog.'
      });
    }
    res.json({
      success: true,
      resolved: true,
      topic
    });
  } catch (err) {
    console.error('[VisualKnowledge API] POST /topics/resolve error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/visual-knowledge/topics/:topicId/visual-pack
 * Get full visual pack and linked official evidence for a topic.
 */
router.get('/topics/:topicId/visual-pack', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { examContext = 'both', region = null } = req.query;
    const userId = req.headers['x-user-id'] || req.user?.id || 'moulika';

    const pack = await getTopicVisualPack(topicId, {
      examContext,
      region,
      userId
    });

    if (!pack) {
      return res.status(404).json({ success: false, error: 'Topic not found in visual knowledge repository.' });
    }

    res.json({
      success: true,
      ...pack
    });
  } catch (err) {
    console.error('[VisualKnowledge API] GET /topics/:topicId/visual-pack error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/visual-knowledge/visuals/:visualId
 * Get single visual asset by ID.
 */
router.get('/visuals/:visualId', async (req, res) => {
  try {
    const { visualId } = req.params;
    const userId = req.headers['x-user-id'] || req.user?.id || 'moulika';

    const visual = await getVisualAssetById(visualId, userId);
    if (!visual) {
      return res.status(404).json({ success: false, error: 'Visual asset not found' });
    }

    res.json({
      success: true,
      visual
    });
  } catch (err) {
    console.error('[VisualKnowledge API] GET /visuals/:visualId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/visual-knowledge/visuals/:visualId/state
 * Update user-specific personalization state (save, pin, revision status, personal notes).
 */
router.put('/visuals/:visualId/state', async (req, res) => {
  try {
    const { visualId } = req.params;
    const userId = req.headers['x-user-id'] || req.user?.id || 'moulika';

    const updatedState = await setUserVisualState(userId, visualId, req.body);
    res.json({
      success: true,
      user_state: updatedState
    });
  } catch (err) {
    console.error('[VisualKnowledge API] PUT /visuals/:visualId/state error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/visual-knowledge/match-question
 * Two-way reuse service for Mains evaluation.
 */
router.post('/match-question', async (req, res) => {
  try {
    const { questionText, paper, subject, topic, syllabusNodeId } = req.body;
    const match = await findMatchingVisualForQuestion({
      questionText,
      paper,
      subject,
      topic,
      syllabusNodeId
    });

    res.json({
      success: true,
      ...match
    });
  } catch (err) {
    console.error('[VisualKnowledge API] POST /match-question error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/visual-knowledge/topics/:topicId/generate
 * Generate missing visual knowledge assets for a topic (Phase 2C).
 */
router.post('/topics/:topicId/generate', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { examContext = 'both', region = null, mode = 'recommended', requestedTypes = [] } = req.body;
    const userId = req.headers['x-user-id'] || req.user?.id || 'moulika';

    const result = await generateVisualPackForTopic(topicId, {
      examContext,
      region,
      mode,
      requestedTypes,
      userId
    });

    if (!result.success && result.reason === 'TOPIC_NOT_FOUND') {
      return res.status(404).json({ success: false, error: result.message });
    }

    res.json(result);
  } catch (err) {
    console.error('[VisualKnowledge API] POST /topics/:topicId/generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
