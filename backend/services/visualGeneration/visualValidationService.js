/**
 * backend/services/visualGeneration/visualValidationService.js
 *
 * Strict JSON Schema Validator & Evidence Safety Gate for Visual Knowledge Assets (Phase 2D.1).
 * Guarantees renderable JSON contracts across all 14 visual grammars without HTML or unverified numeric statistics.
 */

import { validateAndSanitizeExamSketch } from './examSketchValidationService.js';

export const SUPPORTED_VISUAL_TYPES = [
  'exam_sketch',
  'hub_spoke',
  'mindmap',
  'flowchart',
  'cause_effect',
  'cycle',
  'timeline',
  'stakeholder_map',
  'institutional_web',
  'institutional_diagram',
  'decision_tree',
  'fishbone',
  'process_diagram',
  'geography_sketch',
  'map_sketch',
  'pyramid',
  'matrix',
  'comparison',
  'dimension_wheel',
  'chart'
];

export const CANONICAL_VERIFICATION_STATUSES = [
  'verified_current',
  'verified_historical',
  'stale',
  'unverified',
  'disputed'
];

export const CLAIM_TYPES = {
  STATIC_CONCEPT: 'STATIC_CONCEPT',
  QUANTITATIVE_CLAIM: 'QUANTITATIVE_CLAIM',
  CURRENT_FACTUAL_CLAIM: 'CURRENT_FACTUAL_CLAIM',
  HISTORICAL_FACTUAL_CLAIM: 'HISTORICAL_FACTUAL_CLAIM',
  LEGAL_CONSTITUTIONAL_REFERENCE: 'LEGAL_CONSTITUTIONAL_REFERENCE'
};

/**
 * Deterministic period normalization.
 * Handles fiscal years (FY 2025-26, 2025-26, FY2025-2026), monthly cycles (August 2026, Aug 2026, 2026-08), and calendar years.
 */
export function normalizeDataPeriod(period) {
  if (!period || typeof period !== 'string') return '';
  const cleaned = period.trim().toLowerCase();

  // Fiscal Year: FY 2025-26, FY2025-26, 2025-26, 2025-2026, FY 25-26
  const fyMatch = cleaned.match(/(?:fy\s*)?(\d{4})[-/](\d{2,4})/i) || cleaned.match(/fy\s*(\d{2})[-/](\d{2})/i);
  if (fyMatch) {
    let startYear = fyMatch[1];
    let endYear = fyMatch[2];
    if (startYear.length === 2) startYear = '20' + startYear;
    if (endYear.length === 4) endYear = endYear.slice(2);
    if (endYear.length === 2) {
      return `FY-${startYear}-${endYear}`;
    }
  }

  // Months: August 2026, Aug 2026, 2026-08, 08/2026, etc.
  const months = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };

  const monthWordMatch = cleaned.match(/([a-z]+)\s*(\d{4})/i);
  if (monthWordMatch && months[monthWordMatch[1]]) {
    return `${monthWordMatch[2]}-${months[monthWordMatch[1]]}`;
  }

  const isoMonthMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})$/);
  if (isoMonthMatch) {
    return `${isoMonthMatch[1]}-${isoMonthMatch[2].padStart(2, '0')}`;
  }

  const slashMonthMatch = cleaned.match(/^(\d{1,2})[-/](\d{4})$/);
  if (slashMonthMatch) {
    return `${slashMonthMatch[2]}-${slashMonthMatch[1].padStart(2, '0')}`;
  }

  // Calendar year
  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return cleaned.replace(/\s+/g, '-');
}

/**
 * Check if two period strings refer to the identical data cycle.
 */
export function isDataPeriodMatching(periodA, periodB) {
  if (!periodA || !periodB) return false;
  const normA = normalizeDataPeriod(periodA);
  const normB = normalizeDataPeriod(periodB);
  if (!normA || !normB) return false;
  return normA === normB;
}

/**
 * Classify a diagram label into one of five canonical safety types.
 */
