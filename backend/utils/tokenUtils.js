import crypto from 'node:crypto';

export function getAuthSecret() {
  // If not in production and missing, we can use a dummy for tests
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  const secret = process.env.MENTOROS_AUTH_SECRET;

  if (!secret && isProd) {
    return null; // Signals fail-closed
  }
  if (isProd && secret.length < 32) {
    // Basic length requirement for prod secret
    console.warn("MENTOROS_AUTH_SECRET should be at least 32 characters in production");
    return null;
  }
  return secret || 'dev-dummy-secret';
}

function base64urlEncode(bufferOrString) {
  const buf = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateToken(payload) {
  const secret = getAuthSecret();
  if (!secret) throw new Error('Missing MENTOROS_AUTH_SECRET in production');

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));

  const unsignedToken = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(unsignedToken).digest();
  const signatureB64 = base64urlEncode(signature);

  return `${unsignedToken}.${signatureB64}`;
}

export function verifyToken(token) {
  const secret = getAuthSecret();
  if (!secret) return null; // Fail closed if missing in production

  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Verify signature
  const expectedSignature = crypto.createHmac('sha256', secret).update(unsignedToken).digest();
  const actualSignature = Buffer.from(signatureB64, 'base64'); // base64 covers base64url safely enough for Buffer.from, but let's be strict

  // Proper base64url to base64 for decoding
  let actualBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' to make it a multiple of 4
  while (actualBase64.length % 4) {
    actualBase64 += '=';
  }

  const actualSignatureBuf = Buffer.from(actualBase64, 'base64');

  if (expectedSignature.length !== actualSignatureBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedSignature, actualSignatureBuf)) return null;

  try {
    const headerJson = Buffer.from(headerB64, 'base64').toString('utf8');
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') return null;
    if (header.typ && header.typ !== 'JWT') return null;

    const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);

    // Verify expiry
    if (!payload.exp || Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Verify issued at
    if (!payload.iat || payload.iat > Math.floor(Date.now() / 1000) + 60) {
      return null; // Clearly future-issued token
    }

    // Verify expected audience/issuer/sub/role
    if (payload.iss !== 'mentoros') return null;
    if (payload.aud !== 'mentoros-web') return null;
    if (!payload.sub || !payload.role) return null;

    return payload;
  } catch (err) {
    return null;
  }
}
