/**
 * backend/services/evidence/evidenceFreshnessPolicy.js
 *
 * Deterministic Evidence Freshness Policy Engine (Phase 2B).
 * 
 * Rules:
 * 1. Do NOT ask an LLM whether evidence is stale. Use deterministic temporal policies.
 * 2. Classifications:
 *    - MONTHLY: CPI, WPI, monthly unemployment (fresh for 35 days from reference month)
 *    - QUARTERLY: GDP, GVA, quarterly fiscal data (fresh for 100 days from quarter end)
 *    - ANNUAL: Union Budget, Economic Survey, AP Budget, AP Socio-Economic Survey (fresh for ~370 days)
 *    - EVENT_BASED: RBI Repo Rate, SC Judgments, Govt Notifications, Scheme Rules (valid until superseded)
 *    - STATIC: Constitutional Articles, geography static concepts, history (never expires)
 */

export const FRESHNESS_CLASSES = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUAL: 'annual',
  EVENT_BASED: 'event_based',
  STATIC: 'static'
};

/**
 * Determine the default freshness class for a given evidence type and claim key.
 */
export function inferFreshnessClass(evidenceType = '', canonicalKey = '', title = '') {
  const normType = String(evidenceType || '').toLowerCase();
  const text = `${normType} ${canonicalKey} ${title}`.toLowerCase();

  if (text.includes('cpi') || text.includes('inflation') || text.includes('wpi') || text.includes('monthly_iip') || normType === 'statistic') {
    return FRESHNESS_CLASSES.MONTHLY;
  }
  if (text.includes('gdp') || text.includes('gva') || text.includes('quarterly')) {
    return FRESHNESS_CLASSES.QUARTERLY;
  }
  if (text.includes('budget') || text.includes('economic_survey') || text.includes('annual') || text.includes('socio_economic_survey') || text.includes('isfr') || normType === 'budget_datum') {
    return FRESHNESS_CLASSES.ANNUAL;
  }
  if (text.includes('constitution') || text.includes('article') || text.includes('fundamental_rights') || text.includes('historical_event') || normType === 'constitutional_article') {
    return FRESHNESS_CLASSES.STATIC;
  }
  if (text.includes('repo_rate') || text.includes('judgment') || text.includes('guidelines') || text.includes('notification') || text.includes('act_') || normType === 'policy') {
    return FRESHNESS_CLASSES.EVENT_BASED;
  }

  return FRESHNESS_CLASSES.ANNUAL;
}

/**
 * Determines whether an evidence item qualifies as the confirmed latest official government release
 * for the current calendar/fiscal date.
 * 
 * @param {Object} evidenceItem 
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ officialLatestConfirmed: boolean, refreshRequired: boolean, reason: string }}
 */