export function classifyVisualClaim(text) {
  if (!text || typeof text !== 'string') return { type: CLAIM_TYPES.STATIC_CONCEPT, text: '' };
  const trimmed = text.trim();

  // 1. Legal / Constitutional Reference
  const isPureLegal = /^(?:(?:Article|Art\.?|Section|Sec\.?)\s+\d+[A-Z]?|(?:\d+(?:st|nd|rd|th)\s+(?:CAA|Amendment|Commission|Finance Commission|FC))|(?:(?:FRBM|Disaster Management|NDMA|RTI|RTE|EPA|Wildlife Protection)\s+Act(?:\s+\d{4})?)|(?:Schedule|Part)\s+[IVXLCDM\d]+)$/i.test(trimmed);
  if (isPureLegal) {
    return { type: CLAIM_TYPES.LEGAL_CONSTITUTIONAL_REFERENCE, text: trimmed };
  }

  // 2. Check for unsupported non-numeric factual assertions (specific outlays/allocations, legal compliance claims)
  const factualAssertionPattern = /\b(Amaravati Outlay|Amaravati Allocation|FRBM Compliant|Deficit Target Met|Statutory Compliance Certified|100% Target Achieved)\b/i;
  if (factualAssertionPattern.test(trimmed)) {
    return { type: CLAIM_TYPES.CURRENT_FACTUAL_CLAIM, text: trimmed, isAssertion: true };
  }

  // 3. Quantitative Claim Check (contains numbers with units, %, thresholds, etc.)
  let stripped = trimmed
    .replace(/\b(Article|Art\.?|Section|Sec\.?)\s+\d+[A-Z]?\b/gi, '')
    .replace(/\b\d+(st|nd|rd|th)\s+(Amendment|CAA|Commission|FC|Five\s+Year\s+Plan|Report)\b/gi, '')
    .replace(/\b(Schedule|Sched\.?|Part)\s+([IVXLCDM]+|\d+)\b/gi, '')
    .replace(/\b\d+-tier\b/gi, '')
    .replace(/^\s*\d+[\.\)]\s+/gi, '')
    .replace(/\b(Step|Option|Phase|Stage|Tier|Level|Point|Item)\s+\d+\b/gi, '')
    .replace(/\b\d+(st|nd|rd|th)\s+(Stage|Tier|Step|Phase|Level|Option)\b/gi, '')
    .replace(/\bFY\s*\d{4}[-\/]\d{2,4}\b/gi, '')
    .replace(/\b(1[6-9]\d{2}|20\d{2})\b/g, '')
    .replace(/\b(H2O|CO2|NOx|CH4|H2|O2|N2|SO2|PM2\.5|PM10|2\.5D|3D|2D)\b/gi, '');

  const numericPattern = /(\d+(\.\d+)?)\s*(%|mm|cm|m|km|hr|hour|lakh|crore|cr|trillion|billion|bn|mn|rs|inr|₹|\$|usd|gw|mw|kw|twh|°c|°f|deg|bar|ppm|cpi|gdp|infl)/i;
  const thresholdPattern = /([><~±]\s*\d+(\.\d+)?)/;
  const standaloneNumberPattern = /\b\d+(\.\d+)?\b/;

  if (numericPattern.test(stripped) || thresholdPattern.test(stripped) || standaloneNumberPattern.test(stripped)) {
    const match = stripped.match(/\d+(\.\d+)?/);
    return { type: CLAIM_TYPES.QUANTITATIVE_CLAIM, text: trimmed, foundNumber: match ? parseFloat(match[0]) : null };
  }

  // 4. Default: Static Concept
  return { type: CLAIM_TYPES.STATIC_CONCEPT, text: trimmed };
}

/**
 * Scan all text nodes in a diagram for unverified quantitative claims and unsupported factual assertions.
 * Enforces strict period matching and canonical verification status.
 */
