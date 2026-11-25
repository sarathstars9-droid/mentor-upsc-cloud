/**
 * backend/services/officialRetrieval/officialRetrievalService.js
 *
 * Master Official Retrieval Orchestrator (Phase 3A / 3A.1).
 * Ingests official documents from approved adapters, supports live network retrieval,
 * deduplicates by content hash, extracts candidate claims, verifies evidence,
 * and enriches canonical issues.
 */

import { query } from '../../db/index.js';
import { validateOfficialUrlAllowlist, validateRedirectSafety, getAdapterForSource } from './sourceAdapterRegistry.js';
import { extractCandidateClaimsFromDocument, verifyAndIngestClaim } from './claimExtractionService.js';
import { enrichIssueWithOfficialEvidence } from '../currentAffairs/issueBuilderService.js';

export const RETRIEVAL_STATUSES = {
  DOCUMENT_FETCHED: 'DOCUMENT_FETCHED',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  DOCUMENT_IMPORTED: 'DOCUMENT_IMPORTED',
  NEW_DOCUMENT_FOUND: 'NEW_DOCUMENT_FOUND',
  NO_NEW_RELEASE: 'NO_NEW_RELEASE',
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
  DOMAIN_UNAUTHORIZED: 'DOMAIN_UNAUTHORIZED',
  PARSE_FAILED: 'PARSE_FAILED',
  CLAIM_NOT_VERIFIED: 'CLAIM_NOT_VERIFIED',
  CLAIM_VERIFIED: 'CLAIM_VERIFIED',
  LIVE_RETRIEVAL_FAILED: 'LIVE_RETRIEVAL_FAILED'
};

/**
 * Perform a live network retrieval from an official source adapter.
 * Stamping 'live_official_retrieval' is strictly reserved for this execution path.
 */
