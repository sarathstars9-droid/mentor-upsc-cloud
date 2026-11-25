/**
 * backend/services/currentAffairs/syllabusMappingService.js
 *
 * Canonical Syllabus Mapping Service (Phase 3A / 3A.1).
 * Maps Current Affairs issues strictly to verified syllabus nodes from the 1726-node unified index.
 * Categorizes mappings as 'primary', 'secondary', 'optional', or 'appsc_specific'.
 */

import { searchUnifiedNodes, getNodeById } from '../../brain/unifiedSyllabusIndex.js';

export const MAPPING_TYPES = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  OPTIONAL: 'optional',
  APPSC_SPECIFIC: 'appsc_specific'
};

// Canonical topic to exact 1726-node syllabus map
const KNOWN_TOPIC_SYLLABUS_MAP = {
  'inflation': [
    {
      nodeId: 'GS3-ECO-MONETARY-POLICY-MT04',
      type: MAPPING_TYPES.PRIMARY,
      reason: 'Core monetary policy, RBI MPC, inflation targeting framework'
    },
    {
      nodeId: 'GS3-ECO-PRE-INFLATION-MT02',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Macroeconomic price indices (CPI, WPI, core inflation measurement)'
    }
  ],
  'ap_budget': [
    {
      nodeId: 'GS3-ECO-BUDGETING-MT01',
      type: MAPPING_TYPES.APPSC_SPECIFIC,
      reason: 'State Budget outlay, Annual Financial Statement & outcome budgeting'
    },
    {
      nodeId: 'GS3-ECO-FISCAL-POLICY-MT01',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Fiscal policy, deficit management, and capital expenditure targets'
    }
  ],
  'urban_flooding': [
    {
      nodeId: 'GS3-DM-DISASTERS-MT06',
      type: MAPPING_TYPES.PRIMARY,
      reason: 'Disaster management vulnerability, flood hazard mitigation & urban resilience'
    },
    {
      nodeId: 'GS3-DM-PREP-MIT-MT10',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Disaster management cycle, early warning systems and CPHEEO drainage standards'
    },
    {
      nodeId: 'GS1-SOC-DEV-URBAN-MT03',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Urban governance, Smart Cities Mission stormwater infrastructure & master planning'
    },
    {
      nodeId: 'GS1-GEO-IND-CLIMATE-MT04',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Monsoon precipitation extremes, hydrometeorological flooding & catchment dynamics'
    },
    {
      nodeId: 'OPT-P2-INDIA-PHYS-MT05',
      type: MAPPING_TYPES.OPTIONAL,
      reason: 'Geography Optional: Regional hydrology, coastal surges, and drainage basin management'
    }
  ],
  'green_hydrogen': [
    {
      nodeId: 'GS3-ST-MAINS-CORE-MT14',
      type: MAPPING_TYPES.PRIMARY,
      reason: 'Renewable energy applications, fuel cells & zero-emission heavy transport technology'
    },
    {
      nodeId: 'GS3-ST-BIOTECH-MT03',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Hydrogen energy, bio-hydrogen and industrial decarbonisation technologies'
    },
    {
      nodeId: 'GS3-ENV-ENERGY-GOV-MT05',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'National Green Hydrogen Mission policy hooks and net-zero commitments'
    },
    {
      nodeId: 'GS1-GEO-IND-RESOURCES-MT03',
      type: MAPPING_TYPES.SECONDARY,
      reason: 'Energy resources: transition to renewables and clean hydrogen hubs'
    }
  ]
};

/**
 * Map an issue title / slug to canonical syllabus nodes from the 1726-node index.
 */
export function mapIssueToSyllabusNodes(topicSlug, title = '', examContext = 'both', region = 'india') {
  const normalizedSlug = String(topicSlug || '').toLowerCase().replace(/[-\s]+/g, '_');
  
  if (KNOWN_TOPIC_SYLLABUS_MAP[normalizedSlug]) {
    const preconfigured = KNOWN_TOPIC_SYLLABUS_MAP[normalizedSlug];
    return preconfigured.map(m => {
      const verifiedNode = getNodeById(m.nodeId);
      if (!verifiedNode) {
        throw new Error(`Integrity error: Node ID "${m.nodeId}" does not exist in 1726-node unifiedSyllabusIndex`);
      }
      return {
        nodeId: verifiedNode.syllabusNodeId,
        mappingType: m.type,
        confidence: 0.98,
        reason: m.reason,
        nodeDetails: {
          syllabusNodeId: verifiedNode.syllabusNodeId,
          rootPaper: verifiedNode.rootPaper,
          subject: verifiedNode.subject,
          section: verifiedNode.section,
          topic: verifiedNode.topic,
          microTheme: verifiedNode.microTheme,
          sourceFile: verifiedNode.sourceFile
        }
      };
    });
  }

  // Fallback: search unified syllabus index using keywords
  const searchResults = searchUnifiedNodes(title || topicSlug, { limit: 5 });
  if (searchResults.length > 0) {
    return searchResults.map((r, idx) => ({
      nodeId: r.syllabusNodeId,
      mappingType: idx === 0 ? MAPPING_TYPES.PRIMARY : MAPPING_TYPES.SECONDARY,
      confidence: Math.max(0.75, 1 - (idx * 0.1)),
      reason: `Syllabus semantic match on "${r.topic || r.section || title}"`,
      nodeDetails: {
        syllabusNodeId: r.syllabusNodeId,
        rootPaper: r.rootPaper,
        subject: r.subject,
        section: r.section,
        topic: r.topic,
        microTheme: r.microTheme,
        sourceFile: r.sourceFile
      }
    }));
  }

  // Return empty if completely unresolvable rather than inventing fake node IDs
  return [];
}
