/**
 * backend/services/evidence/latestReleaseService.js
 *
 * Supersession & Latest Release Manager for MentorOS Evidence Layer (Phase 2B).
 * 
 * Rules:
 * 1. A newer statistic does NOT overwrite history; both records remain stored.
 * 2. Ingesting a newer release transitions the previous release from 'verified_current' to 'verified_historical' (or 'stale').
 * 3. Builds a linked supersession chain (supersedes_evidence_id <-> superseded_by_evidence_id).
 * 4. Topic/Visual queries retrieve 'verified_current' by default, while trend charts can access the historical series.
 */

import { query } from '../../db/index.js';
import { evaluateEvidenceFreshness } from './evidenceFreshnessPolicy.js';

export const VALID_PROVENANCE_ORIGINS = [
  'live_official_retrieval',
  'manual_official_import',
  'development_seed',
  'test_fixture',
  'unknown'
];

/**
 * Enriches a raw database evidence row with standardized Phase 2B currentness and metadata.
 */
export function enrichEvidenceMetadata(item) {
  if (!item) return null;

  const freshness = evaluateEvidenceFreshness(item);
  const prov = item.provenance_origin || 'unknown';

  const hasFullProvenance = Boolean(
    item.source_document_title && 
    (item.source_document_date || item.publication_date) && 
    item.source_url
  );

  const isTrustedOrigin = prov === 'live_official_retrieval' || prov === 'manual_official_import';

  // Strict check: verified_current requires trusted origin, complete doc provenance, confirmed latest, and fresh status
  let canonicalStatus = item.verification_status;

  if (canonicalStatus === 'verified_current') {
    if (!isTrustedOrigin || !hasFullProvenance || !freshness.isFresh || !freshness.officialLatestConfirmed) {
      canonicalStatus = freshness.isStale ? 'stale' : 'verified_historical';
    }
  } else if (canonicalStatus === 'pending_corroboration') {
    canonicalStatus = 'unverified';
  } else if (canonicalStatus === 'contradicted') {
    canonicalStatus = 'disputed';
  }

  const officialLatestConfirmed = Boolean(
    isTrustedOrigin && 
    hasFullProvenance && 
    freshness.isFresh && 
    freshness.officialLatestConfirmed
  );

  const refreshRequired = !officialLatestConfirmed || freshness.refreshRequired || freshness.isStale;

  return {
    ...item,
    ...freshness,
    verification_status: canonicalStatus,
    verificationStatus: canonicalStatus,
    freshness_status: freshness.freshnessStatus,
    freshnessStatus: freshness.freshnessStatus,
    is_fresh: freshness.isFresh,
    is_stale: freshness.isStale,
    latest_in_catalog: Boolean(item.is_latest_release),
    latestInCatalog: Boolean(item.is_latest_release),
    official_latest_confirmed: officialLatestConfirmed,
    officialLatestConfirmed,
    refresh_required: refreshRequired,
    refreshRequired,
    provenance_origin: prov,
    provenanceOrigin: prov,
    data_period: item.data_period,
    dataPeriod: item.data_period,
    document_date: item.source_document_date || item.publication_date,
    documentDate: item.source_document_date || item.publication_date,
    retrieved_at: item.retrieved_at || item.created_at,
    retrievedAt: item.retrieved_at || item.created_at,
    refresh_warning: refreshRequired ? (freshness.refresh_warning || freshness.reason) : null
  };
}

/**
 * Register or update an official evidence asset with automated supersession chaining.
 */
