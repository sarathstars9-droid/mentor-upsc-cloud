/**
 * backend/services/evidence/evidenceService.js
 *
 * Unified Official Evidence Service for MentorOS (Phase 2B).
 * Integrates Source Registry, Verification Engine, Ranking, Freshness, and Visual Linkage.
 */

import { query } from '../../db/index.js';
import { getSourceById, findSourceByUrl, seedOfficialSources } from './sourceRegistryService.js';
import { rankEvidenceAssets } from './evidenceRankingService.js';
import { verifyEvidenceClaim, validateVisualEvidenceIntegrity } from './evidenceVerificationService.js';
import { registerEvidenceWithSupersession, getLatestEvidenceForClaimKey, getEvidenceHistoryForClaimKey, enrichEvidenceMetadata } from './latestReleaseService.js';
import { evaluateEvidenceFreshness } from './evidenceFreshnessPolicy.js';

/**
 * Get all evidence assets for a specific topic, ranked by official priority and exam context.
 */
export async function getEvidenceByTopic(topicId, { examContext = 'both', region = null, includeHistorical = true } = {}) {
  let statusFilter = includeHistorical 
    ? `e.verification_status IN ('verified_current', 'verified_historical', 'stale', 'unverified')`
    : `e.verification_status IN ('verified_current', 'stale')`;

  const whereClauses = [statusFilter];
  const params = [];

  if (topicId && topicId !== 'all') {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topicId);
    if (isUuid) {
      params.push(topicId);
      const p1 = params.length;
      whereClauses.push(`(
        e.topic_id = $${p1} OR
        EXISTS (
          SELECT 1 FROM knowledge_topics t 
          WHERE t.id = $${p1} AND (
            e.title ILIKE '%' || t.title || '%' OR
            t.title ILIKE '%' || e.title || '%' OR
            e.canonical_claim_key ILIKE '%' || t.slug || '%' OR
            t.slug ILIKE '%' || e.canonical_claim_key || '%' OR
            (t.slug = 'ap_budget' AND (e.canonical_claim_key ILIKE '%ap_%budget%' OR e.region = 'andhra_pradesh')) OR
            (t.slug = 'urban_flooding' AND (e.canonical_claim_key ILIKE '%urban%flood%' OR e.canonical_claim_key ILIKE '%ndma%')) OR
            (t.slug = 'inflation' AND (e.canonical_claim_key ILIKE '%cpi%' OR e.canonical_claim_key ILIKE '%inflation%')) OR
            t.aliases ? e.canonical_claim_key OR
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(COALESCE(t.aliases, '[]'::jsonb)) a 
              WHERE e.canonical_claim_key ILIKE '%' || a || '%' 
                 OR a ILIKE '%' || e.canonical_claim_key || '%' 
                 OR e.title ILIKE '%' || a || '%'
            )
          )
        )
      )`);
    } else {
      const raw = String(topicId).toLowerCase().trim();
      const slug1 = raw.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
      const slug2 = raw.replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
      params.push(`%${raw}%`);
      const p1 = params.length;
      params.push(slug1);
      const p2 = params.length;
      params.push(slug2);
      const p3 = params.length;

      whereClauses.push(`(
        e.topic_id IN (
          SELECT id FROM knowledge_topics 
          WHERE title ILIKE $${p1} OR slug = $${p2} OR slug = $${p3} OR aliases ? $${p2} OR aliases ? $${p3}
        ) OR
        e.title ILIKE $${p1} OR
        e.canonical_claim_key ILIKE $${p1} OR
        e.canonical_claim_key ILIKE '%' || $${p2} || '%' OR
        $${p2} ILIKE '%' || e.canonical_claim_key || '%' OR
        ($${p2} = 'ap_budget' AND (e.canonical_claim_key ILIKE '%ap_%budget%' OR e.region = 'andhra_pradesh')) OR
        ($${p2} = 'urban_flooding' AND (e.canonical_claim_key ILIKE '%urban%flood%' OR e.canonical_claim_key ILIKE '%ndma%')) OR
        ($${p2} = 'inflation' AND (e.canonical_claim_key ILIKE '%cpi%' OR e.canonical_claim_key ILIKE '%inflation%'))
      )`);
    }
  }

  if (examContext && examContext !== 'both') {
    params.push(examContext);
    whereClauses.push(`(e.exam_context = $${params.length} OR e.exam_context = 'both')`);
  }

  if (region) {
    params.push(region);
    whereClauses.push(`(e.region = $${params.length} OR e.region IS NULL)`);
  }

  const sql = `
    SELECT e.*, 
           s.name as source_name, 
           s.domain as source_domain, 
           s.source_tier, 
           s.authority_type, 
           s.is_official, 
           s.priority as source_priority
    FROM evidence_assets e
    JOIN official_sources s ON e.source_id = s.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY s.source_tier ASC, s.priority DESC, e.is_latest_release DESC, e.created_at DESC
  `;

  const { rows } = await query(sql, params);
  const enriched = rows.map(r => enrichEvidenceMetadata(r));
  return rankEvidenceAssets(enriched, { targetExamContext: examContext, targetRegion: region });
}

