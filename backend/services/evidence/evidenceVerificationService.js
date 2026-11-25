/**
 * backend/services/evidence/evidenceVerificationService.js
 *
 * Official-Source-First Verification Engine for MentorOS Evidence Layer (Phase 2B).
 * 
 * CRITICAL INVARIANTS:
 * 1. An official domain match alone does NOT automatically make evidence current or verified.
 * 2. Exact document provenance (title, date, section, period) is mandatory for verified_current.
 * 3. LLM memory must NEVER be treated as authoritative for statistics/current facts.
 * 4. Do NOT call AI to invent evidence.
 * 5. When verification cannot confirm a claim from exact official document records:
 *    return verification_status = "unverified".
 * 6. Never silently promote an unverified number into a visual.
 * 7. Statuses: verified_current, verified_historical, stale, unverified, disputed.
 */

import { query } from '../../db/index.js';
import { findSourceByUrl, getSourceById } from './sourceRegistryService.js';
import { evaluateEvidenceFreshness } from './evidenceFreshnessPolicy.js';

/**
 * Normalizes numerical and textual claims for deterministic comparison.
 */
export function extractClaimTokens(text) {
  if (!text || typeof text !== 'string') return { numbers: [], terms: [] };

  const numbers = (text.match(/[-+]?[0-9]*\.?[0-9]+/g) || []).map(Number);
  const terms = text
    .toLowerCase()
    .replace(/[^\w\s%]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  return { numbers, terms };
}

/**
 * Verifies a candidate claim against exact official documents and evidence catalog.
 */
export async function verifyEvidenceClaim({
  claimText,
  numericValue = null,
  unit = null,
  sourceUrl = null,
  candidateDomain = null,
  sourceId = null,
  examContext = 'both',
  region = 'india',
  topicId = null
} = {}) {
  if (!claimText && numericValue === null) {
    return {
      verification_status: 'unverified',
      verificationStatus: 'unverified',
      confidence: 0.0,
      reason: 'No claim text or numeric value provided for verification',
      is_official: false,
      source: null,
      document: null,
      isLatestRelease: false,
      isFresh: false
    };
  }

  // 1. Resolve registered Official Source
  let matchedSource = null;
  const lookupUrl = sourceUrl || candidateDomain;
  if (sourceId) {
    matchedSource = await getSourceById(sourceId);
  } else if (lookupUrl) {
    matchedSource = await findSourceByUrl(lookupUrl);
  }

  // 2. Query stored evidence assets with document-level provenance
  let evidenceQuery = `
    SELECT e.*, 
           s.name as source_name, 
           s.domain as source_domain, 
           s.source_tier, 
           s.is_official, 
           s.authority_type
    FROM evidence_assets e
    JOIN official_sources s ON e.source_id = s.id
    WHERE e.verification_status IN ('verified_current', 'verified_historical', 'verified', 'stale')
  `;
  const queryParams = [];

  if (matchedSource) {
    queryParams.push(matchedSource.id);
    evidenceQuery += ` AND e.source_id = $${queryParams.length}`;
  }

  if (topicId) {
    queryParams.push(topicId);
    evidenceQuery += ` AND e.topic_id = $${queryParams.length}`;
  }

  const { rows: verifiedAssets } = await query(evidenceQuery, queryParams);

  const candidateNum = numericValue !== null && numericValue !== undefined && numericValue !== '' ? Number(numericValue) : null;
  const { terms: candidateTerms, numbers: candidateNumbers } = extractClaimTokens(claimText || '');

  let bestMatch = null;
  let highestMatchScore = 0;

  for (const asset of verifiedAssets) {
    let matchScore = 0;
    let hasNumericMismatch = false;

    // A. Numeric Match Check
    if (candidateNum !== null && asset.numeric_value !== null) {
      const assetNum = Number(asset.numeric_value);
      if (Math.abs(candidateNum - assetNum) < 0.001) {
        matchScore += 60; // Exact numeric match
      } else if (Math.abs(candidateNum - assetNum) / (Math.abs(assetNum) || 1) < 0.05) {
        matchScore += 30; // Close tolerance
      } else {
        hasNumericMismatch = true;
      }
    } else if (candidateNumbers.length > 0 && asset.numeric_value !== null) {
      if (candidateNumbers.includes(Number(asset.numeric_value))) {
        matchScore += 45;
      } else {
        hasNumericMismatch = true;
      }
    }

    // If candidate has a specific number that doesn't match the asset, it cannot verify
    if (hasNumericMismatch) {
      continue;
    }

    // B. Textual Token Overlap Check
    const { terms: assetTerms } = extractClaimTokens(`${asset.title} ${asset.value_text} ${asset.source_document_title || ''}`);
    const overlap = candidateTerms.filter(t => assetTerms.includes(t));
    matchScore += overlap.length * 8;

    if (matchScore > highestMatchScore) {
      highestMatchScore = matchScore;
      bestMatch = asset;
    }
  }

  // 3. Document-Level Corroboration Verdict
  if (bestMatch && highestMatchScore >= 35) {
    const prov = bestMatch.provenance_origin || 'unknown';
    const isTrustedOrigin = prov === 'live_official_retrieval' || prov === 'manual_official_import';
    const hasFullProvenance = Boolean(
      bestMatch.source_document_title && 
      (bestMatch.source_document_date || bestMatch.publication_date) && 
      bestMatch.source_url
    );

    const freshness = evaluateEvidenceFreshness(bestMatch);
    
    // Status determination: verified_current requires trusted origin, complete doc provenance, confirmed latest, and fresh status
    let finalStatus = bestMatch.verification_status;
    if (finalStatus === 'verified_current') {
      if (!isTrustedOrigin || !hasFullProvenance || !freshness.isFresh || !freshness.officialLatestConfirmed) {
        finalStatus = freshness.isStale ? 'stale' : 'verified_historical';
      }
    } else if (isTrustedOrigin && hasFullProvenance && freshness.isFresh && freshness.officialLatestConfirmed) {
      finalStatus = 'verified_current';
    } else if (finalStatus === 'pending_corroboration') {
      finalStatus = 'unverified';
    } else if (finalStatus === 'contradicted') {
      finalStatus = 'disputed';
    } else if (!finalStatus) {
      finalStatus = freshness.isStale ? 'stale' : 'verified_historical';
    }

    const officialLatestConfirmed = Boolean(
      isTrustedOrigin && 
      hasFullProvenance && 
      freshness.isFresh && 
      freshness.officialLatestConfirmed
    );

    const refreshRequired = !officialLatestConfirmed || freshness.refreshRequired || freshness.isStale;
    const confidence = Math.min(1.0, (bestMatch.confidence || 1.0) * Math.min(1.0, highestMatchScore / 45));

    return {
      verification_status: finalStatus,
      verificationStatus: finalStatus,
      freshness_status: freshness.freshnessStatus,
      freshnessStatus: freshness.freshnessStatus,
      confidence,
      is_official: Boolean(bestMatch.is_official),
      provenance_origin: prov,
      provenanceOrigin: prov,
      latest_in_catalog: Boolean(bestMatch.is_latest_release),
      latestInCatalog: Boolean(bestMatch.is_latest_release),
      official_latest_confirmed: officialLatestConfirmed,
      officialLatestConfirmed,
      refresh_required: refreshRequired,
      refreshRequired,
      source: {
        id: bestMatch.source_id,
        name: bestMatch.source_name,
        domain: bestMatch.source_domain,
        source_tier: bestMatch.source_tier,
        authority_type: bestMatch.authority_type
      },
      document: {
        title: bestMatch.source_document_title || bestMatch.title,
        date: bestMatch.source_document_date || bestMatch.publication_date,
        type: bestMatch.source_document_type || 'Official Release',
        section: bestMatch.source_section || 'Main Tables',
        page: bestMatch.source_page_number || null,
        url: bestMatch.source_url
      },
      data_period: bestMatch.data_period,
      dataPeriod: bestMatch.data_period,
      publication_date: bestMatch.publication_date || bestMatch.source_document_date,
      document_date: bestMatch.source_document_date || bestMatch.publication_date,
      documentDate: bestMatch.source_document_date || bestMatch.publication_date,
      value_text: bestMatch.value_text,
      numeric_value: bestMatch.numeric_value,
      unit: bestMatch.unit,
      is_latest_release: Boolean(bestMatch.is_latest_release),
      isLatestRelease: Boolean(bestMatch.is_latest_release),
      is_fresh: freshness.isFresh,
      isFresh: freshness.isFresh,
      is_stale: freshness.isStale,
      isStale: freshness.isStale,
      refresh_warning: refreshRequired ? (freshness.refresh_warning || freshness.reason) : null,
      retrieved_at: bestMatch.retrieved_at || bestMatch.created_at,
      retrievedAt: bestMatch.retrieved_at || bestMatch.created_at,
      verified_at: bestMatch.verified_at || new Date().toISOString()
    };
  }

  // 4. RULE: An official domain match alone without exact document support is UNVERIFIED
  return {
    verification_status: 'unverified',
    verificationStatus: 'unverified',
    freshness_status: 'stale',
    freshnessStatus: 'stale',
    confidence: 0.0,
    reason: 'Exact claim could not be corroborated by specific official document release or evidence catalog record.',
    is_official: false,
    provenance_origin: 'unknown',
    provenanceOrigin: 'unknown',
    latest_in_catalog: false,
    latestInCatalog: false,
    official_latest_confirmed: false,
    officialLatestConfirmed: false,
    refresh_required: true,
    refreshRequired: true,
    source: matchedSource ? {
      id: matchedSource.id,
      name: matchedSource.name,
      domain: matchedSource.domain,
      source_tier: matchedSource.source_tier
    } : null,
    document: null,
    is_latest_release: false,
    isLatestRelease: false,
    is_fresh: false,
    isFresh: false,
    is_stale: false,
    isStale: false,
    refresh_warning: 'Unverified metric: Not corroborated against exact official release document. Prohibited from visual promotion.'
  };
}

/**
 * Validates whether a visual specification has sufficient evidence backing for quantitative charts.
 */
export function validateVisualEvidenceIntegrity(visualSpec, linkedEvidenceList = []) {
  if (!visualSpec || typeof visualSpec !== 'object') {
    return { is_valid: true, requires_evidence: false };
  }

  const quantitativeRenderers = ['BAR_CHART', 'LINE_GRAPH', 'PIE_CHART', 'TABLE', 'COMPARISON_TABLE'];
  const isQuantitative = quantitativeRenderers.includes(visualSpec.renderer);

  if (!isQuantitative) {
    return {
      is_valid: true,
      requires_evidence: false,
      renderer: visualSpec.renderer,
      verification_status: 'verified_current'
    };
  }

  // Quantitative visuals REQUIRE verified evidence (current or historical)
  const currentLinks = linkedEvidenceList.filter(e => e.verification_status === 'verified_current' || e.verification_status === 'verified');
  const historicalLinks = linkedEvidenceList.filter(e => e.verification_status === 'verified_historical');
  const staleLinks = linkedEvidenceList.filter(e => e.verification_status === 'stale');

  if (currentLinks.length === 0 && historicalLinks.length === 0 && staleLinks.length === 0) {
    return {
      is_valid: false,
      requires_evidence: true,
      verification_status: 'unverified',
      error: 'Quantitative visual structure blocked: No verified official evidence linked. Fabricated fallback figures are strictly prohibited.',
      renderer: visualSpec.renderer
    };
  }

  const status = currentLinks.length > 0 
    ? 'verified_current' 
    : (historicalLinks.length > 0 ? 'verified_historical' : 'stale');

  return {
    is_valid: true,
    requires_evidence: true,
    verification_status: status,
    refresh_warning: status === 'stale' ? 'Warning: Linked evidence has passed its freshness period. Refresh recommended.' : (status === 'verified_historical' ? 'Notice: Chart renders verified historical series.' : null),
    evidence_count: linkedEvidenceList.length,
    renderer: visualSpec.renderer
  };
}
