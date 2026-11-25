/**
 * backend/services/officialRetrieval/documentNormalizer.js
 *
 * Standardized Document Normalizer Contract (Phase 3A).
 * Converts provider-specific official inputs into a single unified contract for the MentorOS pipeline.
 */

import { computeDocumentContentHash } from './officialDocumentHasher.js';

export const OFFICIAL_DOCUMENT_TYPES = [
  'PRESS_RELEASE',
  'REPORT',
  'CIRCULAR',
  'BUDGET_DOCUMENT',
  'SURVEY',
  'NOTIFICATION',
  'POLICY_GUIDELINE',
  'GAZETTE_ORDER',
  'STATISTICAL_BULLETIN'
];

/**
 * Standard Normalized Document Structure.
 */
export function createNormalizedDocument({
  sourceId,
  canonicalUrl,
  documentTitle,
  documentType = 'PRESS_RELEASE',
  publicationDate = null,
  referencePeriod = null,
  retrievedAt = new Date(),
  text = '',
  sections = [],
  tables = [],
  metadata = {}
}) {
  if (!sourceId) throw new Error('Document normalization requires valid sourceId');
  if (!canonicalUrl) throw new Error('Document normalization requires valid canonicalUrl');
  if (!documentTitle) throw new Error('Document normalization requires valid documentTitle');

  const normalizedTitle = String(documentTitle).trim().replace(/\s+/g, ' ');
  const normalizedText = String(text).trim();
  const normalizedType = OFFICIAL_DOCUMENT_TYPES.includes(documentType) ? documentType : 'PRESS_RELEASE';

  const contentHash = computeDocumentContentHash({
    sourceId,
    canonicalUrl,
    text: normalizedText,
    publicationDate,
    referencePeriod
  });

  return {
    sourceId,
    canonicalUrl: String(canonicalUrl).trim(),
    documentTitle: normalizedTitle,
    documentType: normalizedType,
    publicationDate: publicationDate ? new Date(publicationDate).toISOString().split('T')[0] : null,
    referencePeriod: referencePeriod ? String(referencePeriod).trim() : null,
    retrievedAt: retrievedAt instanceof Date ? retrievedAt.toISOString() : new Date().toISOString(),
    contentHash,
    text: normalizedText,
    sections: Array.isArray(sections) ? sections : [],
    tables: Array.isArray(tables) ? tables : [],
    metadata: {
      ...metadata,
      normalizedAt: new Date().toISOString()
    }
  };
}
