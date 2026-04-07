import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const master = require('./backend/data/pyq_index/pyq_master_index.json');
const byNode = require('./backend/data/pyq_index/pyq_by_node.json');

// 1. How many questions have raw 1C.VA.ARCH as their syllabusNodeId?
const vals = Object.values(master);
const matching = vals.filter(q => q.syllabusNodeId === '1C.VA.ARCH' || q.nodeId === '1C.VA.ARCH');
console.log('\n=== MASTER INDEX ===');
console.log('Questions with raw 1C.VA.ARCH:', matching.length);
if (matching.length > 0) {
  const s = matching[0];
  console.log('Sample[0]:', s.id, '| stage:', s.stage, '| year:', s.year, '| syllabusNodeId:', s.syllabusNodeId);
}

// 2. What ARCH keys exist in pyq_by_node?
console.log('\n=== PYQ_BY_NODE ARCH KEYS ===');
const archKeys = Object.keys(byNode).filter(k => k.includes('ARCH'));
console.log('Count:', archKeys.length);
archKeys.forEach(k => {
  console.log(' ', k, '=> total:', byNode[k].total, '| prelims:', byNode[k].prelims?.length || 0, '| mains:', byNode[k].mains?.length || 0);
});

// 3. Does '1C.VA.ARCH' (dot notation) exist?
console.log('\n=== DIRECT KEY LOOKUP ===');
console.log('1C.VA.ARCH present?', !!byNode['1C.VA.ARCH']);
console.log('1C-VA-ARCH present?', !!byNode['1C-VA-ARCH']);

// 4. What does expandCanonicalOrLegacyToLeafNodeIds return for '1C.VA.ARCH'?
import { expandCanonicalOrLegacyToLeafNodeIds } from './backend/brain/unifiedSyllabusIndex.js';
const resolved = expandCanonicalOrLegacyToLeafNodeIds('1C.VA.ARCH');
console.log('\n=== RESOLVER RESULT for 1C.VA.ARCH ===');
console.log('Resolved:', JSON.stringify(resolved));
