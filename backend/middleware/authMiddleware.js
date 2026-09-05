// backend/middleware/authMiddleware.js
// Production Authentication Middleware
// Enforces verified user identity via req.user.id and strips unverified public headers (x-user-id) in production.

import { verifyToken } from '../utils/tokenUtils.js';

const DEFAULT_USER = (process.env.DEFAULT_USER_ID || 'moulika').toLowerCase().trim();

export function requireAuth(req, res, next) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  const authHeader = req.headers?.authorization;

  let verifiedPayload = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token !== 'undefined' && token !== 'null') {
      verifiedPayload = verifyToken(token);
    }
  }

  if (isProd) {
    if (!process.env.MENTOROS_AUTH_SECRET) {
      return res.status(503).json({
        ok: false,
        message: 'Authentication is temporarily unavailable.'
      });
    }
    if (!verifiedPayload) {
      return res.status(401).json({
        ok: false,
        message: 'Unauthorized: Valid signed token required.'
      });
    }
    req.user = { id: verifiedPayload.sub, role: verifiedPayload.role };
  } else {
    // Development fallback
    if (verifiedPayload) {
      req.user = { id: verifiedPayload.sub, role: verifiedPayload.role };
    } else {
      const fallbackId = req.headers?.['x-user-id'] || req.body?.userId || req.query?.userId || DEFAULT_USER;
      req.user = { id: String(fallbackId).toLowerCase().trim() };
    }
  }

  next();
}

export function getAuthUserId(req) {
  if (req.user?.id) return req.user.id;
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token !== 'undefined' && token !== 'null') {
      const verifiedPayload = verifyToken(token);
      if (verifiedPayload) return verifiedPayload.sub;
    }
  }

  if (!isProd) {
    const xUserId = req.headers?.['x-user-id'];
    if (xUserId) return String(xUserId).toLowerCase().trim();
    return (req.body?.userId || req.query?.userId || DEFAULT_USER).toLowerCase().trim();
  }

  return null;
}

/**
 * requireKnowledgeReviewer ensures the authenticated user is explicitly allowed
 * to access internal knowledge review endpoints.
 * This is an internal-alpha authorization mechanism.
 */
export function requireKnowledgeReviewer(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ ok: false, message: 'Unauthorized: User not authenticated.' });
  }

  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  
  let allowedReviewersStr = process.env.KNOWLEDGE_REVIEWER_USER_IDS;
  
  if (isProd && !allowedReviewersStr) {
    return res.status(403).json({ 
      ok: false, 
      message: 'Forbidden: Reviewer allowlist not configured in production.' 
    });
  }

  // Development fallback
  if (!allowedReviewersStr) {
    allowedReviewersStr = 'moulika,admin';
  }

  const allowedReviewers = allowedReviewersStr.split(',').map(s => s.toLowerCase().trim());

  if (!allowedReviewers.includes(userId)) {
    return res.status(403).json({ 
      ok: false, 
      message: 'Forbidden: Insufficient privileges for Knowledge Review.' 
    });
  }

  next();
}