export function scanTextForUnverifiedNumericClaims(text, verifiedEvidence = [], isHistorical = false, visualDataPeriod = null) {
  if (!text || typeof text !== 'string') return { hasUnverifiedClaim: false };

  const classification = classifyVisualClaim(text);

  // Structural legal references and static concepts are safe
  if (classification.type === CLAIM_TYPES.LEGAL_CONSTITUTIONAL_REFERENCE || classification.type === CLAIM_TYPES.STATIC_CONCEPT) {
    return { hasUnverifiedClaim: false };
  }

  // Handle unsupported factual assertions (e.g. "Amaravati Outlay", "FRBM Compliant")
  if (classification.isAssertion) {
    const isAssertionBacked = Array.isArray(verifiedEvidence) && verifiedEvidence.some(ve => {
      if (!CANONICAL_VERIFICATION_STATUSES.includes(ve.verification_status)) return false;
      if (ve.verification_status === 'unverified' || ve.verification_status === 'disputed') return false;

      // Period matching check
      if (visualDataPeriod && ve.data_period && !isDataPeriodMatching(visualDataPeriod, ve.data_period)) {
        return false;
      }

      const matchKey = (ve.canonical_claim_key || '').toLowerCase();
      const matchTitle = (ve.title || '').toLowerCase();
      const matchText = (ve.value_text || '').toLowerCase();
      const claimLower = text.toLowerCase();

      if (claimLower.includes('amaravati') && (matchKey.includes('amaravati') || matchTitle.includes('amaravati') || matchText.includes('amaravati'))) {
        return true;
      }
      if (claimLower.includes('frbm compliant') && (matchKey.includes('frbm') || matchTitle.includes('frbm') || matchText.includes('frbm'))) {
        return true;
      }
      return false;
    });

    if (!isAssertionBacked) {
      return {
        hasUnverifiedClaim: true,
        claim: text.trim(),
        isAssertion: true,
        reason: `Unsupported factual assertion "${text.trim()}". Requires verified official evidence or must use conceptual phrasing.`
      };
    }

    return { hasUnverifiedClaim: false, matched: true };
  }

  // Handle Quantitative Claims
  if (classification.type === CLAIM_TYPES.QUANTITATIVE_CLAIM) {
    const foundNumber = classification.foundNumber;

    if (Array.isArray(verifiedEvidence) && verifiedEvidence.length > 0) {
      const isMatched = verifiedEvidence.some(ve => {
        // Enforce canonical statuses: legacy verified_official is rejected
        if (!CANONICAL_VERIFICATION_STATUSES.includes(ve.verification_status)) {
          return false;
        }

        // Period Matching Rule: Evidence data_period must match visual period
        if (visualDataPeriod && ve.data_period) {
          if (!isDataPeriodMatching(visualDataPeriod, ve.data_period)) {
            return false; // E.g. FY 2026-27 evidence cannot validate FY 2025-26 visual
          }
        }

        // Status Rule:
        if (!isHistorical) {
          // CURRENT visual requires verified_current
          const isCurrentValid = ve.verification_status === 'verified_current' && 
                                 ve.officialLatestConfirmed !== false && 
                                 ve.refreshRequired !== true && 
                                 !ve.is_stale;
          if (!isCurrentValid) return false;
        } else {
          // HISTORICAL visual requires verified_historical (or verified_current if period strictly matches)
          let isHistValid = ve.verification_status === 'verified_historical';
          if (!isHistValid && ve.verification_status === 'verified_current') {
            // Only allowed if data_period strictly matches visualDataPeriod
            if (visualDataPeriod && ve.data_period && isDataPeriodMatching(visualDataPeriod, ve.data_period)) {
              isHistValid = true;
            }
          }
          if (!isHistValid) return false;
        }

        // Numeric / text match
        if (ve.numeric_value !== null && foundNumber !== null) {
          const numVal = Number(ve.numeric_value);
          if (Math.abs(numVal - foundNumber) < 0.1) return true;
          // Scale conversions (e.g. 3.12 Lakh Cr vs 312000 Cr)
          if (Math.abs(numVal - (foundNumber * 100000)) < 1 || Math.abs(numVal - (foundNumber * 1000)) < 1 || Math.abs((numVal / 100000) - foundNumber) < 0.05) {
            return true;
          }
        }
        if (ve.value_text && text.toLowerCase().includes(String(ve.value_text).toLowerCase())) {
          return true;
        }
        return false;
      });

      if (isMatched) {
        return { hasUnverifiedClaim: false, matched: true };
      }
    }

    // Not backed by matching verified evidence
    return {
      hasUnverifiedClaim: true,
      claim: text.trim(),
      foundNumber,
      reason: `Unverified quantitative claim: "${text.trim()}" requires verified official evidence matching period ${visualDataPeriod || 'current'}.`
    };
  }

  return { hasUnverifiedClaim: false };
}

