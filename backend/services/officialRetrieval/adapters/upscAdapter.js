/**
 * backend/services/officialRetrieval/adapters/upscAdapter.js
 *
 * Official Adapter for Union Public Service Commission (upsc.gov.in)
 */

import { createNormalizedDocument } from '../documentNormalizer.js';

export const UPSC_ADAPTER_KEY = 'UPSC';
export const UPSC_DOMAIN = 'upsc.gov.in';

export function normalizeUpscRelease({ sourceId, title, docType = 'NOTIFICATION', text, releaseDate, referencePeriod, url, metadata = {} }) {
  const canonicalUrl = url || `https://upsc.gov.in/examinations/${metadata.examSlug || 'civil-services-examination'}`;

  return createNormalizedDocument({
    sourceId,
    canonicalUrl,
    documentTitle: title || 'UPSC Official Press Release / Examination Notification',
    documentType: 'NOTIFICATION',
    publicationDate: releaseDate || new Date().toISOString().split('T')[0],
    referencePeriod: referencePeriod || null,
    text: text || '',
    metadata: {
      ...metadata,
      exam_context: 'upsc',
      authority: 'Union Public Service Commission',
      adapter: UPSC_ADAPTER_KEY
    }
  });
}
