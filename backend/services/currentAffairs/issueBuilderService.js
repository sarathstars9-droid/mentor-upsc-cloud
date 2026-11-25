/**
 * backend/services/currentAffairs/issueBuilderService.js
 *
 * Current Affairs Issue Builder & Canonical Topic Resolver (Phase 3A).
 * Aggregates multiple official updates into ONE canonical issue dossier.
 * Enforces strict topic resolution: exact -> alias -> syllabus -> issue similarity -> safe unresolved candidate.
 */

import { query } from '../../db/index.js';
import { mapIssueToSyllabusNodes } from './syllabusMappingService.js';
import { getRelevantPyqsForIssue } from './issuePyqService.js';

/**
 * Resolve topic identifier strictly according to MentorOS resolution hierarchy.
 */
export async function resolveCanonicalTopic(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;

  const raw = identifier.trim().toLowerCase();
  const slug = raw.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');

  // 1. Exact Match on slug or title
  const { rows: exactMatches } = await query(`
    SELECT * FROM knowledge_topics 
    WHERE slug = $1 OR LOWER(title) = $2
    LIMIT 1
  `, [slug, raw]);

  if (exactMatches.length > 0) {
    return { topic: exactMatches[0], resolutionType: 'EXACT_MATCH' };
  }

  // 2. Alias Match in aliases JSONB array
  const { rows: aliasMatches } = await query(`
    SELECT * FROM knowledge_topics 
    WHERE aliases ? $1 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(aliases, '[]'::jsonb)) a 
      WHERE a ILIKE $2 OR $2 ILIKE '%' || a || '%'
    )
    LIMIT 1
  `, [slug, `%${raw}%`]);

  if (aliasMatches.length > 0) {
    return { topic: aliasMatches[0], resolutionType: 'ALIAS_MATCH' };
  }

  // 3. Syllabus Node Similarity / Partial Topic Title Match
  const { rows: partialMatches } = await query(`
    SELECT * FROM knowledge_topics 
    WHERE title ILIKE $1 OR summary ILIKE $1
    ORDER BY created_at ASC
    LIMIT 1
  `, [`%${raw}%`]);

  if (partialMatches.length > 0) {
    return { topic: partialMatches[0], resolutionType: 'SEMANTIC_SIMILARITY' };
  }

  // 4. Return unresolved without creating global knowledge noise
  return { topic: null, resolutionType: 'UNRESOLVED_CANDIDATE', candidateSlug: slug };
}

/**
 * Create or enrich a canonical Current Affairs issue with new verified official evidence.
 */
export async function enrichIssueWithOfficialEvidence({
  topicIdentifier,
  documentTitle,
  referencePeriod,
  evidenceList = [],
  examContext = 'both',
  region = 'india',
  sourceDomain = ''
}) {
  const resolved = await resolveCanonicalTopic(topicIdentifier);
  const canonicalTopic = resolved?.topic;

  const issueSlug = canonicalTopic ? canonicalTopic.slug : (resolved?.candidateSlug || 'general_update');
  const issueTitle = canonicalTopic ? canonicalTopic.title : documentTitle;

  // 1. Check if canonical issue already exists
  const { rows: existingIssues } = await query(`
    SELECT * FROM current_affairs_issues 
    WHERE slug = $1 OR (canonical_topic_id IS NOT NULL AND canonical_topic_id = $2)
    LIMIT 1
  `, [issueSlug, canonicalTopic?.id || null]);

  let issueId;
  let isNewIssue = false;

  if (existingIssues.length > 0) {
    issueId = existingIssues[0].id;
    // Update existing issue's last_updated_at and why_in_news
    await query(`
      UPDATE current_affairs_issues 
      SET last_updated_at = NOW(),
          why_in_news = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [
      `Updated with latest official release: "${documentTitle}" (${referencePeriod || 'Latest'})`,
      issueId
    ]);
  } else {
    // Create new canonical issue
    const { rows: inserted } = await query(`
      INSERT INTO current_affairs_issues (
        canonical_topic_id, title, slug, status, exam_context, region,
        issue_type, first_seen_at, last_updated_at, importance,
        summary, static_context, why_in_news, dimensions, arguments,
        counterviews, challenges, way_forward, metadata
      )
      VALUES ($1, $2, $3, 'ACTIVE', $4, $5, 'POLICY_MACRO', NOW(), NOW(), 'HIGH', $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      canonicalTopic?.id || null,
      issueTitle,
      issueSlug,
      canonicalTopic?.exam_context || examContext,
      canonicalTopic?.region || region,
      canonicalTopic?.summary || `Comprehensive official dossier on ${issueTitle}.`,
      `Anchored in foundational syllabus and institutional frameworks for ${issueTitle}.`,
      `Recent official update: "${documentTitle}" (${referencePeriod || 'Latest'}).`,
      JSON.stringify(canonicalTopic?.dimensions || ['Institutional Architecture', 'Macro Policy', 'Structural Impact']),
      JSON.stringify(['Strengthens institutional governance and policy transparency']),
      JSON.stringify(['Implementation bottlenecks and fiscal outlays requiring monitoring']),
      JSON.stringify(['Inter-departmental coordination delays']),
      JSON.stringify(['Establish institutional monitoring and time-bound milestones']),
      JSON.stringify({ primarySourceDomain: sourceDomain })
    ]);
    issueId = inserted[0].id;
    isNewIssue = true;
  }

  // 2. Link newly verified evidence assets to issue
  for (const ev of evidenceList) {
    if (ev.evidenceAssetId) {
      await query(`
        INSERT INTO issue_evidence_links (issue_id, evidence_id, role)
        VALUES ($1, $2, 'primary_evidence')
        ON CONFLICT (issue_id, evidence_id) DO NOTHING
      `, [issueId, ev.evidenceAssetId]);
    }
  }

  // 3. Ensure Syllabus Mappings exist
  const syllabusNodes = mapIssueToSyllabusNodes(issueSlug, issueTitle, examContext, region);
  for (const map of syllabusNodes) {
    await query(`
      INSERT INTO issue_syllabus_mappings (issue_id, node_id, mapping_type, confidence, reason)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (issue_id, node_id) DO NOTHING
    `, [issueId, map.nodeId, map.mappingType, map.confidence, map.reason]);
  }

  // 4. Ensure PYQ Links exist
  const pyqs = await getRelevantPyqsForIssue({
    syllabusNodes,
    topicSlug: issueSlug,
    keywords: [issueTitle]
  });

  for (const pyq of pyqs) {
    await query(`
      INSERT INTO issue_pyq_links (issue_id, pyq_id, relevance_score, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (issue_id, pyq_id) DO NOTHING
    `, [issueId, pyq.pyqId, pyq.relevanceScore, pyq.reason]);
  }

  return {
    issueId,
    slug: issueSlug,
    title: issueTitle,
    isNewIssue,
    topicResolved: Boolean(canonicalTopic),
    mappedSyllabusNodeCount: syllabusNodes.length,
    linkedPyqCount: pyqs.length
  };
}

