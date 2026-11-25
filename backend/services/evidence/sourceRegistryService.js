/**
 * backend/services/evidence/sourceRegistryService.js
 *
 * Official Source Registry for MentorOS Evidence Layer (Phase 2A).
 * Provides official-first source catalog for UPSC and APPSC exams.
 */

import { query } from '../../db/index.js';

export const OFFICIAL_SOURCE_SEEDS = [
  // ── National Official Sources (Tier 1) ──────────────────────────────────
  {
    name: 'Press Information Bureau (PIB)',
    domain: 'pib.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['governance', 'schemes', 'economy', 'current_affairs', 'cabinet_decisions'],
    is_official: true,
    priority: 100,
    metadata: { agency: 'Ministry of Information and Broadcasting', description: 'Nodal agency for government communications & official policy releases' }
  },
  {
    name: 'Union Public Service Commission (UPSC)',
    domain: 'upsc.gov.in',
    source_tier: 1,
    authority_type: 'CONSTITUTIONAL_BODY',
    exam_context: 'upsc',
    region: 'india',
    subject_tags: ['syllabus', 'notifications', 'civil_services', 'constitutional'],
    is_official: true,
    priority: 100,
    metadata: { article: 'Article 315-323', description: 'Constitutional recruiting agency for civil services of India' }
  },
  {
    name: 'Reserve Bank of India (RBI)',
    domain: 'rbi.org.in',
    source_tier: 1,
    authority_type: 'CENTRAL_BANK',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['economy', 'monetary_policy', 'banking', 'inflation', 'forex', 'financial_stability'],
    is_official: true,
    priority: 100,
    metadata: { publication_types: ['Monetary Policy Report', 'Financial Stability Report', 'Annual Report'] }
  },
  {
    name: 'Ministry of Statistics and Programme Implementation (MoSPI)',
    domain: 'mospi.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['economy', 'cpi_inflation', 'gdp', 'iip', 'plfs', 'statistics'],
    is_official: true,
    priority: 100,
    metadata: { releases: ['CPI', 'IIP', 'GDP Quarterly Estimates', 'Periodic Labour Force Survey'] }
  },
  {
    name: 'NITI Aayog',
    domain: 'niti.gov.in',
    source_tier: 1,
    authority_type: 'POLICY_THINK_TANK',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['development', 'sdg_index', 'governance', 'multidimensional_poverty', 'agriculture', 'innovation'],
    is_official: true,
    priority: 100,
    metadata: { reports: ['SDG India Index', 'National Multidimensional Poverty Index', 'State Energy Index'] }
  },
  {
    name: 'Union Budget & Economic Survey (Ministry of Finance)',
    domain: 'indiabudget.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['economy', 'budget', 'fiscal_policy', 'economic_survey', 'taxation', 'capital_expenditure'],
    is_official: true,
    priority: 100,
    metadata: { series: ['Union Budget Outlay', 'Economic Survey Chapter Evidence', 'Receipts & Expenditure'] }
  },
  {
    name: 'Comptroller and Auditor General of India (CAG)',
    domain: 'cag.gov.in',
    source_tier: 1,
    authority_type: 'CONSTITUTIONAL_BODY',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['polity', 'audit', 'financial_accountability', 'governance', 'public_accounts'],
    is_official: true,
    priority: 100,
    metadata: { article: 'Article 148-151', reports: ['Compliance Audit', 'Performance Audit', 'Financial Audit'] }
  },
  {
    name: 'Supreme Court of India',
    domain: 'sci.gov.in',
    source_tier: 1,
    authority_type: 'JUDICIAL_APEX',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['polity', 'judgments', 'constitutional_bench', 'fundamental_rights', 'jurisprudence'],
    is_official: true,
    priority: 100,
    metadata: { repository: 'Official Supreme Court Judgments & Case Status' }
  },
  {
    name: 'Election Commission of India (ECI)',
    domain: 'eci.gov.in',
    source_tier: 1,
    authority_type: 'CONSTITUTIONAL_BODY',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['polity', 'electoral_reforms', 'model_code_of_conduct', 'voter_turnout', 'delimitations'],
    is_official: true,
    priority: 100,
    metadata: { article: 'Article 324', repository: 'Electoral data and reform reports' }
  },
  {
    name: 'National Disaster Management Authority (NDMA)',
    domain: 'ndma.gov.in',
    source_tier: 1,
    authority_type: 'STATUTORY_BODY',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['disaster_management', 'urban_flooding', 'cyclone', 'earthquake', 'resilience', 'mitigation'],
    is_official: true,
    priority: 100,
    metadata: { guidelines: ['Management of Urban Flooding', 'National Disaster Management Plan (NDMP)'] }
  },
  {
    name: 'India Meteorological Department (IMD)',
    domain: 'mausam.imd.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['geography', 'monsoon', 'cyclones', 'rainfall_anomalies', 'weather_bulletins'],
    is_official: true,
    priority: 100,
    metadata: { alias_domains: ['imd.gov.in'], division: 'Ministry of Earth Sciences' }
  },
  {
    name: 'Indian Space Research Organisation (ISRO)',
    domain: 'isro.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['science_tech', 'space', 'chandrayaan', 'gaganyaan', 'remote_sensing', 'satellites'],
    is_official: true,
    priority: 100,
    metadata: { department: 'Department of Space' }
  },
  {
    name: 'Ministry of External Affairs (MEA)',
    domain: 'mea.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['international_relations', 'bilateral', 'multilateral', 'treaties', 'foreign_policy', 'diaspora'],
    is_official: true,
    priority: 100,
    metadata: { type: 'Official bilateral agreements and foreign policy briefs' }
  },
  {
    name: 'Ministry of Environment, Forest and Climate Change (MoEFCC)',
    domain: 'moef.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['environment', 'climate_change', 'isfr', 'biodiversity', 'pollution', 'cop_commitments'],
    is_official: true,
    priority: 100,
    metadata: { key_reports: ['India State of Forest Report (ISFR)', 'National Action Plan on Climate Change (NAPCC)'] }
  },
  {
    name: 'Open Government Data Platform India (data.gov.in)',
    domain: 'data.gov.in',
    source_tier: 1,
    authority_type: 'OPEN_DATA_PORTAL',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['open_data', 'statistics', 'census', 'sectoral_metrics'],
    is_official: true,
    priority: 95,
    metadata: { portal: 'National data sharing and accessibility portal' }
  },

  // ── Andhra Pradesh Official Sources (Tier 1 State) ──────────────────────────
  {
    name: 'Andhra Pradesh Public Service Commission (APPSC)',
    domain: 'psc.ap.gov.in',
    source_tier: 1,
    authority_type: 'CONSTITUTIONAL_BODY',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['appsc_group1', 'appsc_syllabus', 'state_services', 'notifications'],
    is_official: true,
    priority: 120, // Boosted above national for APPSC
    metadata: { state: 'Andhra Pradesh', role: 'Constitutional state examining agency' }
  },
  {
    name: 'Government of Andhra Pradesh Official Portal',
    domain: 'ap.gov.in',
    source_tier: 1,
    authority_type: 'STATE_PORTAL',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['andhra_pradesh', 'state_policy', 'navaratnalu', 'governance', 'state_administration'],
    is_official: true,
    priority: 115,
    metadata: { state: 'Andhra Pradesh' }
  },
  {
    name: 'Finance Department, Government of Andhra Pradesh (apfinance.gov.in)',
    domain: 'apfinance.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['ap_economy', 'ap_budget', 'gsdp', 'fiscal_deficit', 'revenue_expenditure', 'state_finances'],
    is_official: true,
    priority: 125, // Top priority for AP economic & budget evidence
    metadata: { state: 'Andhra Pradesh', alias_domains: ['finance.ap.gov.in', 'budget.ap.gov.in'], key_documents: ['AP State Budget Outlay', 'Socio-Economic Survey of Andhra Pradesh', 'FRBM Compliance'] }
  },
  {
    name: 'Andhra Pradesh State Disaster Management Authority (APSDMA)',
    domain: 'apsdma.ap.gov.in',
    source_tier: 1,
    authority_type: 'STATUTORY_BODY',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['disaster_management', 'cyclone', 'coastal_flooding', 'early_warning', 'andhra_pradesh'],
    is_official: true,
    priority: 120,
    metadata: { state: 'Andhra Pradesh', focus: ['Bay of Bengal Cyclones', 'Krishna/Godavari River Floods'] }
  },
  {
    name: 'Andhra Pradesh e-Gazette',
    domain: 'apegazette.cgg.gov.in',
    source_tier: 1,
    authority_type: 'OFFICIAL_GAZETTE',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['gazette', 'acts', 'ordinances', 'government_orders', 'andhra_pradesh'],
    is_official: true,
    priority: 120,
    metadata: { state: 'Andhra Pradesh', description: 'Official digital gazette for state laws, rules & statutory orders' }
  },
  {
    name: 'Directorate of Economics & Statistics, Andhra Pradesh (AP DES)',
    domain: 'des.ap.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['ap_statistics', 'gsdp_growth', 'per_capita_income', 'agriculture_census', 'crop_estimates'],
    is_official: true,
    priority: 120,
    metadata: { state: 'Andhra Pradesh', flagship_publication: 'Socio Economic Survey of Andhra Pradesh' }
  },
  {
    name: 'Planning Department, Government of Andhra Pradesh',
    domain: 'planning.ap.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['planning', 'sdg_andhra', 'human_development', 'regional_development', 'andhra_pradesh'],
    is_official: true,
    priority: 115,
    metadata: { state: 'Andhra Pradesh' }
  },
  {
    name: 'Water Resources Department, Andhra Pradesh',
    domain: 'irrigationap.cgg.gov.in',
    source_tier: 1,
    authority_type: 'PRIMARY_OFFICIAL',
    exam_context: 'appsc',
    region: 'andhra_pradesh',
    subject_tags: ['irrigation', 'polavaram', 'krishna_delta', 'godavari', 'water_resources', 'andhra_pradesh'],
    is_official: true,
    priority: 115,
    metadata: { state: 'Andhra Pradesh' }
  },

  // ── Institutional / International (Tier 2) ──────────────────────────────────
  {
    name: 'World Bank',
    domain: 'worldbank.org',
    source_tier: 2,
    authority_type: 'INTERNATIONAL_INSTITUTION',
    exam_context: 'both',
    region: null,
    subject_tags: ['global_economy', 'poverty_lines', 'ease_of_doing_business', 'climate_finance'],
    is_official: false,
    priority: 70,
    metadata: { type: 'Multilateral development bank' }
  },
  {
    name: 'International Monetary Fund (IMF)',
    domain: 'imf.org',
    source_tier: 2,
    authority_type: 'INTERNATIONAL_INSTITUTION',
    exam_context: 'both',
    region: null,
    subject_tags: ['world_economic_outlook', 'global_growth', 'bop', 'sdr'],
    is_official: false,
    priority: 70,
    metadata: { reports: ['World Economic Outlook (WEO)', 'Global Financial Stability Report'] }
  },
  {
    name: 'Intergovernmental Panel on Climate Change (IPCC)',
    domain: 'ipcc.ch',
    source_tier: 2,
    authority_type: 'INTERNATIONAL_INSTITUTION',
    exam_context: 'both',
    region: null,
    subject_tags: ['climate_science', 'assessment_reports', 'global_warming_1_5c', 'mitigation'],
    is_official: false,
    priority: 75,
    metadata: { reports: ['AR6 Synthesis Report', 'Working Group I/II/III'] }
  },
  {
    name: 'World Health Organization (WHO)',
    domain: 'who.int',
    source_tier: 2,
    authority_type: 'INTERNATIONAL_INSTITUTION',
    exam_context: 'both',
    region: null,
    subject_tags: ['health', 'air_quality_guidelines', 'disease_burden', 'pandemics'],
    is_official: false,
    priority: 70,
    metadata: { agency: 'UN Specialized Agency for Health' }
  },

  // ── Explanatory & Analytical (Tier 3) ──────────────────────────────────────
  {
    name: 'PRS Legislative Research',
    domain: 'prsindia.org',
    source_tier: 3,
    authority_type: 'PARLIAMENTARY_RESEARCH_THINK_TANK',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['bills', 'parliamentary_standing_committees', 'acts_analysis', 'ordinances'],
    is_official: false,
    priority: 50,
    metadata: { type: 'Independent legislative analytical research' }
  },
  {
    name: 'Manohar Parrikar Institute for Defence Studies and Analyses (MP-IDSA)',
    domain: 'idsa.in',
    source_tier: 3,
    authority_type: 'STRATEGIC_THINK_TANK',
    exam_context: 'both',
    region: 'india',
    subject_tags: ['internal_security', 'defence', 'geopolitics', 'border_management'],
    is_official: false,
    priority: 45,
    metadata: { type: 'Security & strategic studies think tank' }
  }
];

