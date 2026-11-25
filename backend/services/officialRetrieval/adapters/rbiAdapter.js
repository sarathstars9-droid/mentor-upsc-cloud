/**
 * backend/services/officialRetrieval/adapters/rbiAdapter.js
 *
 * Official Adapter for Reserve Bank of India (rbi.org.in).
 * Handles live official policy rate retrieval and MPC resolution document normalization.
 * Strictly separates Policy Repo Rate, SDF, MSF, Bank Rate, and Reverse Repo Rate.
 */

import { createNormalizedDocument } from '../documentNormalizer.js';

export const RBI_ADAPTER_KEY = 'RBI';
export const RBI_DOMAIN = 'rbi.org.in';

export const RBI_METRIC_KEYS = {
  POLICY_REPO_RATE: 'rbi_policy_repo_rate',
  SDF_RATE: 'rbi_sdf_rate',
  MSF_RATE: 'rbi_msf_rate',
  BANK_RATE: 'rbi_bank_rate',
  REVERSE_REPO_RATE: 'rbi_reverse_repo_rate'
};

/**
 * Fetch live official policy rates directly from rbi.org.in.
 */
export async function fetchLiveRbiRates({ sourceId, timeoutMs = 8000 } = {}) {
  const targetUrl = 'https://www.rbi.org.in/';
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

    const html = await res.text();
    const finalUrl = res.url;

    // Parse exact rate table from official RBI HTML
    const rateRegex = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>[\s\S]*?(\d+\.\d+)\s*%/gi;
    let match;
    const extractedMetrics = {};
    const textLines = [];

    while ((match = rateRegex.exec(html)) !== null) {
      const rawLabel = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const rateVal = parseFloat(match[2]);

      if (/policy repo/i.test(rawLabel)) {
        extractedMetrics[RBI_METRIC_KEYS.POLICY_REPO_RATE] = {
          metricKey: RBI_METRIC_KEYS.POLICY_REPO_RATE,
          label: 'Policy Repo Rate',
          value: rateVal,
          unit: '%',
          section: 'Policy Rates Table'
        };
        textLines.push(`Policy Repo Rate: ${rateVal}%`);
      } else if (/standing deposit facility|sdf/i.test(rawLabel)) {
        extractedMetrics[RBI_METRIC_KEYS.SDF_RATE] = {
          metricKey: RBI_METRIC_KEYS.SDF_RATE,
          label: 'Standing Deposit Facility (SDF) Rate',
          value: rateVal,
          unit: '%',
          section: 'Policy Rates Table'
        };
        textLines.push(`Standing Deposit Facility (SDF) Rate: ${rateVal}%`);
      } else if (/marginal standing facility|msf/i.test(rawLabel)) {
        extractedMetrics[RBI_METRIC_KEYS.MSF_RATE] = {
          metricKey: RBI_METRIC_KEYS.MSF_RATE,
          label: 'Marginal Standing Facility (MSF) Rate',
          value: rateVal,
          unit: '%',
          section: 'Policy Rates Table'
        };
        textLines.push(`Marginal Standing Facility (MSF) Rate: ${rateVal}%`);
      } else if (/bank rate/i.test(rawLabel)) {
        extractedMetrics[RBI_METRIC_KEYS.BANK_RATE] = {
          metricKey: RBI_METRIC_KEYS.BANK_RATE,
          label: 'Bank Rate',
          value: rateVal,
          unit: '%',
          section: 'Policy Rates Table'
        };
        textLines.push(`Bank Rate: ${rateVal}%`);
      } else if (/reverse repo/i.test(rawLabel)) {
        extractedMetrics[RBI_METRIC_KEYS.REVERSE_REPO_RATE] = {
          metricKey: RBI_METRIC_KEYS.REVERSE_REPO_RATE,
          label: 'Fixed Reverse Repo Rate',
          value: rateVal,
          unit: '%',
          section: 'Policy Rates Table'
        };
        textLines.push(`Reverse Repo Rate: ${rateVal}%`);
      }
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const documentTitleExact = 'Reserve Bank of India - Current Policy Rates & Monetary Framework';

    const normalized = normalizeRbiRelease({
      sourceId,
      title: documentTitleExact,
      sourceDocumentTitleExact: documentTitleExact,
      docType: 'POLICY_RATES_BULLETIN',
      text: `Official Policy Rates as published by Reserve Bank of India: ${textLines.join('. ')}.`,
      releaseDate: todayDate,
      referencePeriod: `CY ${new Date().getFullYear()}`,
      url: finalUrl,
      metadata: {
        provenance_origin: 'live_official_retrieval',
        extractedMetrics,
        httpStatus: res.status
      }
    });

    return {
      success: true,
      status: 'DOCUMENT_FETCHED',
      httpStatus: res.status,
      requestedUrl: targetUrl,
      finalUrl,
      normalizedDoc: normalized,
      extractedMetrics
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

export function normalizeRbiRelease({
  sourceId,
  title,
  sourceDocumentTitleExact,
  docType = 'MPC_RESOLUTION',
  text,
  releaseDate,
  referencePeriod,
  url,
  metadata = {}
}) {
  const canonicalUrl = url || `https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=${metadata.prid || 'LATEST'}`;
  const exactTitle = sourceDocumentTitleExact || title || 'Reserve Bank of India Monetary Policy Statement';

  return createNormalizedDocument({
    sourceId,
    canonicalUrl,
    documentTitle: title || 'RBI Monetary Policy Committee Resolution & Statement',
    documentType: 'POLICY_GUIDELINE',
    publicationDate: releaseDate || new Date().toISOString().split('T')[0],
    referencePeriod: referencePeriod || null,
    text: text || '',
    metadata: {
      ...metadata,
      source_document_title_exact: exactTitle,
      docType,
      authority: 'Reserve Bank of India Monetary Policy Committee',
      adapter: RBI_ADAPTER_KEY
    }
  });
}