/**
 * Get full canonical issue dossier by ID or slug with linked evidence, syllabus mappings, and PYQs.
 */
export async function getIssueBySlugOrId(slugOrId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  
  const { rows } = await query(`
    SELECT i.*, 
           t.title as topic_title, 
           t.dimensions as topic_dimensions, 
           t.aliases as topic_aliases
    FROM current_affairs_issues i
    LEFT JOIN knowledge_topics t ON i.canonical_topic_id = t.id
    WHERE ${isUuid ? 'i.id = $1' : 'i.slug = $1'}
    LIMIT 1
  `, [slugOrId]);

  if (rows.length === 0) return null;
  const issue = rows[0];

  // Fetch linked syllabus mappings
  const { rows: syllabusRows } = await query(`
    SELECT * FROM issue_syllabus_mappings WHERE issue_id = $1 ORDER BY mapping_type ASC
  `, [issue.id]);
  issue.syllabus_mappings = syllabusRows;

  // Fetch linked PYQs
  const { rows: pyqRows } = await query(`
    SELECT * FROM issue_pyq_links WHERE issue_id = $1 ORDER BY relevance_score DESC
  `, [issue.id]);
  issue.linked_pyqs = pyqRows;

  return issue;
}

export const getIssueBySlug = getIssueBySlugOrId;

/**
 * Seed canonical development Current Affairs issues for Inflation, AP Budget, Urban Flooding, and Green Hydrogen.
 */
export async function seedCanonicalIssuesDev() {
  console.log('🌱 Seeding Phase 3A canonical Current Affairs issues...');

  const issuesToSeed = [
    {
      topicSlug: 'inflation',
      title: 'Inflation Dynamics & Monetary Policy Transmission',
      examContext: 'upsc',
      region: 'india',
      importance: 'CRITICAL',
      summary: 'Headline Consumer Price Index (CPI), Core Inflation drivers, and RBI Monetary Policy Framework (4% +/- 2% target band).',
      whyInNews: 'MoSPI monthly CPI inflation release and RBI MPC repo rate decisions.'
    },
    {
      topicSlug: 'ap_budget',
      title: 'Andhra Pradesh State Budget & Macro-Fiscal Architecture',
      examContext: 'appsc',
      region: 'andhra_pradesh',
      importance: 'CRITICAL',
      summary: 'Comprehensive fiscal profile of Andhra Pradesh covering Revenue Outlays, Capital Expenditure, GSDP profile, and FRBM deficit trajectories.',
      whyInNews: 'Official AP Finance Department Annual Financial Statement and Budget presentation.'
    },
    {
      topicSlug: 'urban_flooding',
      title: 'Urban Flooding Management & Drainage Governance',
      examContext: 'both',
      region: 'india',
      importance: 'HIGH',
      summary: 'Multi-tiered urban disaster resilience addressing stormwater capacity, wetland conservation, and NDMA catchment drainage guidelines.',
      whyInNews: 'NDMA urban flooding guidelines and multi-city monsoon inundation management.'
    },
    {
      topicSlug: 'green_hydrogen',
      title: 'National Green Hydrogen Mission & Industrial Decarbonisation',
      examContext: 'upsc',
      region: 'india',
      importance: 'HIGH',
      summary: 'Decarbonisation architecture targeting 5 MMT green hydrogen production via renewable energy electrolysis for hard-to-abate industrial offtake.',
      whyInNews: 'Ministry of New & Renewable Energy (MNRE) strategic pilot incentives and electrolyser allocation rounds.'
    }
  ];

  const seeded = [];
  for (const spec of issuesToSeed) {
    const res = await enrichIssueWithOfficialEvidence({
      topicIdentifier: spec.topicSlug,
      documentTitle: spec.title,
      examContext: spec.examContext,
      region: spec.region
    });
    seeded.push(res);
  }

  console.log(`✅ Seeded ${seeded.length} canonical Current Affairs issues.`);
  return seeded;
}
