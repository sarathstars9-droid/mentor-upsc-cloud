import express from 'express';
import { requireAuth, requireKnowledgeReviewer } from '../middleware/authMiddleware.js';
import * as knowledgeService from '../services/mainsKnowledgeService.js';
import { buildKnowledgeCandidate } from '../services/mainsKnowledgeBuilderService.js';
import { discoverSource } from '../services/sourceDiscoveryService.js';
import { verifyClaim } from '../services/sourceVerificationService.js';

const router = express.Router();

// All review routes are strictly protected
router.use(requireAuth);
router.use(requireKnowledgeReviewer);

// GET /api/mains/knowledge/review - List candidates with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      paper, subject, knowledge_type, lifecycle_status, verification_status, is_active, 
      limit = 50, offset = 0 
    } = req.query;

    const filters = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };

    if (paper) filters.paper = paper;
    if (subject) filters.subject = subject;
    if (knowledge_type) filters.knowledge_type = knowledge_type;
    if (lifecycle_status) filters.lifecycle_status = lifecycle_status;
    if (verification_status) filters.verification_status = verification_status;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    // Default to PENDING_REVIEW if no specific lifecycle/active filter is set
    if (!lifecycle_status && is_active === undefined) {
      filters.lifecycle_status = 'PENDING_REVIEW';
    }

    const items = await knowledgeService.searchKnowledgeItems(filters);
    res.json({ ok: true, data: items });
  } catch (err) {
    console.error('[ReviewAPI] List Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/mains/knowledge/review/auth-status - Helper endpoint to check capabilities
router.get('/auth-status', async (req, res) => {
  // If we reach here, requireAuth & requireKnowledgeReviewer passed
  res.json({ ok: true, can_review_knowledge: true });
});

// GET /api/mains/knowledge/review/:id - Detail view
router.get('/:id', async (req, res) => {
  try {
    if (req.params.id === 'auth-status' || req.params.id === 'build') {
      return res.status(404).json({ ok: false }); // Handled above, prevent collision
    }
    const item = await knowledgeService.getKnowledgeItem(req.params.id);
    if (!item) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/build - Explicit internal trigger for Knowledge Builder
router.post('/build', async (req, res) => {
  try {
    const { questionIntelligence, knowledgeType, knowledgeSubtype, queryText } = req.body;
    
    if (!questionIntelligence || !knowledgeType) {
      return res.status(400).json({ ok: false, message: 'Missing required parameters' });
    }

    const result = await buildKnowledgeCandidate({
      userId: req.user.id,
      questionIntelligence,
      knowledgeType,
      knowledgeSubtype,
      queryText,
      requestedBy: req.user.id
    });

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('[ReviewAPI] Build Error:', err);
    // Explicitly handle provider errors or validation errors safely
    res.status(500).json({ ok: false, message: err.message });
  }
});

// PATCH /api/mains/knowledge/review/:id - Update generic fields (protect trust fields)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    
    // Protect trust and taxonomy fields
    const protectedFields = [
      'verification_status', 'lifecycle_status', 'is_active', 
      'verified_at', 'verified_by', 'generated_by_model', 'prompt_version',
      // For V1.5C, taxonomy is read-only from free-text generic patch:
      'paper', 'subject', 'topic', 'micro_topic', 'syllabus_node_id'
    ];

    for (const field of protectedFields) {
      delete patch[field]; // Strip protected fields silently or we could throw
    }

    const updated = await knowledgeService.updateKnowledgeItem(id, patch);
    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('[ReviewAPI] Patch Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/:id/discover-source - V1.6A explicitly discover source candidates
router.post('/:id/discover-source', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await discoverSource(id, req.user.id);
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('[ReviewAPI] Discover Source Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/:id/verify-claim - V1.6A verify claim against specific URL
router.post('/:id/verify-claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateUrl } = req.body;
    
    if (!candidateUrl) {
      return res.status(400).json({ ok: false, message: 'candidateUrl is required' });
    }

    const result = await verifyClaim(id, candidateUrl, req.user.id);
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('[ReviewAPI] Verify Claim Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/:id/auto-discover-and-verify
router.post('/:id/auto-discover-and-verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Call the shared orchestrator instead of duplicating the logic
    const { findVerifiedEvidenceForContext } = await import('../services/mainsEvidenceOrchestrator.js');
    
    const result = await findVerifiedEvidenceForContext({
      userId: req.user.id,
      knowledgeItemId: id
    });

    if (result.status === "FEATURE_DISABLED") {
      return res.json({ ok: false, error: 'FEATURE_DISABLED', message: 'Live discovery is disabled' });
    }

    if (result.status === "REUSED_TRUSTED") {
      return res.json({
        ok: true,
        data: {
          rag_reused: true,
          reused_id: "reused", // Mapped from orchestrator if needed
          final_url: result.evidence.source_url,
          authority_level: result.evidence.authority_level
        }
      });
    }

    if (result.status === "NO_VERIFIED_EVIDENCE") {
      return res.json({ ok: false, error: 'OFFICIAL_SOURCE_UNREACHABLE', message: 'All fetch attempts failed safely or no support found.' });
    }

    res.json({
      ok: true,
      data: {
        verification: {
          claim_supported: true,
          support_type: 'DIRECT',
          claim_verified: result.evidence.title,
          extracted_quote: result.evidence.exam_use
        },
        candidate: {
          final_url: result.evidence.source_url,
          authority_level: result.evidence.authority_level
        }
      }
    });

  } catch (err) {
    console.error('[ReviewAPI] Auto Discover And Verify Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/:id/verify - Submit source verification metadata
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First apply any source metadata changes if provided
    if (req.body && Object.keys(req.body).length > 0) {
      const { source_type, source_reference, source_title, source_year, effective_from, expires_at } = req.body;
      const metadataPatch = {};
      if (source_type !== undefined) metadataPatch.source_type = source_type;
      if (source_reference !== undefined) metadataPatch.source_reference = source_reference;
      if (source_title !== undefined) metadataPatch.source_title = source_title;
      if (source_year !== undefined) metadataPatch.source_year = source_year;
      if (effective_from !== undefined) metadataPatch.effective_from = effective_from;
      if (expires_at !== undefined) metadataPatch.expires_at = expires_at;
      
      await knowledgeService.updateKnowledgeItem(id, metadataPatch);
    }

    // Now explicitly verify
    // Ensure item has valid source metadata before verifying (for EVIDENCE)
    const item = await knowledgeService.getKnowledgeItem(id);
    if (item && (item.knowledge_type === 'EVIDENCE' || item.verification_status === 'SOURCE_REQUIRED')) {
      const hasReference = item.source_reference && item.source_reference.trim() !== '';
      const hasTitle = item.source_title && item.source_title.trim() !== '';
      
      if (!hasReference && !hasTitle) {
        return res.status(400).json({ 
          ok: false, 
          error: 'VALIDATION_ERROR',
          message: 'Evidence must have a valid source reference or title before verification.'
        });
      }
    }

    const verifiedItem = await knowledgeService.verifyKnowledgeItem(id, { userId: req.user.id });
    res.json({ ok: true, data: verifiedItem });
  } catch (err) {
    console.error('[ReviewAPI] Verify Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/:id/approve - Approve verified or non-evidence candidates
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const approvedItem = await knowledgeService.approveKnowledgeItem(id, { userId: req.user.id });
    res.json({ ok: true, data: approvedItem });
  } catch (err) {
    console.error('[ReviewAPI] Approve Error:', err);
    if (err.message.includes('EVIDENCE_SOURCE_REQUIRED')) {
      return res.status(400).json({ ok: false, error: 'EVIDENCE_SOURCE_REQUIRED' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/mains/knowledge/review/:id/retire - Set lifecycle_status = RETIRED
router.post('/:id/retire', async (req, res) => {
  try {
    const { id } = req.params;
    const retiredItem = await knowledgeService.retireKnowledgeItem(id, { userId: req.user.id });
    res.json({ ok: true, data: retiredItem });
  } catch (err) {
    console.error('[ReviewAPI] Retire Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
