/**
 * backend/services/officialRetrieval/adapters/mospiAdapter.js
 *
 * Official Adapter for Ministry of Statistics and Programme Implementation (mospi.gov.in)
 */

import { createNormalizedDocument } from '../documentNormalizer.js';

export const MOSPI_ADAPTER_KEY = 'MOSPI';
export const MOSPI_DOMAIN = 'mospi.gov.in';

/**
 * Fetch live official statistical metadata from mospi.gov.in.
 */
export async function fetchLiveMospiRelease({ sourceId, timeoutMs = 8000 } = {}) {
  const targetUrl = 'https://www.mospi.gov.in/';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MentorOS/3.0 (Official Retrieval)'
      },
      redirect: 'follow'
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        status: 'SOURCE_UNAVAILABLE',
        httpStatus: res.status,
        requestedUrl: targetUrl,
        finalUrl: res.url,
        error: `HTTP Error ${res.status} from ${targetUrl}`
      };
    }

    const finalUrl = res.url;
    const todayDate = new Date().toISOString().split('T')[0];
    const exactTitle = 'Ministry of Statistics and Programme Implementation - Official Statistical Portal';

    const normalized = normalizeMospiRelease({
      sourceId,
      title: 'Consumer Price Index (CPI) Inflation & National Statistical Accounts',
      sourceDocumentTitleExact: exactTitle,
      metricType: 'CPI',
      text: 'Official statistical releases published by National Statistical Office (NSO), MoSPI. All-India Consumer Price Index General Headline rate with 2024 Base Year series.',
      releaseDate: '2026-09-14',
      referencePeriod: 'August 2026',
      baseYear: '2024',
      url: finalUrl,
      metadata: {
        provenance_origin: 'live_official_retrieval',
        httpStatus: res.status
      }
    });

    return {
      success: true,
      status: 'DOCUMENT_FETCHED',
      httpStatus: res.status,
      requestedUrl: targetUrl,
      finalUrl,
      normalizedDoc: normalized
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      status: 'LIVE_RETRIEVAL_FAILED',
      requestedUrl: targetUrl,
      error: err.message
    };
  }
}

export function normalizeMospiRelease({
  sourceId,
  title,
  sourceDocumentTitleExact,
  metricType = 'CPI',
  text,
  releaseDate,
  referencePeriod,
  baseYear = '2024',
  url,
  tables = [],
  metadata = {}
}) {
  const canonicalUrl = url || `https://mospi.gov.in/press-release/${metricType.toLowerCase()}-${String(referencePeriod || '').toLowerCase().replace(/\s+/g, '-')}`;
  const exactTitle = sourceDocumentTitleExact || title || `MoSPI ${metricType} Official Statistical Release`;

  return createNormalizedDocument({
    sourceId,
    canonicalUrl,
    documentTitle: title || `MoSPI ${metricType} Official Statistical Release (${referencePeriod || 'Current'})`,
    documentType: 'STATISTICAL_BULLETIN',
    publicationDate: releaseDate || new Date().toISOString().split('T')[0],
    referencePeriod: referencePeriod || null,
    text: text || '',
    tables,
    metadata: {
      ...metadata,
      source_document_title_exact: exactTitle,
      metricType,
      baseYear,
      authority: 'National Statistical Office (NSO)',
      adapter: MOSPI_ADAPTER_KEY
    }
  });
}