export async function retrieveFromOfficialSourceLive({
  adapterKey,
  topicSlugOrId = null,
  examContext = 'both',
  region = 'india',
  autoLinkIssue = true,
  timeoutMs = 8000
}) {
  const adapter = getAdapterForSource(adapterKey);
  if (!adapter) {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.RETRIEVAL_FAILED,
      error: `No approved adapter registered for "${adapterKey}"`
    };
  }

  if (typeof adapter.fetchLive !== 'function') {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.RETRIEVAL_FAILED,
      error: `Adapter "${adapterKey}" does not implement live network fetching`
    };
  }

  // Resolve source record
  const { rows: sourceRows } = await query(`
    SELECT * FROM official_sources 
    WHERE (domain = $1 OR metadata->'alias_domains' ? $1 OR name ILIKE '%' || $2 || '%') AND active = TRUE
    ORDER BY priority DESC LIMIT 1
  `, [adapter.domain, adapter.key]);

  if (sourceRows.length === 0) {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.DOMAIN_UNAUTHORIZED,
      error: `Official source "${adapter.domain}" is not registered in official_sources allowlist`
    };
  }

  const officialSource = sourceRows[0];

  // Execute live fetch
  const fetchResult = await adapter.fetchLive({
    sourceId: officialSource.id,
    timeoutMs
  });

  if (!fetchResult.success) {
    return {
      adapter: adapterKey,
      requestedUrl: fetchResult.requestedUrl || `https://${adapter.domain}`,
      finalUrl: fetchResult.finalUrl || null,
      httpStatus: fetchResult.httpStatus || 0,
      sourceId: officialSource.id,
      success: false,
      status: fetchResult.status || RETRIEVAL_STATUSES.LIVE_RETRIEVAL_FAILED,
      error: fetchResult.error || 'Live retrieval failed'
    };
  }

  const normalizedDoc = fetchResult.normalizedDoc;

  // Validate URL allowlist & redirect safety
  const redirectCheck = await validateRedirectSafety(fetchResult.requestedUrl, fetchResult.finalUrl);
  if (!redirectCheck.isSafe) {
    return {
      adapter: adapterKey,
      requestedUrl: fetchResult.requestedUrl,
      finalUrl: fetchResult.finalUrl,
      httpStatus: fetchResult.httpStatus,
      sourceId: officialSource.id,
      success: false,
      status: RETRIEVAL_STATUSES.DOMAIN_UNAUTHORIZED,
      error: redirectCheck.reason
    };
  }

  // Deduplicate Document by (source_id, content_hash)
  const { rows: existingDocs } = await query(`
    SELECT id, document_title, retrieved_at, status 
    FROM retrieved_official_documents 
    WHERE source_id = $1 AND content_hash = $2
    LIMIT 1
  `, [officialSource.id, normalizedDoc.contentHash]);

  let docRecordId;
  let isNewDocument = false;

  if (existingDocs.length > 0) {
    docRecordId = existingDocs[0].id;
    isNewDocument = false;
  } else {
    const { rows: inserted } = await query(`
      INSERT INTO retrieved_official_documents (
        source_id, canonical_url, document_title, document_type,
        publication_date, reference_period, retrieved_at, content_hash,
        raw_content, metadata, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'IMPORTED')
      RETURNING id
    `, [
      officialSource.id,
      normalizedDoc.canonicalUrl,
      normalizedDoc.documentTitle,
      normalizedDoc.documentType,
      normalizedDoc.publicationDate,
      normalizedDoc.referencePeriod,
      normalizedDoc.retrievedAt,
      normalizedDoc.contentHash,
      normalizedDoc.text,
      JSON.stringify(normalizedDoc.metadata)
    ]);
    docRecordId = inserted[0].id;
    isNewDocument = true;
  }

  // Extract and verify claims with live_official_retrieval provenance
  const candidateClaims = extractCandidateClaimsFromDocument(normalizedDoc);
  const verifiedEvidenceList = [];

  for (const claim of candidateClaims) {
    const verified = await verifyAndIngestClaim({
      candidateClaim: claim,
      normalizedDoc,
      examContext: officialSource.exam_context || examContext,
      region: officialSource.region || region,
      sourceOverride: officialSource,
      provenanceOrigin: 'live_official_retrieval'
    });
    verifiedEvidenceList.push(verified);
  }

  // Enrich canonical issue if requested
  let issueSummary = null;
  if (autoLinkIssue && (topicSlugOrId || normalizedDoc.documentTitle)) {
    issueSummary = await enrichIssueWithOfficialEvidence({
      topicIdentifier: topicSlugOrId || adapterKey,
      documentTitle: normalizedDoc.documentTitle,
      referencePeriod: normalizedDoc.referencePeriod,
      evidenceList: verifiedEvidenceList,
      examContext: officialSource.exam_context || examContext,
      region: officialSource.region || region,
      sourceDomain: officialSource.domain
    });
  }

  return {
    adapter: adapterKey,
    requestedUrl: fetchResult.requestedUrl,
    finalUrl: fetchResult.finalUrl,
    httpStatus: fetchResult.httpStatus,
    sourceId: officialSource.id,
    documentTitle: normalizedDoc.documentTitle,
    publicationDate: normalizedDoc.publicationDate,
    referencePeriod: normalizedDoc.referencePeriod,
    contentHash: normalizedDoc.contentHash,
    retrievedAt: normalizedDoc.retrievedAt,
    documentId: docRecordId,
    dedupeStatus: isNewDocument ? 'NEW_DOCUMENT_FOUND' : 'DOCUMENT_ALREADY_EXISTS',
    status: isNewDocument ? RETRIEVAL_STATUSES.DOCUMENT_FETCHED : RETRIEVAL_STATUSES.DOCUMENT_ALREADY_EXISTS,
    success: true,
    verifiedEvidenceCount: verifiedEvidenceList.length,
    verifiedEvidence: verifiedEvidenceList,
    linkedIssue: issueSummary
  };
}

/**
 * Ingest an official document through an approved adapter with allowlist validation and deduplication.
 * Accepts an explicit provenanceOrigin ('development_seed', 'test_fixture', 'manual_official_import').
 */
