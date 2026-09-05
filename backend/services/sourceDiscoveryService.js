import { getKnowledgeItem, searchKnowledgeItems } from './mainsKnowledgeService.js';
import { resolveProxyUrl } from './safeSourceFetcher.js';


let __mockDiscoverCandidates = null;

export function setMockDiscoverCandidates(mockFn) {
  __mockDiscoverCandidates = mockFn;
}

// Abstracted discovery provider that returns candidate sources.
// In V1.6A, we use local mock fixtures for safety and predictability.
async function discoverCandidatesMock(query, knowledgeSubtype) {
  if (__mockDiscoverCandidates) {
    return __mockDiscoverCandidates(query, knowledgeSubtype);
  }
  return [];
}

export async function discoverCandidatesLive(query) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.MENTOR_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`;
  const payload = {
    model: "gemini-2.5-flash",
    input: query,
    tools: [ { type: "google_search" } ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.statusText}`);
  }

  const data = await res.json();
  let webChunks = [];

  if (data.steps) {
    for (const step of data.steps) {
      if (step.type === "model_output" && step.content) {
        for (const content of step.content) {
          if (content.annotations) {
            for (const ann of content.annotations) {
              if (ann.type === "url_citation") {
                webChunks.push(ann);
              }
            }
          }
        }
      }
    }
  }

  return webChunks.map(c => ({
    title: c.title,
    url: c.url
  }));
}


export const classifySourceAuthority = (c, subtype) => {
  const domain = (c.domain || "").toLowerCase();
  const publisher = (c.publisher || "").toLowerCase();

  // Check specific primary issuers
  if (subtype === 'STATISTIC') {
    if (domain.includes('rbi.org.in')) return 'PRIMARY_OFFICIAL';
    if (domain.includes('mospi.gov.in') || domain.includes('mospi.nic.in')) return 'PRIMARY_OFFICIAL';
  }
  if (subtype === 'JUDGMENT') {
    if (domain.includes('sci.gov.in') || domain.includes('main.sci.gov.in')) return 'PRIMARY_OFFICIAL';
  }
  if (subtype === 'SCHEME') {
    // Must be an actual scheme portal or issuing ministry, proxy by gov.in
    if (domain.endsWith('.gov.in') || domain.endsWith('.nic.in')) {
      // If it's a known secondary like PIB, it's not primary for a scheme
      if (domain.includes('pib.gov.in')) return 'AUTHORITATIVE_SECONDARY';
      // Check if publisher/domain looks like a scheme or ministry
      return 'PRIMARY_OFFICIAL';
    }
  }
  if (subtype === 'REPORT') {
    if (domain.includes('cag.gov.in')) return 'PRIMARY_OFFICIAL';
    if (domain.includes('niti.gov.in')) return 'PRIMARY_OFFICIAL';
    if (domain.includes('fincomindia.nic.in')) return 'PRIMARY_OFFICIAL';
    if (domain.includes('mospi.gov.in')) return 'PRIMARY_OFFICIAL';
  }

  // Explicit override for mock testing if needed
  if (c.authority_level === 'PRIMARY_OFFICIAL' || c.authority_level === 'PRIMARY') {
    return 'PRIMARY_OFFICIAL';
  }

  // Default fallbacks based on domain type
  if (domain.endsWith('.gov.in') || domain.endsWith('.nic.in')) {
    return 'AUTHORITATIVE_SECONDARY';
  }
  
  return 'SECONDARY';
};

/**
 * discoverSource
 * Orchestrates explicit source discovery for a given evidence item.
 */
