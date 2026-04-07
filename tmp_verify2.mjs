import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { expandCanonicalOrLegacyToLeafNodeIds } from './backend/brain/unifiedSyllabusIndex.js';

const require = createRequire(import.meta.url);
const master = require('./backend/data/pyq_index/pyq_master_index.json');
const byNode = require('./backend/data/pyq_index/pyq_by_node.json');

const vals = Object.values(master);
const matching = vals.filter(q => q.syllabusNodeId === '1C.VA.ARCH' || q.nodeId === '1C.VA.ARCH');
const archKeys = Object.keys(byNode).filter(k => k.includes('ARCH'));
const resolved = expandCanonicalOrLegacyToLeafNodeIds('1C.VA.ARCH');

const result = {
  masterQuestionsWithRaw1C_VA_ARCH: matching.length,
  sampleQuestion: matching[0] ? { id: matching[0].id, stage: matching[0].stage, year: matching[0].year, syllabusNodeId: matching[0].syllabusNodeId } : null,
  archKeysInByNode: archKeys,
  archKeyDetails: Object.fromEntries(archKeys.map(k => [k, { total: byNode[k].total, prelims: byNode[k].prelims?.length || 0, mains: byNode[k].mains?.length || 0 }])),
  directLookup_dotNotation: !!byNode['1C.VA.ARCH'],
  directLookup_dashNotation: !!byNode['1C-VA-ARCH'],
  resolverResult_for_1C_VA_ARCH: resolved,
};

writeFileSync('tmp_verify_result.json', JSON.stringify(result, null, 2), 'utf8');
console.log('DONE - written to tmp_verify_result.json');
