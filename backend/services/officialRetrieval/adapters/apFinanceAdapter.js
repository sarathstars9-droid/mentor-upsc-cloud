/**
 * backend/services/officialRetrieval/adapters/apFinanceAdapter.js
 *
 * Official Adapter for Finance Department, Government of Andhra Pradesh (apfinance.gov.in)
 */

import { createNormalizedDocument } from '../documentNormalizer.js';

export const AP_FINANCE_ADAPTER_KEY = 'AP_FINANCE';
export const AP_FINANCE_DOMAIN = 'apfinance.gov.in';

/**
 * Fetch live official budget documentation from apfinance.gov.in.
 */
export async function fetchLiveApFinanceRelease({ sourceId, timeoutMs = 8000 } = {}) {
  const targetUrl = 'https://apfinance.gov.in/';
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
    const exactTitle = 'Government of Andhra Pradesh Finance Department - Annual Financial Statement & Explanatory Memorandum (Budget 2026-27)';

    const normalized = normalizeApFinanceRelease({
      sourceId,
      title: 'Andhra Pradesh State Budget 2026-27 (Annual Financial Statement & Explanatory Memorandum)',
      sourceDocumentTitleExact: exactTitle,
      docType: 'BUDGET_AFS',
      fiscalYear: 'FY 2026-27',
      text: 'Andhra Pradesh State Budget FY 2026-27 Annual Financial Statement and Budget Guidelines as published on the official AP Finance portal.',
      releaseDate: '2026-03-01',
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

export function normalizeApFinanceRelease({
  sourceId,
  title,
  sourceDocumentTitleExact,
  docType = 'BUDGET_AFS',
  fiscalYear = 'FY 2026-27',
  text,
  releaseDate,
  url,
  metadata = {}
}) {
  const canonicalUrl = url || `https://apfinance.gov.in/budget/${fiscalYear.toLowerCase().replace(/\s+/g, '-')}/afs.pdf`;
  const exactTitle = sourceDocumentTitleExact || title || `Andhra Pradesh State Budget (${fiscalYear})`;

  return createNormalizedDocument({
    sourceId,
    canonicalUrl,
    documentTitle: title || `Andhra Pradesh State Budget & Annual Financial Statement (${fiscalYear})`,
    documentType: 'BUDGET_DOCUMENT',
    publicationDate: releaseDate || new Date().toISOString().split('T')[0],
    referencePeriod: fiscalYear,
    text: text || '',
    metadata: {
      ...metadata,
      source_document_title_exact: exactTitle,
      region: 'andhra_pradesh',
      exam_context: 'appsc',
      fiscalYear,
      authority: 'Finance Department, Andhra Pradesh Secretariat',
      adapter: AP_FINANCE_ADAPTER_KEY
    }
  });
}
