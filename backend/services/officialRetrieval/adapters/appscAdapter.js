/**
 * backend/services/officialRetrieval/adapters/appscAdapter.js
 *
 * Official Adapter for Andhra Pradesh Public Service Commission (psc.ap.gov.in)
 */

import { createNormalizedDocument } from '../documentNormalizer.js';

export const APPSC_ADAPTER_KEY = 'APPSC';
export const APPSC_DOMAIN = 'psc.ap.gov.in';

export function normalizeAppscRelease({ sourceId, title, docType = 'NOTIFICATION', text, releaseDate, referencePeriod, url, metadata = {} }) {
  const canonicalUrl = url || `https://psc.ap.gov.in/notification/${metadata.notificationId || 'latest'}`;

  return createNormalizedDocument({
    sourceId,
    canonicalUrl,
    documentTitle: title || 'APPSC Official Examination Notification / Syllabus Release',
    documentType: 'NOTIFICATION',
    publicationDate: releaseDate || new Date().toISOString().split('T')[0],
    referencePeriod: referencePeriod || null,
    text: text || '',
    metadata: {
      ...metadata,
      region: 'andhra_pradesh',
      exam_context: 'appsc',
      adapter: APPSC_ADAPTER_KEY
    }
  });
}
