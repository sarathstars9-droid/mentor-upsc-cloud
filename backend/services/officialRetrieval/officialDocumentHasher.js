/**
 * backend/services/officialRetrieval/officialDocumentHasher.js
 *
 * Deterministic Content Hashing for Official Documents (Phase 3A).
 * Generates consistent SHA-256 hashes to prevent duplicate ingestion of identical official releases.
 */

import crypto from 'crypto';

/**
 * Generate deterministic SHA-256 hash of an official document.
 * Combines canonical URL, normalized text content, and publication date/period.
 */
export function computeDocumentContentHash({ sourceId, canonicalUrl, text = '', publicationDate = '', referencePeriod = '' }) {
  const normalizedText = String(text)
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ');

  const normalizedUrl = String(canonicalUrl || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const payload = [
    String(sourceId || '').trim(),
    normalizedUrl,
    String(publicationDate || '').trim(),
    String(referencePeriod || '').trim(),
    normalizedText
  ].join('|||');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}