/**
 * Seed all official sources idempotently into Postgres.
 */
export async function seedOfficialSources() {
  const results = [];
  for (const src of OFFICIAL_SOURCE_SEEDS) {
    const existing = await query(`SELECT id FROM official_sources WHERE LOWER(domain) = LOWER($1)`, [src.domain]);
    
    if (existing.rows.length > 0) {
      const updated = await query(
        `
        UPDATE official_sources
        SET name = $1,
            source_tier = $2,
            authority_type = $3,
            exam_context = $4,
            region = $5,
            subject_tags = $6::jsonb,
            is_official = $7,
            priority = $8,
            active = TRUE,
            metadata = $9::jsonb,
            updated_at = NOW()
        WHERE id = $10
        RETURNING id, name, domain;
        `,
        [
          src.name,
          src.source_tier,
          src.authority_type,
          src.exam_context,
          src.region,
          JSON.stringify(src.subject_tags || []),
          src.is_official !== false,
          src.priority || 100,
          JSON.stringify(src.metadata || {}),
          existing.rows[0].id
        ]
      );
      if (updated.rows.length > 0) results.push(updated.rows[0]);
    } else {
      const ins = await query(
        `
        INSERT INTO official_sources (
          name, domain, source_tier, authority_type, exam_context, region,
          subject_tags, is_official, priority, active, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, TRUE, $10::jsonb, NOW(), NOW())
        RETURNING id, name, domain;
        `,
        [
          src.name,
          src.domain.toLowerCase().trim(),
          src.source_tier,
          src.authority_type,
          src.exam_context,
          src.region,
          JSON.stringify(src.subject_tags || []),
          src.is_official !== false,
          src.priority || 100,
          JSON.stringify(src.metadata || {})
        ]
      );
      if (ins.rows.length > 0) results.push(ins.rows[0]);
    }
  }
  return results;
}