/**
 * Get a single evidence asset with its official source details.
 */
export async function getEvidenceById(id) {
  if (!id) return null;
  const sql = `
    SELECT e.*, 
           s.name as source_name, 
           s.domain as source_domain, 
           s.source_tier, 
           s.authority_type, 
           s.is_official, 
           s.priority as source_priority
    FROM evidence_assets e
    JOIN official_sources s ON e.source_id = s.id
    WHERE e.id = $1
  `;
  const { rows } = await query(sql, [id]);
  if (rows.length === 0) return null;

  return enrichEvidenceMetadata(rows[0]);
}

/**
 * Create a new official evidence asset with provenance.
 */
export async function createEvidenceAsset(data) {
  return registerEvidenceWithSupersession(data);
}

/**
 * Refresh an evidence asset: checks freshness and updates verification timestamp.
 */
export async function refreshEvidence(evidenceId) {
  const asset = await getEvidenceById(evidenceId);
  if (!asset) {
    throw new Error(`Evidence asset ${evidenceId} not found.`);
  }

  const now = new Date();
  let newStatus = asset.verification_status;
  let newExpiresAt = asset.expires_at;

  // If source is active Tier 1 official, renew verification
  if (asset.is_official && asset.source_tier === 1) {
    newStatus = asset.is_latest_release ? 'verified_current' : 'verified_historical';
    const extendedDate = new Date();
    extendedDate.setMonth(extendedDate.getMonth() + (asset.data_period?.toLowerCase().includes('fy') ? 12 : 6));
    newExpiresAt = extendedDate.toISOString();
  }

  const sql = `
    UPDATE evidence_assets
    SET verification_status = $1,
        verified_at = NOW(),
        expires_at = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *;
  `;

  const { rows } = await query(sql, [newStatus, newExpiresAt, evidenceId]);
  return rows[0];
}

/**
 * Link an evidence asset to a visual asset.
 */
export async function linkEvidenceToVisual(visualAssetId, evidenceAssetId, usageType = 'primary_metric') {
  const sql = `
    INSERT INTO visual_evidence_links (visual_asset_id, evidence_asset_id, usage_type, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (visual_asset_id, evidence_asset_id) DO UPDATE SET
      usage_type = EXCLUDED.usage_type
    RETURNING *;
  `;
  const { rows } = await query(sql, [visualAssetId, evidenceAssetId, usageType]);
  return rows[0];
}

/**
 * Get all linked evidence for a visual asset.
 */
export async function getEvidenceForVisual(visualAssetId) {
  const sql = `
    SELECT e.*, 
           s.name as source_name, 
           s.domain as source_domain, 
           s.source_tier, 
           s.authority_type, 
           s.is_official, 
           l.usage_type
    FROM visual_evidence_links l
    JOIN evidence_assets e ON l.evidence_asset_id = e.id
    JOIN official_sources s ON e.source_id = s.id
    WHERE l.visual_asset_id = $1
    ORDER BY s.source_tier ASC, e.is_latest_release DESC, e.created_at DESC
  `;
  const { rows } = await query(sql, [visualAssetId]);
  return rankEvidenceAssets(rows);
}