export function checkOfficialLatestReleaseExpectation(evidenceItem, referenceDate = new Date()) {
  if (!evidenceItem) {
    return { officialLatestConfirmed: false, refreshRequired: true, reason: 'No evidence item' };
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const currentYear = now.getFullYear(); // e.g. 2026
  const currentMonth = now.getMonth() + 1; // 1-12, e.g. 10 for Oct

  const key = String(evidenceItem.canonical_claim_key || evidenceItem.title || '').toLowerCase();
  const period = String(evidenceItem.data_period || '').toLowerCase();
  const freshnessClass = evidenceItem.freshness_class || inferFreshnessClass(
    evidenceItem.evidence_type,
    evidenceItem.canonical_claim_key,
    evidenceItem.title
  );

  // 1. Monthly Statistical Indicators (e.g. CPI, WPI)
  if (freshnessClass === FRESHNESS_CLASSES.MONTHLY || key.includes('cpi') || key.includes('inflation')) {
    // For October 2026, the expected latest release is August 2026 (released mid-Sep) or September 2026 (released mid-Oct).
    // An item from 2024 or early 2025 cannot be the confirmed latest official release.
    const pubDate = evidenceItem.source_document_date || evidenceItem.publication_date 
      ? new Date(evidenceItem.source_document_date || evidenceItem.publication_date) 
      : null;

    if (!pubDate) {
      return {
        officialLatestConfirmed: false,
        refreshRequired: true,
        reason: 'Monthly statistic missing document publication date.'
      };
    }

    const daysSince = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));
    if (daysSince > 45) {
      return {
        officialLatestConfirmed: false,
        refreshRequired: true,
        reason: `Monthly official release from ${pubDate.toISOString().split('T')[0]} is ${daysSince} days old (> 45 days). A newer official release exists in the government catalogue.`
      };
    }

    return {
      officialLatestConfirmed: true,
      refreshRequired: false,
      reason: `Current active monthly official release within ${daysSince}-day window.`
    };
  }

  // 2. Annual Reports and State/Union Budgets
  if (freshnessClass === FRESHNESS_CLASSES.ANNUAL || key.includes('budget') || key.includes('economic_survey')) {
    // For Oct 2026, the active fiscal year is FY 2026-27 (or 2026-2027).
    // An item for FY 2024-25 or FY 2025-26 is a past fiscal year.
    const expectedFyYear = currentMonth >= 4 ? currentYear : currentYear - 1; // 2026
    const nextFyYearShort = String(expectedFyYear + 1).slice(-2); // "27"
    const expectedFyString = `20${String(expectedFyYear).slice(-2)}-${nextFyYearShort}`; // "2026-27"

    if (period.includes('2024-25') || period.includes('2024-2025') || period.includes('2025-26') || period.includes('2025-2026')) {
      // If the current date is in 2026-27 fiscal cycle, older fiscal years are historical
      if (currentYear >= 2026 && currentMonth >= 4 && !period.includes('2026-27') && !period.includes('2026-2027')) {
        return {
          officialLatestConfirmed: false,
          refreshRequired: true,
          reason: `Annual budget for ${evidenceItem.data_period || 'past FY'} is historical. FY ${expectedFyYear}-${nextFyYearShort} official release is current.`
        };
      }
    }

    const pubDate = evidenceItem.source_document_date || evidenceItem.publication_date 
      ? new Date(evidenceItem.source_document_date || evidenceItem.publication_date) 
      : null;

    if (pubDate) {
      const daysSince = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));
      if (daysSince > 380) {
        return {
          officialLatestConfirmed: false,
          refreshRequired: true,
          reason: `Annual report released ${daysSince} days ago (> 380 days). New fiscal cycle release required.`
        };
      }
    }

    return {
      officialLatestConfirmed: true,
      refreshRequired: false,
      reason: 'Current active annual official release.'
    };
  }

  // 3. Static & Event-Based (Constitutional, Policy Guidelines until superseded)
  if (freshnessClass === FRESHNESS_CLASSES.STATIC || freshnessClass === FRESHNESS_CLASSES.EVENT_BASED) {
    const isSuperseded = Boolean(evidenceItem.superseded_by_evidence_id);
    return {
      officialLatestConfirmed: !isSuperseded,
      refreshRequired: isSuperseded,
      reason: isSuperseded ? 'Superseded by formal amendment/newer release.' : 'Current established statutory/policy position.'
    };
  }

  return {
    officialLatestConfirmed: true,
    refreshRequired: false,
    reason: 'Standard cadence verification.'
  };
}

/**
 * Evaluates the freshness of an evidence item against the current system timestamp.
 * 
 * @param {Object} evidenceItem - Stored or candidate evidence record
 * @param {Date} [referenceDate=new Date()] - Date to evaluate against
 * @returns {Object} Freshness evaluation details
 */