/**
 * Recursively collect all text strings from a diagram specification.
 */
function collectAllStringsFromSpec(obj) {
  const strings = [];
  function recurse(val) {
    if (!val) return;
    if (typeof val === 'string') {
      strings.push(val);
    } else if (Array.isArray(val)) {
      val.forEach(recurse);
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        // Skip internal identifiers, coordinates, styling
        if (['id', 'x', 'y', 'width', 'height', 'fill', 'stroke', 'renderer', 'visualGrammar', 'grammar', 'origin'].includes(k)) continue;
        recurse(v);
      }
    }
  }
  recurse(obj);
  return strings;
}

/**
 * Validate and sanitize generated visual specification across all visual grammars.
 */
export function validateVisualSpecification(visualType, spec, verifiedEvidence = []) {
  if (!spec || typeof spec !== 'object') {
    return { isValid: false, error: 'Visual specification must be a non-null JSON object' };
  }

  const normalizedType = String(visualType || spec.visualGrammar || spec.renderer || '').toLowerCase().replace(/[-\s]+/g, '_');
  const sanitized = { ...spec };
  const isHistorical = Boolean(sanitized.isHistorical);
  const visualDataPeriod = sanitized.data_period || sanitized.dataPeriod || sanitized.period || (sanitized.title && sanitized.title.match(/FY\s*\d{4}[-\/]\d{2,4}/i)?.[0]) || null;

  // Sanitize title & description (strip any HTML tags)
  sanitized.title = sanitizeText(sanitized.title || `${visualType} Diagram`);
  if (sanitized.description) {
    sanitized.description = sanitizeText(sanitized.description);
  }

  // 1. Universal Numeric & Evidence Safety Gate Across ALL Grammars (Except pure Chart handled in step 10)
  if (normalizedType !== 'chart') {
    const allStrings = collectAllStringsFromSpec(sanitized);
    for (const str of allStrings) {
      const scanResult = scanTextForUnverifiedNumericClaims(str, verifiedEvidence, isHistorical, visualDataPeriod);
      if (scanResult.hasUnverifiedClaim) {
        return {
          isValid: false,
          error: scanResult.reason || `Unverified quantitative claim: "${str}" in ${normalizedType} diagram requires verified official evidence or must use conceptual phrasing.`
        };
      }
    }
  }

  // 2. Exam Sketch Validation
  if (normalizedType === 'exam_sketch') {
    const sketchResult = validateAndSanitizeExamSketch(sanitized);
    if (!sketchResult.isValid) {
      return { isValid: false, error: sketchResult.error || 'Invalid exam sketch structure' };
    }
    return {
      isValid: true,
      visualType: 'exam_sketch',
      rendererType: 'EXAM_SKETCH',
      spec: sketchResult.spec
    };
  }

  // 3. Hub & Spoke / Mindmap Validation
  if (normalizedType === 'hub_spoke' || normalizedType === 'mindmap' || normalizedType === 'concept_diagram') {
    let spokes = Array.isArray(sanitized.spokes) ? sanitized.spokes : (Array.isArray(sanitized.branches) ? sanitized.branches : sanitized.nodes || []);
    if (spokes.length === 0) {
      return { isValid: false, error: 'Hub & Spoke / Mindmap must contain at least 2 spokes/branches' };
    }
    sanitized.visualGrammar = 'hub_spoke';
    sanitized.renderer = 'HUB_SPOKE';
    sanitized.center = sanitizeText(sanitized.center || sanitized.central || sanitized.title);
    sanitized.spokes = spokes.map(s => typeof s === 'string' ? { label: sanitizeText(s), sublabel: '' } : { label: sanitizeText(s.label || s.title), sublabel: sanitizeText(s.sublabel || s.subtext || '') });
    return { isValid: true, visualType: normalizedType, rendererType: 'HUB_SPOKE', spec: sanitized };
  }

  // 4. Cause-Effect Validation
  if (normalizedType === 'cause_effect') {
    sanitized.visualGrammar = 'cause_effect';
    sanitized.renderer = 'CAUSE_EFFECT';
    sanitized.issue = sanitizeText(sanitized.issue || sanitized.centralProblem || sanitized.title);
    sanitized.causes = Array.isArray(sanitized.causes) ? sanitized.causes.map(sanitizeText) : (Array.isArray(sanitized.nodes) ? sanitized.nodes.slice(0, 3).map(sanitizeText) : ['Root Driver 1', 'Root Driver 2']);
    sanitized.effects = Array.isArray(sanitized.effects) ? sanitized.effects.map(sanitizeText) : ['Socio-Economic Impact 1', 'Systemic Impact 2'];
    sanitized.responses = Array.isArray(sanitized.responses) ? sanitized.responses.map(sanitizeText) : (Array.isArray(sanitized.solutions) ? sanitized.solutions.map(sanitizeText) : ['Policy Intervention']);
    return { isValid: true, visualType: 'cause_effect', rendererType: 'CAUSE_EFFECT', spec: sanitized };
  }

  // 5. Cycle Validation
  if (normalizedType === 'cycle') {
    let stages = Array.isArray(sanitized.stages) ? sanitized.stages : (Array.isArray(sanitized.nodes) ? sanitized.nodes : []);
    if (stages.length < 3) {
      return { isValid: false, error: 'Cycle diagram must have at least 3 stages' };
    }
    sanitized.visualGrammar = 'cycle';
    sanitized.renderer = 'CYCLE';
    sanitized.stages = stages.map(s => typeof s === 'string' ? sanitizeText(s) : { label: sanitizeText(s.label || s.title), subtext: sanitizeText(s.subtext || '') });
    return { isValid: true, visualType: 'cycle', rendererType: 'CYCLE', spec: sanitized };
  }

  // 6. Timeline Validation
  if (normalizedType === 'timeline') {
    let events = Array.isArray(sanitized.events) ? sanitized.events : (Array.isArray(sanitized.nodes) ? sanitized.nodes : []);
    if (events.length < 2) {
      return { isValid: false, error: 'Timeline must have at least 2 events' };
    }
    sanitized.visualGrammar = 'timeline';
    sanitized.renderer = 'TIMELINE';
    sanitized.events = events.map(e => typeof e === 'string' ? { label: sanitizeText(e), date: '' } : { label: sanitizeText(e.label || e.title), date: sanitizeText(e.date || e.year || e.period || '') });
    return { isValid: true, visualType: 'timeline', rendererType: 'TIMELINE', spec: sanitized };
  }

  // 7. Process Diagram Validation (Inputs -> Conversion Core -> Byproduct Splits -> Outputs & Feedback)
  if (normalizedType === 'process_diagram' || normalizedType === 'mechanism_diagram') {
    let inputs = Array.isArray(sanitized.inputs) ? sanitized.inputs : ['Input Feedstock'];
    let stages = Array.isArray(sanitized.stages) ? sanitized.stages : ['Core Conversion'];
    let outputs = Array.isArray(sanitized.outputs) ? sanitized.outputs : ['End Application'];

    sanitized.visualGrammar = 'process_diagram';
    sanitized.renderer = 'PROCESS_DIAGRAM';
    sanitized.inputs = inputs.map(i => typeof i === 'string' ? { label: sanitizeText(i), subtext: '' } : { label: sanitizeText(i.label || i.title), subtext: sanitizeText(i.subtext || '') });
    sanitized.stages = stages.map(st => typeof st === 'string' ? { name: sanitizeText(st), mechanism: '' } : { name: sanitizeText(st.name || st.label), mechanism: sanitizeText(st.mechanism || st.subtext || ''), byproducts: Array.isArray(st.byproducts) ? st.byproducts : [] });
    sanitized.outputs = outputs.map(o => typeof o === 'string' ? { label: sanitizeText(o), subtext: '' } : { label: sanitizeText(o.label || o.title), subtext: sanitizeText(o.subtext || '') });
    sanitized.feedback = Array.isArray(sanitized.feedback) ? sanitized.feedback.map(f => typeof f === 'string' ? { label: sanitizeText(f) } : { label: sanitizeText(f.label || f.text), from: sanitizeText(f.from || ''), to: sanitizeText(f.to || '') }) : [];

    return { isValid: true, visualType: 'process_diagram', rendererType: 'PROCESS_DIAGRAM', spec: sanitized };
  }

  // 8. Geography Process Sketch Validation
  if (normalizedType === 'geography_sketch' || normalizedType === 'physical_geography') {
    sanitized.visualGrammar = 'geography_sketch';
    sanitized.renderer = 'GEOGRAPHY_SKETCH';
    sanitized.process = sanitizeText(sanitized.process || sanitized.title);
    sanitized.regions = Array.isArray(sanitized.regions) ? sanitized.regions.map(sanitizeText) : ['West Pacific', 'Central-East Pacific', 'East Pacific'];
    return { isValid: true, visualType: 'geography_sketch', rendererType: 'GEOGRAPHY_SKETCH', spec: sanitized };
  }

  // 9. Flowchart / Process Flow Validation
  if (normalizedType === 'flowchart' || normalizedType === 'process_flow') {
    let steps = Array.isArray(sanitized.steps) ? sanitized.steps : (Array.isArray(sanitized.nodes) ? sanitized.nodes : []);
    if (steps.length < 2) {
      return { isValid: false, error: 'Flowchart must have at least 2 steps' };
    }
    sanitized.visualGrammar = 'flowchart';
    sanitized.renderer = 'FLOWCHART';
    sanitized.steps = steps.map(s => typeof s === 'string' ? sanitizeText(s) : { label: sanitizeText(s.label || s.title), subtext: sanitizeText(s.subtext || '') });
    return { isValid: true, visualType: 'flowchart', rendererType: 'FLOWCHART', spec: sanitized };
  }

  // 10. Chart Validation (Requires Verified Current Numeric Evidence)
  if (normalizedType === 'chart') {
    sanitized.renderer = 'BAR_CHART';
    let dataPoints = Array.isArray(sanitized.data) ? sanitized.data : [];

    const hasInvalidNumbers = dataPoints.some(dp => {
      const matchingEvidence = verifiedEvidence.filter(ve => 
        (ve.numeric_value !== null && Math.abs(Number(ve.numeric_value) - Number(dp.value)) < 0.05) ||
        (ve.is_official && (isHistorical || ve.verification_status === 'verified_current'))
      );

      if (matchingEvidence.length === 0) return true;

      if (!isHistorical) {
        // Must be verified_current, latest confirmed, and not stale
        const hasCurrentConfirm = matchingEvidence.some(ve => 
          ve.verification_status === 'verified_current' && 
          ve.officialLatestConfirmed !== false && 
          ve.refreshRequired !== true && 
          !ve.is_stale
        );
        return !hasCurrentConfirm;
      }

      return false;
    });

    if (hasInvalidNumbers || (dataPoints.length > 0 && verifiedEvidence.length === 0)) {
      return {
        isValid: false,
        error: 'Quantitative charts require verified current official evidence. Historical or stale statistics cannot be used in current visual packs.'
      };
    }

    return { isValid: true, visualType: 'chart', rendererType: 'BAR_CHART', spec: sanitized };
  }

  // Default fallback for any other structured schema
  sanitized.renderer = sanitized.renderer || 'CONCEPT_DIAGRAM';
  return {
    isValid: true,
    visualType: normalizedType,
    rendererType: sanitized.renderer,
    spec: sanitized
  };
}

/**
 * Strip HTML tags and unsafe script characters
 */
function sanitizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>?/gm, '')
    .replace(/[<>`]/g, '')
    .trim();
}
