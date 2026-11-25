/**
 * backend/services/officialRetrieval/sourceAdapterRegistry.js
 *
 * Official Source Adapter Registry & Domain Security Policy (Phase 3A / 3A.1).
 * Strictly restricts retrieval to registered official domains.
 * Rejects unauthorized domains and external redirects.
 */

import { query } from '../../db/index.js';
import { normalizePibRelease, fetchLivePibRelease, PIB_ADAPTER_KEY, PIB_DOMAIN } from './adapters/pibAdapter.js';
import { normalizeMospiRelease, fetchLiveMospiRelease, MOSPI_ADAPTER_KEY, MOSPI_DOMAIN } from './adapters/mospiAdapter.js';
import { normalizeRbiRelease, fetchLiveRbiRates, RBI_ADAPTER_KEY, RBI_DOMAIN, RBI_METRIC_KEYS } from './adapters/rbiAdapter.js';
import { normalizeApFinanceRelease, fetchLiveApFinanceRelease, AP_FINANCE_ADAPTER_KEY, AP_FINANCE_DOMAIN } from './adapters/apFinanceAdapter.js';
import { normalizeAppscRelease, APPSC_ADAPTER_KEY, APPSC_DOMAIN } from './adapters/appscAdapter.js';
import { normalizeUpscRelease, UPSC_ADAPTER_KEY, UPSC_DOMAIN } from './adapters/upscAdapter.js';

export const REGISTERED_ADAPTERS = {
  [PIB_ADAPTER_KEY]: {
    key: PIB_ADAPTER_KEY,
    domain: PIB_DOMAIN,
    normalize: normalizePibRelease,
    fetchLive: fetchLivePibRelease
  },
  [MOSPI_ADAPTER_KEY]: {
    key: MOSPI_ADAPTER_KEY,
    domain: MOSPI_DOMAIN,
    normalize: normalizeMospiRelease,
    fetchLive: fetchLiveMospiRelease
  },
  [RBI_ADAPTER_KEY]: {
    key: RBI_ADAPTER_KEY,
    domain: RBI_DOMAIN,
    normalize: normalizeRbiRelease,
    fetchLive: fetchLiveRbiRates,
    metricKeys: RBI_METRIC_KEYS
  },
  [AP_FINANCE_ADAPTER_KEY]: {
    key: AP_FINANCE_ADAPTER_KEY,
    domain: AP_FINANCE_DOMAIN,
    normalize: normalizeApFinanceRelease,
    fetchLive: fetchLiveApFinanceRelease
  },
  [APPSC_ADAPTER_KEY]: {
    key: APPSC_ADAPTER_KEY,
    domain: APPSC_DOMAIN,
    normalize: normalizeAppscRelease
  },
  [UPSC_ADAPTER_KEY]: {
    key: UPSC_ADAPTER_KEY,
    domain: UPSC_DOMAIN,
    normalize: normalizeUpscRelease
  }
};

/**
 * Validate that a URL belongs strictly to an authorized official source in the DB.
 */
export async function validateOfficialUrlAllowlist(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isAllowed: false, reason: 'Invalid or empty URL provided' };
  }

  let hostname = '';
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    hostname = parsed.hostname.toLowerCase();
  } catch (err) {
    return { isAllowed: false, reason: `Malformed URL: ${rawUrl}` };
  }

  // Check official_sources table for exact domain or registered alias domain
  const { rows } = await query(`
    SELECT id, name, domain, source_tier, authority_type, is_official, metadata
    FROM official_sources
    WHERE is_official = TRUE AND active = TRUE
  `);

  const matchedSource = rows.find(src => {
    const primaryDomain = (src.domain || '').toLowerCase();
    if (hostname === primaryDomain || hostname.endsWith(`.${primaryDomain}`)) {
      return true;
    }
    const aliases = Array.isArray(src.metadata?.alias_domains) ? src.metadata.alias_domains : [];
    return aliases.some(alias => hostname === alias.toLowerCase() || hostname.endsWith(`.${alias.toLowerCase()}`));
  });

  if (!matchedSource) {
    return {
      isAllowed: false,
      hostname,
      reason: `Domain "${hostname}" is not in the MentorOS approved official sources allowlist.`
    };
  }

  return {
    isAllowed: true,
    hostname,
    source: matchedSource
  };
}

/**
 * Validate redirect safety: Disallow redirect if destination is outside official allowlist.
 */
export async function validateRedirectSafety(initialUrl, destinationUrl) {
  const initCheck = await validateOfficialUrlAllowlist(initialUrl);
  if (!initCheck.isAllowed) {
    return { isSafe: false, reason: `Initial URL rejected: ${initCheck.reason}` };
  }

  const destCheck = await validateOfficialUrlAllowlist(destinationUrl);
  if (!destCheck.isAllowed) {
    return {
      isSafe: false,
      reason: `Unsafe redirect detected to unapproved non-official domain: ${destCheck.hostname}`
    };
  }

  return {
    isSafe: true,
    initialSource: initCheck.source,
    destinationSource: destCheck.source
  };
}

/**
 * Find adapter by source key or domain.
 */
export function getAdapterForSource(sourceKeyOrDomain) {
  const normalized = String(sourceKeyOrDomain || '').toUpperCase().trim();
  if (REGISTERED_ADAPTERS[normalized]) return REGISTERED_ADAPTERS[normalized];

  const domain = String(sourceKeyOrDomain || '').toLowerCase().trim();
  const entry = Object.values(REGISTERED_ADAPTERS).find(a => 
    domain === a.domain || domain.includes(a.domain)
  );

  return entry || null;
}