export function evaluateEvidenceFreshness(evidenceItem, referenceDate = new Date()) {
  if (!evidenceItem) {
    return {
      isFresh: false,
      isStale: true,
      freshnessStatus: 'stale',
      freshnessClass: FRESHNESS_CLASSES.ANNUAL,
      officialLatestConfirmed: false,
      refreshRequired: true,
      reason: 'No evidence item provided',
      nextCheckAt: null
    };
  }

  const freshnessClass = evidenceItem.freshness_class || inferFreshnessClass(
    evidenceItem.evidence_type, 
    evidenceItem.canonical_claim_key, 
    evidenceItem.title
  );

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const expectation = checkOfficialLatestReleaseExpectation(evidenceItem, now);

  const pubDate = evidenceItem.source_document_date || evidenceItem.publication_date 
    ? new Date(evidenceItem.source_document_date || evidenceItem.publication_date)
    : (evidenceItem.verified_at ? new Date(evidenceItem.verified_at) : null);

  // If explicit expires_at exists in DB, check it first
  if (evidenceItem.expires_at) {
    const expiry = new Date(evidenceItem.expires_at);
    const isFresh = expiry > now && expectation.officialLatestConfirmed;
    return {
      isFresh,
      isStale: !isFresh,
      freshnessStatus: isFresh ? 'fresh' : 'stale',
      freshnessClass,
      officialLatestConfirmed: expectation.officialLatestConfirmed && isFresh,
      refreshRequired: !isFresh || expectation.refreshRequired,
      expiresAt: expiry.toISOString(),
      nextCheckAt: expiry.toISOString(),
      reason: isFresh 
        ? `Within valid official release window until ${expiry.toISOString().split('T')[0]}`
        : (expectation.reason || `Expired on ${expiry.toISOString().split('T')[0]}. Refresh required from official source.`),
      refresh_warning: isFresh ? null : (expectation.reason || `Expired on ${expiry.toISOString().split('T')[0]}. Refresh required from official source.`)
    };
  }

  // Policy-based deterministic evaluation
  switch (freshnessClass) {
    case FRESHNESS_CLASSES.STATIC:
      return {
        isFresh: true,
        isStale: false,
        freshnessStatus: 'static',
        freshnessClass,
        officialLatestConfirmed: true,
        refreshRequired: false,
        reason: 'Static canonical knowledge (Constitutional / Established Concept); no expiration.',
        refresh_warning: null,
        nextCheckAt: null
      };

    case FRESHNESS_CLASSES.MONTHLY: {
      if (!pubDate) {
        return { 
          isFresh: false, 
          isStale: true, 
          freshnessStatus: 'stale',
          freshnessClass, 
          officialLatestConfirmed: false,
          refreshRequired: true,
          reason: 'Monthly statistic missing publication date.', 
          refresh_warning: 'Monthly statistic missing publication date.' 
        };
      }
      const daysSince = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));
      const isFresh = daysSince <= 45 && expectation.officialLatestConfirmed;
      const nextCheck = new Date(pubDate);
      nextCheck.setDate(nextCheck.getDate() + 45);
      const reason = isFresh
        ? `Monthly indicator released ${daysSince} days ago (fresh within 45-day window).`
        : expectation.reason || `Monthly indicator released ${daysSince} days ago (>45 days). Next official monthly release due.`;
      return {
        isFresh,
        isStale: !isFresh,
        freshnessStatus: isFresh ? 'fresh' : 'stale',
        freshnessClass,
        officialLatestConfirmed: expectation.officialLatestConfirmed && isFresh,
        refreshRequired: !isFresh || expectation.refreshRequired,
        daysSinceRelease: daysSince,
        nextCheckAt: nextCheck.toISOString(),
        reason,
        refresh_warning: isFresh ? null : reason
      };
    }

    case FRESHNESS_CLASSES.QUARTERLY: {
      if (!pubDate) {
        return { 
          isFresh: false, 
          isStale: true, 
          freshnessStatus: 'stale',
          freshnessClass, 
          officialLatestConfirmed: false,
          refreshRequired: true,
          reason: 'Quarterly indicator missing publication date.', 
          refresh_warning: 'Quarterly indicator missing publication date.' 
        };
      }
      const daysSince = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));
      const isFresh = daysSince <= 105 && expectation.officialLatestConfirmed;
      const nextCheck = new Date(pubDate);
      nextCheck.setDate(nextCheck.getDate() + 105);
      const reason = isFresh
        ? `Quarterly indicator released ${daysSince} days ago (fresh within 105-day window).`
        : expectation.reason || `Quarterly indicator released ${daysSince} days ago (>105 days). Next quarterly estimate due.`;
      return {
        isFresh,
        isStale: !isFresh,
        freshnessStatus: isFresh ? 'fresh' : 'stale',
        freshnessClass,
        officialLatestConfirmed: expectation.officialLatestConfirmed && isFresh,
        refreshRequired: !isFresh || expectation.refreshRequired,
        daysSinceRelease: daysSince,
        nextCheckAt: nextCheck.toISOString(),
        reason,
        refresh_warning: isFresh ? null : reason
      };
    }

    case FRESHNESS_CLASSES.ANNUAL: {
      if (!pubDate) {
        return { 
          isFresh: false, 
          isStale: true, 
          freshnessStatus: 'stale',
          freshnessClass, 
          officialLatestConfirmed: false,
          refreshRequired: true,
          reason: 'Annual report/budget missing publication date.', 
          refresh_warning: 'Annual report/budget missing publication date.' 
        };
      }
      const daysSince = Math.floor((now - pubDate) / (1000 * 60 * 60 * 24));
      const isFresh = daysSince <= 380 && expectation.officialLatestConfirmed;
      const nextCheck = new Date(pubDate);
      nextCheck.setDate(nextCheck.getDate() + 380);
      const reason = isFresh
        ? `Annual publication released ${daysSince} days ago (valid for current cycle).`
        : expectation.reason || `Annual publication released ${daysSince} days ago (>380 days). Subsequent fiscal year budget/survey due.`;
      return {
        isFresh,
        isStale: !isFresh,
        freshnessStatus: isFresh ? 'fresh' : 'stale',
        freshnessClass,
        officialLatestConfirmed: expectation.officialLatestConfirmed && isFresh,
        refreshRequired: !isFresh || expectation.refreshRequired,
        daysSinceRelease: daysSince,
        nextCheckAt: nextCheck.toISOString(),
        reason,
        refresh_warning: isFresh ? null : reason
      };
    }

    case FRESHNESS_CLASSES.EVENT_BASED: {
      const isSuperseded = Boolean(evidenceItem.superseded_by_evidence_id);
      const isFresh = !isSuperseded && expectation.officialLatestConfirmed;
      const reason = isSuperseded
        ? `Superseded by newer official release (${evidenceItem.superseded_by_evidence_id}).`
        : 'Active statutory / policy position. Valid until formally amended or superseded.';
      return {
        isFresh,
        isStale: !isFresh,
        freshnessStatus: isFresh ? 'fresh' : 'stale',
        freshnessClass,
        officialLatestConfirmed: !isSuperseded && expectation.officialLatestConfirmed,
        refreshRequired: !isFresh,
        reason,
        refresh_warning: isFresh ? null : reason,
        nextCheckAt: null
      };
    }

    default:
      return {
        isFresh: expectation.officialLatestConfirmed,
        isStale: !expectation.officialLatestConfirmed,
        freshnessStatus: expectation.officialLatestConfirmed ? 'fresh' : 'stale',
        freshnessClass: FRESHNESS_CLASSES.ANNUAL,
        officialLatestConfirmed: expectation.officialLatestConfirmed,
        refreshRequired: !expectation.officialLatestConfirmed,
        reason: expectation.reason || 'Default policy applied.',
        refresh_warning: expectation.officialLatestConfirmed ? null : expectation.reason,
        nextCheckAt: null
      };
  }
}