export async function discoverSource(knowledgeId, userId) {
  const item = await getKnowledgeItem(knowledgeId);
  if (!item) {
    throw new Error(`Knowledge item not found: ${knowledgeId}`);
  }

  if (item.knowledge_type !== 'EVIDENCE') {
    throw new Error('Source discovery is only supported for EVIDENCE items.');
  }

  const searchTerms = [item.title];
  if (item.source_title) searchTerms.push(item.source_title);
  if (item.source_reference) searchTerms.push(item.source_reference);

  const query = searchTerms.join(' ').trim();
  const isLiveEnabled = process.env.GEMINI_LIVE_SOURCE_DISCOVERY_ENABLED === 'true';

  let candidates = [];
  let metaProvider = "mock";
  let search_query_count = 1;

  if (isLiveEnabled) {
    // 1. RAG Immediate Reuse Check
    const existing = await searchKnowledgeItems({
      knowledge_type: 'EVIDENCE',
      syllabus_node_id: item.syllabus_node_id,
      verification_status: 'VERIFIED',
      is_active: true
    });
    
    // Filter to items that are actually active auto-official or human-approved
    const trustedExisting = existing.filter(e => e.lifecycle_status === 'ACTIVE' && (e.verification_status === 'VERIFIED' || e.verification_status === 'HUMAN_APPROVED'));

    if (trustedExisting.length > 0) {
      // Immediate RAG Reuse
      return {
        evidence_item_id: item.id,
        query,
        candidates: [{
          title: trustedExisting[0].title,
          url: trustedExisting[0].structured_content?.source_verification?.verified_source_url || '',
          domain: '',
          publisher: '',
          evidence_type: trustedExisting[0].knowledge_subtype,
          authority_level: 'PRIMARY_OFFICIAL',
          relevance_score: 1.0,
          is_rag_reuse: true,
          rag_reused_id: trustedExisting[0].id
        }],
        discovery_meta: {
          provider: "rag_reuse",
          searched_at: new Date().toISOString(),
          search_query_count: 0
        }
      };
    }

    metaProvider = "gemini_google_search";
    const rawCandidates = await discoverCandidatesLive(query);
    search_query_count = 1; // HARD MAX 1
    
    // Process up to 5 citations and resolve proxies safely
    const seenUrls = new Set();
    for (const c of rawCandidates) {
      if (seenUrls.has(c.url)) continue;
      seenUrls.add(c.url);
      
      const proxyRes = await resolveProxyUrl(c.url);
      
      let finalHostname = "UNKNOWN";
      if (proxyRes.status !== "UNSAFE" && proxyRes.finalUrl) {
        try { finalHostname = new URL(proxyRes.finalUrl).hostname; } catch(e){}
      }

      candidates.push({
        title: c.title,
        url: c.url, // Original proxy as discovery_url
        final_url: proxyRes.finalUrl,
        final_hostname: finalHostname,
        proxy_resolution: {
          provider: "google_grounding",
          redirect_count: proxyRes.redirectCount,
          resolved: proxyRes.status === "DIRECT_PUBLISHER" || proxyRes.status === "FAILED"
        },
        domain: finalHostname, // Used for legacy scoring
        publisher: finalHostname
      });

      if (candidates.length >= 5) break;
    }
  } else {
    candidates = await discoverCandidatesMock(query, item.knowledge_subtype);
  }

  const scoreSourceRelevance = (c, subtype, query) => {
    let score = c.relevance_score || 0.5; // Base score
    const domain = (c.domain || "").toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Slight boost for .gov.in
    if (domain.endsWith('.gov.in') || domain.endsWith('.nic.in')) score += 0.2;
    if (domain.includes('pib.gov.in')) score += 0.15;
    
    // Query overlap heuristic (for ranking ONLY)
    if (subtype === 'STATISTIC') {
      if ((queryLower.includes('rbi') || queryLower.includes('reserve bank')) && domain.includes('rbi.org.in')) score += 0.5;
      if ((queryLower.includes('mospi') || queryLower.includes('labour')) && domain.includes('mospi')) score += 0.5;
    }
    if (subtype === 'JUDGMENT' && (domain.includes('sci.gov.in') || domain.includes('main.sci.gov.in'))) score += 0.5;
    if (subtype === 'SCHEME' && (domain.endsWith('.gov.in') || domain.endsWith('.nic.in'))) score += 0.4;
    
    if (subtype === 'REPORT') {
      const parts = domain.split('.')[0].split('-');
      for (const p of parts) {
        if (p.length > 3 && queryLower.includes(p)) score += 0.3;
      }
    }
    return score;
  };

  candidates.sort((a, b) => scoreSourceRelevance(b, item.knowledge_subtype, query) - scoreSourceRelevance(a, item.knowledge_subtype, query));

  // Normalize returned format up to 5 candidates
  const normalizedCandidates = candidates.slice(0, 5).map(c => {
    // If we resolved a proxy, use it, else fallback to mock
    const authLevel = c.final_hostname ? classifySourceAuthority({ domain: c.final_hostname, publisher: c.final_hostname }, item.knowledge_subtype) : classifySourceAuthority(c, item.knowledge_subtype);
    
    return {
      title: c.title,
      discovery_url: c.url,
      final_url: c.final_url || c.url,
      final_hostname: c.final_hostname || c.domain,
      evidence_type: c.source_type || item.knowledge_subtype,
      authority_level: authLevel,
      proxy_resolution: c.proxy_resolution || null,
      relevance_score: c.relevance_score
    };
  });
  
  // Enforce Candidate Priority Order: PRIMARY_OFFICIAL -> AUTHORITATIVE_SECONDARY -> SECONDARY
  normalizedCandidates.sort((a, b) => {
    const val = { 'PRIMARY_OFFICIAL': 3, 'AUTHORITATIVE_SECONDARY': 2, 'SECONDARY': 1 };
    const aVal = val[a.authority_level] || 0;
    const bVal = val[b.authority_level] || 0;
    return bVal - aVal;
  });

  return {
    evidence_item_id: item.id,
    query,
    candidates: normalizedCandidates,
    discovery_meta: {
      provider: metaProvider,
      model: isLiveEnabled ? "gemini-2.5-flash" : undefined,
      searched_at: new Date().toISOString(),
      search_query_count
    }
  };
}
