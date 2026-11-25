/**
 * backend/services/evidence/evidenceRankingService.js
 *
 * Ranking and ordering engine for official evidence assets.
 * 
 * Rules:
 * 1. Tier 1 Official sources first.
 * 2. Tier 2 International Institutional second.
 * 3. Tier 3 Explanatory third.
 * 4. For APPSC / Andhra Pradesh context: Boost Andhra official sources above national secondary sources.
 * 5. Verified > Stale > Unverified > Disputed.
 * 6. Higher confidence and fresh evidence ranked ahead.
 */

export function calculateEvidenceRankScore(evidenceItem, { targetExamContext = 'both', targetRegion = 'india' } = {}) {
  let score = 0;

  const tier = Number(evidenceItem.source_tier || evidenceItem.source?.source_tier || 1);
  const status = String(evidenceItem.verification_status || 'unverified').toLowerCase();
  const examContext = String(evidenceItem.exam_context || 'both').toLowerCase();
  const region = String(evidenceItem.region || '').toLowerCase();
  const confidence = Number(evidenceItem.confidence ?? 1.0);
  const sourcePriority = Number(evidenceItem.source_priority || evidenceItem.source?.priority || 100);
  const isOfficial = Boolean(evidenceItem.is_official ?? evidenceItem.source?.is_official ?? true);

  // 1. Tier Base Score (Tier 1 gets massive base)
  if (tier === 1) {
    score += 1000;
  } else if (tier === 2) {
    score += 500;
  } else {
    score += 200;
  }

  // 2. Official Badge Weight
  if (isOfficial) {
    score += 200;
  }

  // 3. APPSC + Andhra Pradesh Boost Rule
  const isAppscTarget = targetExamContext === 'appsc' || targetRegion === 'andhra_pradesh';
  const isApSource = region === 'andhra_pradesh' || examContext === 'appsc';

  if (isAppscTarget) {
    if (isApSource && tier === 1) {
      // Massive boost for AP official sources in APPSC / AP context
      score += 600;
    } else if (isApSource) {
      score += 250;
    } else if (tier === 1) {
      // National Tier 1 still strong
      score += 100;
    }
  } else {
    // UPSC context: National Tier 1 prioritized
    if (region === 'india' || !region) {
      score += 150;
    }
    if (examContext === 'upsc' || examContext === 'both') {
      score += 100;
    }
  }

  // 4. Verification Status Multipliers/Bonuses
  switch (status) {
    case 'verified_current':
      score += 400;
      break;
    case 'verified':
      score += 300;
      break;
    case 'verified_historical':
      score += 200;
      break;
    case 'stale':
      score += 50; // Still official data but flagged for refresh
      break;
    case 'unverified':
      score += 0;
      break;
    case 'disputed':
      score -= 200;
      break;
    default:
      break;
  }

  // 5. Freshness Check
  const now = new Date();
  if (evidenceItem.expires_at) {
    const expiry = new Date(evidenceItem.expires_at);
    if (expiry < now) {
      score -= 100; // Deduct for expired data
    } else {
      score += 50; // Reward active unexpired period
    }
  }

  // 6. Source Priority & Confidence additions
  score += sourcePriority * 0.5;
  score += confidence * 100;

  return score;
}

/**
 * Rank an array of evidence items based on exam context, region, and official tiers.
 */
export function rankEvidenceAssets(evidenceList, options = {}) {
  if (!Array.isArray(evidenceList)) return [];

  const scored = evidenceList.map(item => {
    const rankScore = calculateEvidenceRankScore(item, options);
    return {
      ...item,
      _rank_score: rankScore,
      is_fresh: !item.expires_at || new Date(item.expires_at) > new Date(),
      is_stale: Boolean(item.expires_at && new Date(item.expires_at) <= new Date())
    };
  });

  return scored.sort((a, b) => b._rank_score - a._rank_score);
}

export const rankEvidenceCandidates = (candidates, opts = {}) => 
  rankEvidenceAssets(candidates, { 
    targetExamContext: opts.examContext || opts.targetExamContext, 
    targetRegion: opts.region || opts.targetRegion 
  });
