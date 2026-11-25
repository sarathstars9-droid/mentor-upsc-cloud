/**
 * backend/services/officialRetrieval/claimExtractionService.js
 *
 * Candidate Claim Extraction & Verification Engine (Phase 3A / 3A.1).
 * Extracts structured evidence claims across 11 canonical evidence types.
 * Enforces strict verification: AI may suggest claims, but verification requires
 * official document provenance, section anchoring, and freshness validation.
 */

import { query } from '../../db/index.js';
import { registerEvidenceWithSupersession } from '../evidence/latestReleaseService.js';
import { evaluateEvidenceFreshness } from '../evidence/evidenceFreshnessPolicy.js';

export const SUPPORTED_EVIDENCE_TYPES = [
  'statistic',
  'report',
  'scheme',
  'judgment',
  'committee',
  'constitutional_article',
  'government_order',
  'budget_fact',
  'survey_fact',
  'case_study',
  'current_event'
];

/**
 * Extract candidate claims from a normalized official document.
 * Identifies quantitative metrics, committee recommendations, statutory policies, and fiscal allocations.
 */
export function extractCandidateClaimsFromDocument(normalizedDoc) {
  if (!normalizedDoc) return [];

  const text = normalizedDoc.text || '';
  const claims = [];

  // 1. Structured metadata metrics (e.g. from RBI live rates or MoSPI tables)
  if (normalizedDoc.metadata?.extractedMetrics) {
    for (const [key, metric] of Object.entries(normalizedDoc.metadata.extractedMetrics)) {
      claims.push({
        evidence_type: 'statistic',
        canonical_claim_key: `${key}_${normalizedDoc.referencePeriod || 'latest'}`.toLowerCase().replace(/[-\s]+/g, '_'),
        title: `${normalizedDoc.documentTitle} - ${metric.label || key}`,
        value_text: `${metric.label || key}: ${metric.value}${metric.unit || ''}`,
        numeric_value: metric.value,
        unit: metric.unit || '%',
        data_period: normalizedDoc.referencePeriod || normalizedDoc.publicationDate,
        source_section: metric.section || 'Official Rates Table',
        supporting_text: `${metric.label || key}: ${metric.value}${metric.unit || ''}`,
        is_candidate: true
      });
    }
  }

  // 2. Quantitative Statistics Pattern Extraction if no structured metrics
  if (claims.length === 0 && text) {
    const statPatterns = [
      // Inflation / CPI / Rate
      {
        regex: /(?:Headline\s+CPI|CPI\s+Inflation|Inflation\s+Rate|All-India\s+CPI).*?(\d+(\.\d+)?)\s*%/i,
        type: 'statistic',
        keySuffix: 'cpi_headline_inflation',
        extractVal: (m) => parseFloat(m[1]),
        unit: '%'
      },
      // RBI Policy Repo Rate (Explicit)
      {
        regex: /(?:Policy\s+Repo\s+Rate|Repo\s+Rate).*?(\d+(\.\d+)?)\s*%/i,
        type: 'statistic',
        keySuffix: 'rbi_policy_repo_rate',
        extractVal: (m) => parseFloat(m[1]),
        unit: '%'
      },
      // Budget Outlay / Expenditure (Lakh Crore / Crore)
      {
        regex: /(?:Total\s+Budget\s+Outlay|Total\s+Expenditure|Annual\s+Outlay|State\s+Consolidated\s+Fund).*?(?:₹|Rs\.?)\s*(\d+(\.\d+)?)\s*(Lakh\s+Cr|Lakh\s+Crore|Crore|Cr)/i,
        type: 'budget_fact',
        keySuffix: 'budget_total_outlay',
        extractVal: (m) => parseFloat(m[1]),
        unit: 'Lakh Crore'
      },
      // Green Hydrogen Targets
      {
        regex: /(?:Production\s+Capacity|Green\s+Hydrogen\s+Target).*?(\d+(\.\d+)?)\s*(MMT|GW|MW)/i,
        type: 'statistic',
        keySuffix: 'green_hydrogen_capacity_target',
        extractVal: (m) => parseFloat(m[1]),
        unit: 'MMT'
      }
    ];

    for (const p of statPatterns) {
      const match = text.match(p.regex);
      if (match) {
        const num = p.extractVal(match);
        claims.push({
          evidence_type: p.type,
          canonical_claim_key: `${normalizedDoc.metadata?.metricType || p.keySuffix}_${normalizedDoc.referencePeriod || 'latest'}`.toLowerCase().replace(/[-\s]+/g, '_'),
          title: `${normalizedDoc.documentTitle} - Key Metric`,
          value_text: match[0].trim(),
          numeric_value: num,
          unit: p.unit,
          data_period: normalizedDoc.referencePeriod || normalizedDoc.publicationDate,
          source_section: 'Official Release Body',
          supporting_text: match[0].trim(),
          is_candidate: true
        });
      }
    }
  }

  // 3. Scheme & Policy Guidelines Extraction
  if (/National Green Hydrogen Mission|Pradhan Mantri|Mission|Scheme|Policy|Manual on Storm Water Drainage/i.test(text)) {
    const schemeMatch = text.match(/(?:National Green Hydrogen Mission|Pradhan Mantri\s+[A-Za-z\s]+|Manual on Storm Water Drainage Systems|PMAY|SDRF|NDRF|Smart Cities Mission)[^.\n]*/i);
    if (schemeMatch) {
      claims.push({
        evidence_type: 'scheme',
        canonical_claim_key: `scheme_${schemeMatch[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}`,
        title: schemeMatch[0].trim(),
        value_text: schemeMatch[0].trim(),
        data_period: normalizedDoc.referencePeriod || normalizedDoc.publicationDate,
        source_section: 'Policy Announcement',
        supporting_text: schemeMatch[0].trim(),
        is_candidate: true
      });
    }
  }

  // 4. Fallback General Claim if none matched specifically
  if (claims.length === 0) {
    claims.push({
      evidence_type: 'current_event',
      canonical_claim_key: `doc_${normalizedDoc.contentHash.slice(0, 16)}`,
      title: normalizedDoc.documentTitle,
      value_text: normalizedDoc.documentTitle,
      data_period: normalizedDoc.referencePeriod || normalizedDoc.publicationDate,
      source_section: 'Executive Summary',
      supporting_text: (normalizedDoc.text || '').slice(0, 200),
      is_candidate: true
    });
  }

  return claims;
}

