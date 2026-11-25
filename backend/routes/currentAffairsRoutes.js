/**
 * backend/routes/currentAffairsRoutes.js
 *
 * Current Affairs & Official Retrieval API Endpoints (Phase 3A).
 */

import express from 'express';
import { query } from '../db/index.js';
import { ingestOfficialUpdate } from '../services/officialRetrieval/officialRetrievalService.js';
import { getIssueBySlugOrId } from '../services/currentAffairs/issueBuilderService.js';
import { generateExamDeploymentKit } from '../services/currentAffairs/examDeploymentKitService.js';
import { getUserIssueRevisionState, updateUserIssueRevisionState, getUserRevisionQueue } from '../services/currentAffairs/issueRevisionService.js';

const router = express.Router();

/**
 * GET /api/current-affairs/today
 * Returns high-priority "What changed that matters for my exam?" feed.
 */
router.get('/today', async (req, res) => {
  try {
    const examContext = req.query.examContext || 'both';
    const region = req.query.region || null;

    let filter = `status = 'ACTIVE'`;
    const params = [];

    if (examContext !== 'both') {
      params.push(examContext);
      filter += ` AND (exam_context = $${params.length} OR exam_context = 'both')`;
    }

    if (region) {
      params.push(region);
      filter += ` AND (region = $${params.length} OR region IS NULL)`;
    }

    const { rows: issues } = await query(`
      SELECT i.*, 
             (SELECT COUNT(*) FROM issue_evidence_links WHERE issue_id = i.id) as evidence_count,
             (SELECT COUNT(*) FROM issue_syllabus_mappings WHERE issue_id = i.id) as syllabus_count,
             (SELECT COUNT(*) FROM issue_pyq_links WHERE issue_id = i.id) as pyq_count
      FROM current_affairs_issues i
      WHERE ${filter}
      ORDER BY 
        CASE WHEN importance = 'CRITICAL' THEN 1 WHEN importance = 'HIGH' THEN 2 ELSE 3 END,
        last_updated_at DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      count: issues.length,
      todayUpdates: issues.map(iss => ({
        id: iss.id,
        title: iss.title,
        slug: iss.slug,
        whyInNews: iss.why_in_news,
        importance: iss.importance,
        examContext: iss.exam_context,
        region: iss.region,
        evidenceCount: parseInt(iss.evidence_count, 10) || 0,
        syllabusCount: parseInt(iss.syllabus_count, 10) || 0,
        pyqCount: parseInt(iss.pyq_count, 10) || 0,
        lastUpdatedAt: iss.last_updated_at
      }))
    });
  } catch (err) {
    console.error('[CurrentAffairsRoutes] /today error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/current-affairs/issues
 * List all canonical Current Affairs issues with filters.
 */
router.get('/issues', async (req, res) => {
  try {
    const { examContext, region, search } = req.query;
    let whereClauses = ['1=1'];
    const params = [];

    if (examContext && examContext !== 'both') {
      params.push(examContext);
      whereClauses.push(`(exam_context = $${params.length} OR exam_context = 'both')`);
    }

    if (region) {
      params.push(region);
      whereClauses.push(`(region = $${params.length} OR region IS NULL)`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length} OR slug ILIKE $${params.length})`);
    }

    const { rows } = await query(`
      SELECT i.*, 
             (SELECT COUNT(*) FROM issue_evidence_links WHERE issue_id = i.id) as evidence_count
      FROM current_affairs_issues i
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY last_updated_at DESC
    `, params);

    res.json({ success: true, issues: rows });
  } catch (err) {
    console.error('[CurrentAffairsRoutes] /issues error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/current-affairs/issues/:slugOrId
 * Get full issue dossier by slug or ID.
 */
router.get('/issues/:slugOrId', async (req, res) => {
  try {
    const issue = await getIssueBySlugOrId(req.params.slugOrId);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    res.json({ success: true, issue });
  } catch (err) {
    console.error('[CurrentAffairsRoutes] /issues/:slugOrId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/current-affairs/issues/:slugOrId/kit
 * Get Exam Deployment Kit with segregated evidence and PYQs.
 */
router.get('/issues/:slugOrId/kit', async (req, res) => {
  try {
    const issue = await getIssueBySlugOrId(req.params.slugOrId);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const kit = await generateExamDeploymentKit(issue, {
      examContext: req.query.examContext || issue.exam_context,
      region: req.query.region || issue.region
    });

    res.json({ success: true, kit });
  } catch (err) {
    console.error('[CurrentAffairsRoutes] /issues/:slugOrId/kit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/current-affairs/retrieval/ingest
 * Ingest an official document update.
 */
router.post('/retrieval/ingest', async (req, res) => {
  try {
    const { adapterKey, rawPayload, topicSlugOrId, examContext, region } = req.body;
    if (!adapterKey || !rawPayload) {
      return res.status(400).json({ success: false, error: 'adapterKey and rawPayload are required' });
    }

    const result = await ingestOfficialUpdate({
      adapterKey,
      rawPayload,
      topicSlugOrId,
      examContext,
      region
    });

    res.json(result);
  } catch (err) {
    console.error('[CurrentAffairsRoutes] /retrieval/ingest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/current-affairs/user/revision
 * Get user revision queue.
 */
router.get('/user/revision', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001';
    const queue = await getUserRevisionQueue(userId, { filter: req.query.filter || 'all' });
    res.json({ success: true, queue });
  } catch (err) {
    console.error('[CurrentAffairsRoutes] /user/revision error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/current-affairs/user/revision
 * Update user revision state for an issue.
 */
router.post('/user/revision', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001';
    const { issueId, isSaved, readState, recallConfidence, weakDimension, notes } = req.body;

    if (!issueId) {
      return res.status(400).json({ success: false, error: 'issueId is required' });
    }

    const updated = await updateUserIssueRevisionState(userId, issueId, {
      isSaved,
      readState,
      recallConfidence,
      weakDimension,
      notes
    });

    res.json({ success: true, state: updated });
  } catch (err) {
    console.error('[CurrentAffairsRoutes] POST /user/revision error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
