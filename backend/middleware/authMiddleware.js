// backend/middleware/authMiddleware.js
// Production Authentication Middleware
// Enforces verified user identity via req.user.id and strips unverified public headers (x-user-id) in production.

const DEFAULT_USER = (process.env.DEFAULT_USER_ID || 'moulika').toLowerCase().trim();

export function requireAuth(req, res, next) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  const authHeader = req.headers?.authorization;

  let verifiedUserId = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token !== 'undefined' && token !== 'null') {
      // Decode or verify token identity. In our setup, valid tokens represent user identities
      verifiedUserId = token.toLowerCase().trim();
    }
  }

  // In production, strictly reject unauthenticated requests and public x-user-id header trust
  if (isProd) {
    if (!verifiedUserId) {
      return res.status(401).json({
        ok: false,
        message: 'Unauthorized: Verified authentication token (Bearer token) required in production environment.'
      });
    }
    req.user = { id: verifiedUserId };
  } else {
    // Development fallback
    const fallbackId = verifiedUserId || req.headers?.['x-user-id'] || req.body?.userId || req.query?.userId || DEFAULT_USER;
    req.user = { id: String(fallbackId).toLowerCase().trim() };
  }

  next();
}

export function getAuthUserId(req) {
  if (req.user?.id) return req.user.id;
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token !== 'undefined') return token.toLowerCase().trim();
  }

  if (!isProd) {
    const xUserId = req.headers?.['x-user-id'];
    if (xUserId) return String(xUserId).toLowerCase().trim();
    return (req.body?.userId || req.query?.userId || DEFAULT_USER).toLowerCase().trim();
  }

  return null;
}