export async function registerEvidenceWithSupersession(evidenceData) {
  const {
    topic_id = null,
    evidence_type,
    title,
    value_text,
    numeric_value = null,
    unit = null,
    source_id,
    source_url = null,
    exam_context = 'both',
    region = 'india',
    publication_date = null,
    data_period = null,
    source_document_title = null,
    source_document_date = null,
    source_document_type = null,
    source_page_number = null,
    source_section = null,
    content_hash = null,
    canonical_claim_key = null,
    freshness_class = 'annual',
    confidence = 1.0,
    provenance_origin = 'unknown',
    payload = {}
  } = evidenceData;

  const docDate = source_document_date || publication_date;
  const canonicalKey = canonical_claim_key || generateCanonicalKey(title, evidence_type, region);

  // Validate provenance origin
  const validOrigin = VALID_PROVENANCE_ORIGINS.includes(provenance_origin) 
    ? provenance_origin 
    : 'unknown';

  // Evaluate freshness
  const freshness = evaluateEvidenceFreshness({
    evidence_type,
    canonical_claim_key: canonicalKey,
    title,
    source_document_date: docDate,
    data_period,
    expires_at: evidenceData.expires_at,
    freshness_class
  });

  const hasFullProvenance = Boolean(
    source_document_title && 
    docDate && 
    source_url
  );

  const isTrustedOrigin = validOrigin === 'live_official_retrieval' || validOrigin === 'manual_official_import';

  let verificationStatus = evidenceData.verification_status;
  if (!verificationStatus) {
    if (isTrustedOrigin && hasFullProvenance && freshness.isFresh && freshness.officialLatestConfirmed) {
      verificationStatus = 'verified_current';
    } else if (freshness.isStale) {
      verificationStatus = 'stale';
    } else {
      verificationStatus = 'verified_historical';
    }
  } else if (verificationStatus === 'verified_current') {
    if (!isTrustedOrigin || !hasFullProvenance || !freshness.isFresh || !freshness.officialLatestConfirmed) {
      verificationStatus = freshness.isStale ? 'stale' : 'verified_historical';
    }
  }

  const officialLatestConfirmed = Boolean(
    isTrustedOrigin && 
    hasFullProvenance && 
    freshness.isFresh && 
    freshness.officialLatestConfirmed
  );

  // 1. Check if an existing latest release exists for this canonical claim key
  let previousLatestId = null;
  if (canonicalKey) {
    const { rows: existingRows } = await query(
      `SELECT id, publication_date, source_document_date 
       FROM evidence_assets 
       WHERE canonical_claim_key = $1 AND is_latest_release = TRUE 
       ORDER BY publication_date DESC NULLS LAST, created_at DESC 
       LIMIT 1`,
      [canonicalKey]
    );

    if (existingRows.length > 0) {
      const prev = existingRows[0];
      const prevDate = prev.source_document_date || prev.publication_date;
      const newDate = docDate ? new Date(docDate) : null;
      
      if (!prevDate || !newDate || newDate >= new Date(prevDate)) {
        previousLatestId = prev.id;
      }
    }
  }

  // 2. Insert the new evidence asset
  const insertSql = `
    INSERT INTO evidence_assets (
      topic_id, evidence_type, title, value_text, numeric_value, unit,
      source_id, source_url, exam_context, region, publication_date,
      data_period, verification_status, confidence, verified_at, expires_at,
      source_document_title, source_document_date, source_document_type,
      source_page_number, source_section, retrieved_at, content_hash,
      is_latest_release, supersedes_evidence_id, canonical_claim_key,
      freshness_class, next_check_at, provenance_origin, official_latest_confirmed, payload, created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, NOW(), $15, $16, $17, $18,
      $19, $20, NOW(), $21, TRUE, $22, $23,
      $24, $25, $26, $27, $28::jsonb, NOW(), NOW()
    )
    RETURNING *;
  `;

  const { rows: inserted } = await query(insertSql, [
    topic_id,
    evidence_type,
    title,
    value_text,
    numeric_value !== null ? Number(numeric_value) : null,
    unit,
    source_id,
    source_url,
    exam_context,
    region,
    publication_date,
    data_period,
    verificationStatus,
    Number(confidence),
    freshness.expiresAt || null,
    source_document_title,
    source_document_date,
    source_document_type,
    source_page_number,
    source_section,
    content_hash,
    previousLatestId,
    canonicalKey,
    freshness.freshnessClass,
    freshness.nextCheckAt || null,
    validOrigin,
    officialLatestConfirmed,
    JSON.stringify(payload)
  ]);

  const newAsset = inserted[0];

  // 3. If there was a previous latest, mark it as historical and link backward
  if (previousLatestId) {
    await query(
      `UPDATE evidence_assets 
       SET is_latest_release = FALSE,
           superseded_by_evidence_id = $1,
           verification_status = 'verified_historical',
           official_latest_confirmed = FALSE,
           updated_at = NOW()
       WHERE id = $2`,
      [newAsset.id, previousLatestId]
    );
  }

  return enrichEvidenceMetadata(newAsset);
}

/**
 * Retrieve the latest current official evidence for a canonical claim key.
 */
export async function getLatestEvidenceForClaimKey(canonicalClaimKey) {
  if (!canonicalClaimKey) return null;
  const sql = `
    SELECT e.*, 
           s.name as source_name, 
           s.domain as source_domain, 
           s.source_tier, 
           s.authority_type, 
           s.is_official
    FROM evidence_assets e
    JOIN official_sources s ON e.source_id = s.id
    WHERE e.canonical_claim_key = $1
    ORDER BY e.is_latest_release DESC, e.publication_date DESC NULLS LAST, e.created_at DESC
    LIMIT 1;
  `;
  const { rows } = await query(sql, [canonicalClaimKey]);
  if (rows.length === 0) return null;

  return enrichEvidenceMetadata(rows[0]);
}

/**
 * Retrieve chronological evidence history for trend visualization.
 */
export async function getEvidenceHistoryForClaimKey(canonicalClaimKey) {
  if (!canonicalClaimKey) return [];
  const sql = `
    SELECT e.*, 
           s.name as source_name, 
           s.domain as source_domain, 
           s.source_tier, 
           s.authority_type, 
           s.is_official
    FROM evidence_assets e
    JOIN official_sources s ON e.source_id = s.id
    WHERE e.canonical_claim_key = $1
    ORDER BY e.publication_date DESC NULLS LAST, e.created_at DESC;
  `;
  const { rows } = await query(sql, [canonicalClaimKey]);
  return rows.map(r => enrichEvidenceMetadata(r));
}

function generateCanonicalKey(title, type, region) {
  const normTitle = (title || 'claim')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const normRegion = region ? `_${region.toLowerCase()}` : '';
  return `${type || 'fact'}_${normTitle}${normRegion}`.slice(0, 80);
}
