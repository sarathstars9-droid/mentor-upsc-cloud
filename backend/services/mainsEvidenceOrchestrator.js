import { getMainsRagContext } from './mainsRagContextService.js';
import { discoverCandidatesLive, classifySourceAuthority } from './sourceDiscoveryService.js';
import { resolveProxyUrl } from './safeSourceFetcher.js';
import { verifyClaim } from './sourceVerificationService.js';
import { createKnowledgeItem } from './mainsKnowledgeService.js';
import { query } from '../db/index.js';

export function deriveEvidenceGap(evaluationJson) {
  const analysis = evaluationJson?.evidence_analysis || {};
  const missingArr = Array.isArray(analysis.missing) ? analysis.missing : [];
  const missingTypes = missingArr.map(m => m.type || m).filter(Boolean);
  const bestValueAddition = evaluationJson?.best_value_addition;

  let hasGap = missingTypes.length > 0;
  if (!hasGap && bestValueAddition?.needed && bestValueAddition?.mode === 'NON_VISUAL') {
    hasGap = true;
    if (bestValueAddition.subtype) {
      missingTypes.push(bestValueAddition.subtype);
    }
  }

  return {
    has_gap: hasGap,
    missing_types: Array.from(new Set(missingTypes)),
    rationale: missingArr.length > 0 ? (missingArr[0].reason || '') : (bestValueAddition?.reason || 'No specific rationale')
  };
}

export async function findVerifiedEvidenceForContext({
  userId,
  attemptId,
  knowledgeItemId, // for Reviewer Flow
  evaluationContext,
  evidenceType
}) {
  let paper, subject, topic, syllabus_node_id, micro_topic, question, typeToUse;

  if (knowledgeItemId) {
    // Reviewer flow: build context from existing item
    const sql = `SELECT * FROM mains_knowledge_items WHERE id = $1`;
    const result = await query(sql, [knowledgeItemId]);
    if (result.rows.length === 0) throw new Error("Knowledge item not found");
    const item = result.rows[0];
    
    paper = item.paper || "General Studies";
    subject = item.subject || "";
    topic = item.topic || "";
    syllabus_node_id = item.syllabus_node_id || "";
    micro_topic = item.micro_topic || "";
    question = item.title || ""; // In knowledge item, title holds the query anchor
    typeToUse = item.knowledge_subtype || 'GENERAL';
  } else {
    // Moulika Flow: build from evaluation
    paper = evaluationContext.question_intelligence?.paper || "General Studies";
    subject = evaluationContext.question_intelligence?.subject || "";
    topic = evaluationContext.question_intelligence?.topic || "";
    syllabus_node_id = evaluationContext.question_intelligence?.syllabus_node_id || "";
    micro_topic = evaluationContext.question_intelligence?.micro_topic || "";
    question = evaluationContext.question_text || "";
    typeToUse = evidenceType || deriveEvidenceGap(evaluationContext).missing_types[0] || 'GENERAL';
  }

  const queryText = `${question} ${typeToUse}`;

  // 1. RAG FIRST
  const ragContext = await getMainsRagContext({
    userId,
    questionIntelligence: { syllabus_node_id, paper, subject, topic, micro_topic },
    queryText
  });

  if (ragContext?.retrieval_meta?.knowledge_item_ids?.length > 0) {
    const reusedId = ragContext.retrieval_meta.knowledge_item_ids[0];
    
    // Fetch the actual item from DB to populate the response
    const sql = `SELECT * FROM mains_knowledge_items WHERE id = $1`;
    const result = await query(sql, [reusedId]);
    
    if (result.rows.length > 0) {
      const item = result.rows[0];
      return {
        status: "REUSED_TRUSTED",
        evidence: {
          type: item.knowledge_subtype || typeToUse,
          title: item.title,
          exam_use: item.content,
          source_name: item.source_title,
          source_url: item.source_reference,
          authority_level: item.source_type
        },
        saved_to_bank: false,
        meta: { search_used: false, fetched: false, verified: false }
      };
    }
  }

  // Check Feature Flag
  if (process.env.GEMINI_LIVE_SOURCE_DISCOVERY_ENABLED !== 'true') {
    return {
      status: "FEATURE_DISABLED",
      evidence: null,
      saved_to_bank: false,
      meta: { search_used: false }
    };
  }

  // 2. LIVE SEARCH
  const rawCandidates = await discoverCandidatesLive(queryText);
  const candidates = rawCandidates || [];
  let fetchedCount = 0;
  let verifiedCount = 0;

  for (const candidate of candidates) {
    if (fetchedCount >= 3) break;
    if (verifiedCount >= 2) break;

    // 3. PROXY RESOLUTION
    let finalUrl = candidate.url;
    let finalHost = candidate.domain;
    if (finalUrl.includes('vertexaisearch.cloud.google.com')) {
      const resolved = await resolveProxyUrl(finalUrl);
      if (resolved.ok) {
        finalUrl = resolved.finalUrl;
        finalHost = new URL(finalUrl).hostname;
      } else {
        continue; // Fallback on TLS/403/SSRF
      }
    }

    const authority = classifySourceAuthority(finalHost);
    fetchedCount++;
    
    // 4. VERIFY (includes safe fetch and deterministic checks)
    const verification = await verifyClaim(queryText, finalUrl, typeToUse, authority);
    verifiedCount++;

    if (verification.status === 'VERIFIED') {
      const isOfficial = authority === 'PRIMARY_OFFICIAL';
      
      const knowledgePayload = {
        paper, subject, topic, micro_topic, syllabus_node_id,
        knowledge_type: 'EVIDENCE',
        knowledge_subtype: typeToUse,
        title: verification.claim_verified,
        content: verification.extracted_quote,
        structured_content: {},
        tags: [authority],
        source_type: authority,
        source_reference: finalUrl,
        source_title: finalHost,
        source_year: new Date().getFullYear(),
        verification_status: isOfficial ? 'AUTO_OFFICIAL_VERIFIED' : 'PENDING_REVIEW',
        lifecycle_status: 'ACTIVE',
        is_active: isOfficial
      };

      const newItem = await createKnowledgeItem(knowledgePayload);

      return {
        status: isOfficial ? "VERIFIED_OFFICIAL" : "SUPPORTING_SECONDARY",
        evidence: {
          type: typeToUse,
          title: verification.claim_verified,
          exam_use: verification.extracted_quote,
          source_name: finalHost,
          source_url: finalUrl,
          authority_level: authority
        },
        saved_to_bank: true,
        meta: { search_used: true }
      };
    }
  }

  return {
    status: "NO_VERIFIED_EVIDENCE",
    evidence: null,
    saved_to_bank: false,
    meta: { search_used: true }
  };
}