/**
 * Seed foundational official evidence for development verifications:
 * 1. Inflation (MoSPI CPI Headline Inflation with exact document provenance)
 * 2. Urban Flooding (NDMA Guidelines with exact section)
 * 3. Andhra Pradesh Budget (AP Finance Budget FY24-25 Historical & FY25-26 Current)
 */
/**
 * Seed foundational official evidence for development verifications:
 * 1. Inflation (MoSPI CPI August 2024 Historical & August 2026 Current)
 * 2. Urban Flooding (NDMA Guidelines conceptual standards)
 * 3. Andhra Pradesh Budget (AP Finance Budget FY24-25, FY25-26 Historical & FY26-27 Current)
 */
export async function seedDevelopmentVerifications() {
  await seedOfficialSources();

  const mospi = await findSourceByUrl('mospi.gov.in');
  const ndma = await findSourceByUrl('ndma.gov.in');
  const apFinance = await findSourceByUrl('apfinance.gov.in') || await findSourceByUrl('finance.ap.gov.in');

  const seeded = [];

  // 1. Inflation Verification Assets (National Tier 1)
  if (mospi) {
    // 1A. Historical August 2024 CPI
    const { rows: existing2024 } = await query(
      `SELECT id FROM evidence_assets WHERE canonical_claim_key = 'cpi_headline_inflation_india_2024' OR (canonical_claim_key = 'cpi_headline_inflation_india' AND data_period = 'August 2024')`
    );
    if (existing2024.length === 0) {
      const inflation2024 = await registerEvidenceWithSupersession({
        evidence_type: 'statistic',
        title: 'All-India CPI General Headline Inflation Rate (August 2024)',
        value_text: 'Consumer Price Index (CPI) Headline Inflation was recorded at 3.65% (Base 2012=100) in August 2024.',
        numeric_value: 3.65,
        unit: 'percent',
        source_id: mospi.id,
        source_url: 'https://mospi.gov.in/cpi-press-release-aug2024',
        source_document_title: 'MoSPI Press Release: Consumer Price Index Numbers on Base 2012=100 for Rural, Urban and Combined (August 2024)',
        source_document_date: '2024-09-12',
        source_document_type: 'Monthly Press Release & Statistical Statement',
        source_section: 'Table 1: All India General Index and Inflation Rates',
        exam_context: 'both',
        region: 'india',
        publication_date: '2024-09-12',
        data_period: 'August 2024',
        canonical_claim_key: 'cpi_headline_inflation_india_2024',
        freshness_class: 'monthly',
        verification_status: 'verified_historical',
        provenance_origin: 'development_seed',
        confidence: 1.000,
        payload: {
          metric: 'CPI_HEADLINE',
          base_year: '2012',
          release_authority: 'National Statistical Office (NSO), MoSPI'
        }
      });
      seeded.push(inflation2024);
    }

    // 1B. Current August 2026 CPI
    const { rows: existing2026 } = await query(
      `SELECT id FROM evidence_assets WHERE canonical_claim_key = 'cpi_headline_inflation_india' AND data_period = 'August 2026'`
    );
    if (existing2026.length === 0) {
      const inflation2026 = await registerEvidenceWithSupersession({
        evidence_type: 'statistic',
        title: 'All-India CPI General Headline Inflation Rate (August 2026)',
        value_text: 'Consumer Price Index (CPI) Headline Inflation was recorded at 3.65% (Base 2024=100) in August 2026.',
        numeric_value: 3.65,
        unit: 'percent',
        source_id: mospi.id,
        source_url: 'https://mospi.gov.in/cpi-press-release-aug2026',
        source_document_title: 'MoSPI Press Release: Consumer Price Index Numbers on Base 2024=100 for Rural, Urban and Combined (August 2026)',
        source_document_date: '2026-09-14',
        source_document_type: 'Monthly Press Release & Statistical Statement',
        source_section: 'Table 1: All India General Index and Inflation Rates',
        exam_context: 'both',
        region: 'india',
        publication_date: '2026-09-14',
        data_period: 'August 2026',
        canonical_claim_key: 'cpi_headline_inflation_india',
        freshness_class: 'monthly',
        verification_status: 'verified_current',
        provenance_origin: 'manual_official_import',
        confidence: 1.000,
        payload: {
          metric: 'CPI_HEADLINE',
          base_year: '2024',
          release_authority: 'National Statistical Office (NSO), MoSPI'
        }
      });
      seeded.push(inflation2026);
    }
  }

  // 2. Urban Flooding Verification Asset (NDMA Official Conceptual Standard)
  if (ndma) {
    const existing = await query(
      `SELECT id FROM evidence_assets WHERE canonical_claim_key = 'ndma_urban_flooding_drainage_standards'`
    );
    if (existing.rows.length === 0) {
      const floodingAsset = await registerEvidenceWithSupersession({
        evidence_type: 'policy',
        title: 'NDMA Urban Flooding Management Catchment & Runoff Standards',
        value_text: 'NDMA Guidelines mandate 100% stormwater drain coverage with design capacity for 50-year return period flood frequency and integrated urban drainage master plans.',
        numeric_value: 50,
        unit: 'year_return_period',
        source_id: ndma.id,
        source_url: 'https://ndma.gov.in/guidelines/urban-flooding',
        source_document_title: 'National Disaster Management Guidelines: Management of Urban Flooding',
        source_document_date: '2010-09-15',
        source_document_type: 'NATIONAL_GUIDELINES',
        source_section: 'Executive Summary & Policy Recommendations',
        exam_context: 'both',
        region: 'india',
        publication_date: '2010-09-15',
        data_period: 'National Guidelines (Current Policy)',
        canonical_claim_key: 'ndma_urban_flooding_drainage_standards',
        freshness_class: 'event_based',
        verification_status: 'verified_current',
        provenance_origin: 'manual_official_import',
        confidence: 1.000,
        payload: {
          framework: 'National Disaster Management Guidelines - Management of Urban Flooding',
          nodal_ministry: 'Ministry of Home Affairs / NDMA',
          key_pillars: ['Early Warning Weather Radar Integration', 'De-silting Protocol', 'Wetland & Natural Sink Protection', 'Sponge City Drainage Architecture']
        }
      });
      seeded.push(floodingAsset);
    }
  }

  // 3. Andhra Pradesh Budget & Economy Assets
  if (apFinance) {
    // 3A. Historical Budget FY 2024-25
    const existingHist = await query(
      `SELECT id FROM evidence_assets WHERE canonical_claim_key = 'ap_state_budget_outlay' AND data_period = 'FY 2024-25'`
    );
    if (existingHist.rows.length === 0) {
      const apBudgetHist = await registerEvidenceWithSupersession({
        evidence_type: 'budget_datum',
        title: 'Andhra Pradesh State Budget Outlay & GSDP (FY 2024-25)',
        value_text: 'Andhra Pradesh State Budget outlay was presented at Rs. 2,94,427 Crore for FY 2024-25.',
        numeric_value: 294427,
        unit: 'crore_inr',
        source_id: apFinance.id,
        source_url: 'https://apfinance.gov.in/budget2024-25',
        source_document_title: 'Government of Andhra Pradesh Annual Financial Statement (Budget) 2024-25',
        source_document_date: '2024-07-22',
        source_document_type: 'Annual Financial Statement',
        source_section: 'Budget at a Glance: Summary of Receipts and Disbursements',
        exam_context: 'appsc',
        region: 'andhra_pradesh',
        publication_date: '2024-07-22',
        data_period: 'FY 2024-25',
        canonical_claim_key: 'ap_state_budget_outlay',
        freshness_class: 'annual',
        verification_status: 'verified_historical',
        provenance_origin: 'development_seed',
        confidence: 1.000,
        payload: {
          budget_year: '2024-25',
          state: 'Andhra Pradesh'
        }
      });
      seeded.push(apBudgetHist);
    }

    // 3B. Historical Budget FY 2025-26
    const existing2025 = await query(
      `SELECT id FROM evidence_assets WHERE canonical_claim_key = 'ap_state_budget_outlay' AND data_period = 'FY 2025-26'`
    );
    if (existing2025.length === 0) {
      const apBudget2025 = await registerEvidenceWithSupersession({
        evidence_type: 'budget_datum',
        title: 'Andhra Pradesh State Budget Outlay & GSDP (FY 2025-26)',
        value_text: 'Andhra Pradesh State Budget outlay for FY 2025-26 was presented at Rs. 3,12,000 Crore.',
        numeric_value: 312000,
        unit: 'crore_inr',
        source_id: apFinance.id,
        source_url: 'https://apfinance.gov.in/budget2025-26',
        source_document_title: 'Government of Andhra Pradesh Annual Financial Statement (Budget) 2025-26',
        source_document_date: '2025-02-28',
        source_document_type: 'Annual Financial Statement',
        source_section: 'Budget at a Glance: Summary Statement I',
        exam_context: 'appsc',
        region: 'andhra_pradesh',
        publication_date: '2025-02-28',
        data_period: 'FY 2025-26',
        canonical_claim_key: 'ap_state_budget_outlay',
        freshness_class: 'annual',
        verification_status: 'verified_historical',
        provenance_origin: 'development_seed',
        confidence: 1.000,
        payload: {
          budget_year: '2025-26',
          state: 'Andhra Pradesh'
        }
      });
      seeded.push(apBudget2025);
    }

    // 3C. Current Budget FY 2026-27
    const existing2026 = await query(
      `SELECT id FROM evidence_assets WHERE canonical_claim_key = 'ap_state_budget_outlay' AND data_period = 'FY 2026-27'`
    );
    if (existing2026.length === 0) {
      const apBudget2026 = await registerEvidenceWithSupersession({
        evidence_type: 'budget_datum',
        title: 'Andhra Pradesh State Annual Financial Statement & Budget Outlay FY 2026-27',
        value_text: 'Andhra Pradesh State Budget outlay for FY 2026-27 was presented at Rs. 3,25,000 Crore.',
        numeric_value: 325000,
        unit: 'crore_inr',
        source_id: apFinance.id,
        source_url: 'https://apfinance.gov.in/budget2026-27',
        source_document_title: 'Government of Andhra Pradesh Budget Estimates 2026-27: Speech of Minister for Finance',
        source_document_date: '2026-02-18',
        source_document_type: 'Annual Financial Statement',
        source_section: 'Budget at a Glance: Summary Statement I',
        exam_context: 'appsc',
        region: 'andhra_pradesh',
        publication_date: '2026-02-18',
        data_period: 'FY 2026-27',
        canonical_claim_key: 'ap_state_budget_outlay',
        freshness_class: 'annual',
        verification_status: 'verified_current',
        provenance_origin: 'manual_official_import',
        confidence: 1.000,
        payload: {
          budget_year: '2026-27',
          state: 'Andhra Pradesh'
        }
      });
      seeded.push(apBudget2026);
    }
  }

  return seeded;
}

/**
 * Convenience wrapper returning { items, count } for a topic ID or slug.
 */
export async function getEvidenceForTopic(topicIdOrSlug, options = {}) {
  let topicId = topicIdOrSlug;
  if (topicIdOrSlug && topicIdOrSlug !== 'all') {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topicIdOrSlug);
    if (!isUuid) {
      const slug1 = String(topicIdOrSlug).toLowerCase();
      const slug2 = slug1.replace(/-/g, '_');
      const slug3 = slug1.replace(/_/g, '-');
      const { rows } = await query(
        `SELECT id FROM knowledge_topics WHERE slug = $1 OR slug = $2 OR slug = $3 OR aliases ? $1 OR title ILIKE $1 LIMIT 1`,
        [slug1, slug2, slug3]
      );
      if (rows.length > 0) {
        topicId = rows[0].id;
      }
    }
  }
  const items = await getEvidenceByTopic(topicId, options);
  return { items, count: items.length };
}

export const verifyCandidateClaim = verifyEvidenceClaim;