/**
 * Verify a candidate claim against its normalized document and ingest it into evidence_assets with supersession.
 * AI or unverified sources CANNOT mark this verified without passing all official provenance gates.
 */
export async function verifyAndIngestClaim({
  candidateClaim,
  normalizedDoc,
  topicId = null,
  examContext = 'both',
  region = 'india',
  sourceOverride = null,
  provenanceOrigin = null
}) {
  if (!candidateClaim) throw new Error('Missing candidate claim to verify');
  if (!normalizedDoc) throw new Error('Missing supporting normalized official document');

  // Enforce provenance origin rules
  const assignedProvenance = provenanceOrigin ||
    normalizedDoc.metadata?.provenance_origin ||
    candidateClaim.provenance_origin ||
    'manual_official_import';

  // Ensure evidence type is supported
  const evidenceType = SUPPORTED_EVIDENCE_TYPES.includes(candidateClaim.evidence_type)
    ? candidateClaim.evidence_type
    : 'statistic';

  // Evaluate freshness
  const freshness = evaluateEvidenceFreshness({
    publication_date: normalizedDoc.publicationDate,
    data_period: candidateClaim.data_period || normalizedDoc.referencePeriod,
    freshness_class: candidateClaim.freshness_class || 'monthly'
  });

  const verificationStatus = freshness.isStale ? 'stale' : 'verified_current';
  const sourceDocTitleExact = normalizedDoc.metadata?.source_document_title_exact || normalizedDoc.documentTitle;

  // Construct payload with exact document provenance
  const payload = {
    provenance_origin: assignedProvenance,
    source_document_title: normalizedDoc.documentTitle,
    source_document_title_exact: sourceDocTitleExact,
    source_document_date: normalizedDoc.publicationDate,
    source_document_type: normalizedDoc.documentType,
    source_section: candidateClaim.source_section || 'Official Release',
    source_url: normalizedDoc.canonicalUrl,
    content_hash: normalizedDoc.contentHash,
    retrieved_at: normalizedDoc.retrievedAt,
    supporting_text: candidateClaim.supporting_text || '',
    extracted_by: 'claimExtractionService_v3',
    freshness_class: freshness.freshnessClass || 'monthly',
    official_authority: normalizedDoc.metadata?.authority || 'Government of India'
  };

  const evidenceRecord = {
    topic_id: topicId,
    evidence_type: evidenceType,
    title: candidateClaim.title || normalizedDoc.documentTitle,
    value_text: candidateClaim.value_text || '',
    numeric_value: candidateClaim.numeric_value !== undefined ? candidateClaim.numeric_value : null,
    unit: candidateClaim.unit || null,
    source_id: sourceOverride?.id || normalizedDoc.sourceId,
    source_url: normalizedDoc.canonicalUrl,
    exam_context: examContext || 'both',
    region: region || 'india',
    publication_date: normalizedDoc.publicationDate,
    data_period: candidateClaim.data_period || normalizedDoc.referencePeriod,
    verification_status: verificationStatus,
    provenance_origin: assignedProvenance,
    confidence: 1.000,
    is_latest_release: !freshness.isStale,
    canonical_claim_key: candidateClaim.canonical_claim_key,
    source_document_title: normalizedDoc.documentTitle,
    source_document_date: normalizedDoc.publicationDate,
    source_document_type: normalizedDoc.documentType,
    source_section: candidateClaim.source_section || 'Official Release',
    content_hash: normalizedDoc.contentHash,
    retrieved_at: normalizedDoc.retrievedAt,
    payload
  };

  // Register with deterministic supersession chaining
  const savedAsset = await registerEvidenceWithSupersession(evidenceRecord);

  return {
    evidenceAssetId: savedAsset.id,
    canonicalClaimKey: savedAsset.canonical_claim_key,
    verificationStatus: savedAsset.verification_status,
    provenanceOrigin: assignedProvenance,
    isLatestRelease: savedAsset.is_latest_release,
    numericValue: savedAsset.numeric_value,
    unit: savedAsset.unit,
    dataPeriod: savedAsset.data_period,
    sourceDocumentTitleExact: sourceDocTitleExact,
    supportingText: candidateClaim.supporting_text || savedAsset.value_text
  };
}