export async function ingestOfficialUpdate({
  adapterKey,
  rawPayload,
  topicSlugOrId = null,
  examContext = 'both',
  region = 'india',
  autoLinkIssue = true,
  provenanceOrigin = 'manual_official_import'
}) {
  // 1. Resolve Adapter
  const adapter = getAdapterForSource(adapterKey);
  if (!adapter) {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.RETRIEVAL_FAILED,
      error: `No approved adapter registered for "${adapterKey}"`
    };
  }

  // 2. Resolve Official Source Record from Database
  const { rows: sourceRows } = await query(`
    SELECT * FROM official_sources 
    WHERE (domain = $1 OR metadata->'alias_domains' ? $1 OR name ILIKE '%' || $2 || '%') AND active = TRUE
    ORDER BY priority DESC LIMIT 1
  `, [adapter.domain, adapter.key]);

  if (sourceRows.length === 0) {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.DOMAIN_UNAUTHORIZED,
      error: `Official source "${adapter.domain}" is not registered in official_sources allowlist`
    };
  }

  const officialSource = sourceRows[0];

  // 3. Normalize Document via Adapter Contract
  let normalizedDoc;
  try {
    normalizedDoc = adapter.normalize({
      sourceId: officialSource.id,
      ...rawPayload,
      metadata: {
        ...(rawPayload.metadata || {}),
        provenance_origin: provenanceOrigin
      }
    });
  } catch (err) {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.RETRIEVAL_FAILED,
      error: `Normalization failed: ${err.message}`
    };
  }

  // 4. Validate URL Allowlist
  const allowlistCheck = await validateOfficialUrlAllowlist(normalizedDoc.canonicalUrl);
  if (!allowlistCheck.isAllowed) {
    return {
      success: false,
      status: RETRIEVAL_STATUSES.DOMAIN_UNAUTHORIZED,
      error: allowlistCheck.reason
    };
  }

  // 5. Deduplicate Document by (source_id, content_hash)
  const { rows: existingDocs } = await query(`
    SELECT id, document_title, retrieved_at, status 
    FROM retrieved_official_documents 
    WHERE source_id = $1 AND content_hash = $2
    LIMIT 1
  `, [officialSource.id, normalizedDoc.contentHash]);

  let docRecordId;
  let isNewDocument = false;

  if (existingDocs.length > 0) {
    docRecordId = existingDocs[0].id;
    isNewDocument = false;
  } else {
    const { rows: inserted } = await query(`
      INSERT INTO retrieved_official_documents (
        source_id, canonical_url, document_title, document_type,
        publication_date, reference_period, retrieved_at, content_hash,
        raw_content, metadata, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'IMPORTED')
      RETURNING id
    `, [
      officialSource.id,
      normalizedDoc.canonicalUrl,
      normalizedDoc.documentTitle,
      normalizedDoc.documentType,
      normalizedDoc.publicationDate,
      normalizedDoc.referencePeriod,
      normalizedDoc.retrievedAt,
      normalizedDoc.contentHash,
      normalizedDoc.text,
      JSON.stringify(normalizedDoc.metadata)
    ]);
    docRecordId = inserted[0].id;
    isNewDocument = true;
  }

  // 6. Extract and Verify Candidate Claims with specified provenance
  const candidateClaims = extractCandidateClaimsFromDocument(normalizedDoc);
  const verifiedEvidenceList = [];

  for (const claim of candidateClaims) {
    const verified = await verifyAndIngestClaim({
      candidateClaim: claim,
      normalizedDoc,
      examContext: officialSource.exam_context || examContext,
      region: officialSource.region || region,
      sourceOverride: officialSource,
      provenanceOrigin
    });
    verifiedEvidenceList.push(verified);
  }

  // 7. Enrich or Link to Canonical Issue if requested
  let issueSummary = null;
  if (autoLinkIssue && (topicSlugOrId || normalizedDoc.documentTitle)) {
    issueSummary = await enrichIssueWithOfficialEvidence({
      topicIdentifier: topicSlugOrId || adapterKey,
      documentTitle: normalizedDoc.documentTitle,
      referencePeriod: normalizedDoc.referencePeriod,
      evidenceList: verifiedEvidenceList,
      examContext: officialSource.exam_context || examContext,
      region: officialSource.region || region,
      sourceDomain: officialSource.domain
    });
  }

  return {
    success: true,
    status: isNewDocument ? RETRIEVAL_STATUSES.NEW_DOCUMENT_FOUND : RETRIEVAL_STATUSES.DOCUMENT_ALREADY_EXISTS,
    documentId: docRecordId,
    contentHash: normalizedDoc.contentHash,
    documentTitle: normalizedDoc.documentTitle,
    publicationDate: normalizedDoc.publicationDate,
    referencePeriod: normalizedDoc.referencePeriod,
    provenanceOrigin,
    verifiedEvidenceCount: verifiedEvidenceList.length,
    verifiedEvidence: verifiedEvidenceList,
    linkedIssue: issueSummary
  };
}
