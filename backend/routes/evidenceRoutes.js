/**
 * backend/routes/evidenceRoutes.js
 *
 * REST API Router for Official Evidence Layer (Phase 2A).
 * Base path: /api/evidence
 */

import express from 'express';
import { getOfficialSources, getSourceById } from '../services/evidence/sourceRegistryService.js';
import { 
  getEvidenceByTopic, 
  getEvidenceById, 
  createEvidenceAsset, 
  refreshEvidence, 
  linkEvidenceToVisual, 
  getEvidenceForVisual 
} from '../services/evidence/evidenceService.js';
import { verifyEvidenceClaim } from '../services/evidence/evidenceVerificationService.js';

const router = express.Router();

/**
 * GET /api/evidence/sources
 * Query official sources registry with filtering.
 */
router.get('/sources', async (req, res) => {
  try {
    const { examContext, region, sourceTier, activeOnly, tag, domain, search } = req.query;
    const sources = await getOfficialSources({
      examContext,
      region,
      sourceTier,
      activeOnly: activeOnly !== 'false',
      tag,
      domain,
      search
    });
    res.json({
      success: true,
      total: sources.length,
      sources
    });
  } catch (err) {
    console.error('[Evidence API] GET /sources error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/evidence/topic/:topicId
 * Get ranked evidence assets for a specific topic.
 */
router.get('/topic/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { examContext = 'both', region = null } = req.query;

    const evidence = await getEvidenceByTopic(topicId, {
      examContext,
      region
    });

    res.json({
      success: true,
      topic_id: topicId,
      exam_context: examContext,
      region,
      count: evidence.length,
      evidence
    });
  } catch (err) {
    console.error('[Evidence API] GET /topic/:topicId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/evidence/verify
 * Verify claim or metric against official sources and evidence catalog.
 * CRITICAL RULE: If claim cannot be corroborated by official sources, returns verification_status = "unverified".
 */
router.post('/verify', async (req, res) => {
  try {
    const {
      claimText,
      numericValue,
      unit,
      sourceUrl,
      sourceId,
      examContext = 'both',
      region = 'india',
      topicId
    } = req.body;

    const verification = await verifyEvidenceClaim({
      claimText,
      numericValue,
      unit,
      sourceUrl,
      sourceId,
      examContext,
      region,
      topicId
    });

    res.json({
      success: true,
      ...verification
    });
  } catch (err) {
    console.error('[Evidence API] POST /verify error:', err);
    res.status(500).json({ 
      success: false, 
      verification_status: 'unverified',
      error: err.message 
    });
  }
});

/**
 * POST /api/evidence/refresh/:evidenceId
 * Refresh evidence freshness and verification status.
 */
router.post('/refresh/:evidenceId', async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const refreshed = await refreshEvidence(evidenceId);
    res.json({
      success: true,
      evidence: refreshed
    });
  } catch (err) {
    console.error('[Evidence API] POST /refresh/:evidenceId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/evidence/asset/:id
 * Get single evidence asset by ID.
 */
router.get('/asset/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await getEvidenceById(id);
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Evidence asset not found' });
    }
    res.json({ success: true, evidence: asset });
  } catch (err) {
    console.error('[Evidence API] GET /asset/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/evidence/asset
 * Create a new official evidence asset.
 */
router.post('/asset', async (req, res) => {
  try {
    const asset = await createEvidenceAsset(req.body);
    res.status(201).json({ success: true, evidence: asset });
  } catch (err) {
    console.error('[Evidence API] POST /asset error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/evidence/visual/:visualId
 * Get evidence linked to a visual asset.
 */
router.get('/visual/:visualId', async (req, res) => {
  try {
    const { visualId } = req.params;
    const evidenceList = await getEvidenceForVisual(visualId);
    res.json({
      success: true,
      visual_asset_id: visualId,
      count: evidenceList.length,
      evidence: evidenceList
    });
  } catch (err) {
    console.error('[Evidence API] GET /visual/:visualId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/evidence/link-visual
 * Link an evidence asset to a visual asset.
 */
router.post('/link-visual', async (req, res) => {
  try {
    const { visualAssetId, evidenceAssetId, usageType = 'primary_metric' } = req.body;
    if (!visualAssetId || !evidenceAssetId) {
      return res.status(400).json({ success: false, error: 'visualAssetId and evidenceAssetId are required.' });
    }
    const link = await linkEvidenceToVisual(visualAssetId, evidenceAssetId, usageType);
    res.json({ success: true, link });
  } catch (err) {
    console.error('[Evidence API] POST /link-visual error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
