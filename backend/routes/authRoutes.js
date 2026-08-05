import express from 'express';
import crypto from 'node:crypto';
import { generateToken, getAuthSecret } from '../utils/tokenUtils.js';

const router = express.Router();

// Simple in-memory rate limiter (5 failed attempts per 15 minutes)
const loginAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Periodically clean up the Map to prevent memory leaks from single-attempt IPs
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, WINDOW_MS);

function checkRateLimit(ip) {
  const now = Date.now();
  const attemptData = loginAttempts.get(ip) || { count: 0, firstAttempt: now };

  if (now - attemptData.firstAttempt > WINDOW_MS) {
    // Reset window
    attemptData.count = 1;
    attemptData.firstAttempt = now;
  } else {
    attemptData.count++;
  }

  loginAttempts.set(ip, attemptData);
  return attemptData.count <= MAX_ATTEMPTS;
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

router.post('/login', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  const configuredPassword = process.env.MENTOROS_LOGIN_PASSWORD;
  const authSecret = getAuthSecret();

  // Fail closed in production
  if (isProd && (!configuredPassword || !authSecret)) {
    return res.status(503).json({
      ok: false,
      error: 'Authentication is temporarily unavailable.'
    });
  }

  // Development fallback logic if credentials are not configured
  const effectivePassword = configuredPassword || 'mentor2026';

  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      ok: false,
      error: 'Too many login attempts. Please try again later.'
    });
  }

  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(401).json({
      ok: false,
      error: 'Invalid credentials.'
    });
  }

  // Constant-time password comparison
  const expectedHash = crypto.createHash('sha256').update(effectivePassword).digest();
  const providedHash = crypto.createHash('sha256').update(password).digest();

  if (expectedHash.length !== providedHash.length || !crypto.timingSafeEqual(expectedHash, providedHash)) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid credentials.'
    });
  }

  // Success
  clearRateLimit(ip);

  // 12 hour expiry
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 12 * 60 * 60;

  const payload = {
    sub: 'moulika',
    role: 'aspirant',
    iss: 'mentoros',
    aud: 'mentoros-web',
    iat: now,
    exp: now + expiresIn
  };

  try {
    const token = generateToken(payload);
    return res.json({
      ok: true,
      token,
      user: {
        id: 'moulika',
        role: 'aspirant'
      },
      expiresAt: new Date((now + expiresIn) * 1000).toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      error: 'Authentication is temporarily unavailable.'
    });
  }
});

export default router;