/**
 * Query official sources from database with comprehensive filtering.
 */
export async function getOfficialSources({
  examContext = null,
  region = null,
  sourceTier = null,
  activeOnly = true,
  tag = null,
  domain = null,
  search = null
} = {}) {
  let conditions = [];
  let params = [];
  let paramIdx = 1;

  if (activeOnly) {
    conditions.push(`active = TRUE`);
  }

  if (examContext) {
    // Matches specific exam or 'both'
    conditions.push(`(exam_context = $${paramIdx} OR exam_context = 'both')`);
    params.push(examContext.toLowerCase());
    paramIdx++;
  }

  if (region) {
    conditions.push(`(region = $${paramIdx} OR region IS NULL)`);
    params.push(region.toLowerCase());
    paramIdx++;
  }

  if (sourceTier) {
    conditions.push(`source_tier = $${paramIdx}`);
    params.push(Number(sourceTier));
    paramIdx++;
  }

  if (domain) {
    conditions.push(`(domain ILIKE $${paramIdx} OR metadata->'alias_domains' ? $${paramIdx + 1})`);
    params.push(`%${domain}%`, domain);
    paramIdx += 2;
  }

  if (tag) {
    conditions.push(`subject_tags ? $${paramIdx}`);
    params.push(tag.toLowerCase());
    paramIdx++;
  }

  if (search) {
    conditions.push(`(name ILIKE $${paramIdx} OR domain ILIKE $${paramIdx} OR authority_type ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT id, name, domain, source_tier, authority_type, exam_context, region,
           subject_tags, is_official, priority, active, metadata, created_at, updated_at
    FROM official_sources
    ${whereClause}
    ORDER BY source_tier ASC, priority DESC, name ASC
  `;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Get single official source by ID.
 */
export async function getSourceById(id) {
  if (!id) return null;
  const { rows } = await query(`SELECT * FROM official_sources WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Match a source directly by domain or URL.
 */
export async function findSourceByUrl(rawUrl) {
  if (!rawUrl) return null;
  let hostname = rawUrl;
  try {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      hostname = new URL(rawUrl).hostname;
    }
  } catch (e) {
    // use raw string
  }
  hostname = hostname.replace(/^www\./i, '').toLowerCase();

  // 1. Direct domain match
  const { rows } = await query(
    `SELECT * FROM official_sources WHERE active = TRUE AND (domain = $1 OR domain ILIKE $2 OR metadata->'alias_domains' ? $1) LIMIT 1`,
    [hostname, `%${hostname}%`]
  );
  if (rows.length > 0) return rows[0];

  // 2. Subdomain check (e.g. psc.ap.gov.in matching ap.gov.in)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const parentDomain = parts.slice(-2).join('.');
    const parentCheck = await query(
      `SELECT * FROM official_sources WHERE active = TRUE AND domain = $1 LIMIT 1`,
      [parentDomain]
    );
    if (parentCheck.rows.length > 0) return parentCheck.rows[0];
  }

  return null;
}

/**
 * Register or update an official source.
 */
export async function registerSource(sourceData) {
  const {
    name,
    domain,
    source_tier = 1,
    authority_type = 'PRIMARY_OFFICIAL',
    exam_context = 'both',
    region = null,
    subject_tags = [],
    is_official = true,
    priority = 100,
    metadata = {}
  } = sourceData;

  const sql = `
    INSERT INTO official_sources (
      name, domain, source_tier, authority_type, exam_context, region,
      subject_tags, is_official, priority, active, metadata, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, TRUE, $10::jsonb, NOW())
    RETURNING *;
  `;

  const { rows } = await query(sql, [
    name,
    domain.toLowerCase().trim(),
    Number(source_tier),
    authority_type,
    exam_context,
    region,
    JSON.stringify(subject_tags),
    Boolean(is_official),
    Number(priority),
    JSON.stringify(metadata)
  ]);

  return rows[0];
}

export const resolveOfficialSource = findSourceByUrl;
export const getAllOfficialSources = getOfficialSources;
