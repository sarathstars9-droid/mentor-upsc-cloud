import { UNIFIED_NODES_BY_ID } from '../brain/unifiedSyllabusIndex.js';

const ids = Object.keys(UNIFIED_NODES_BY_ID).sort();
const prefixes = ['GS2-IR', 'GS3-ST', 'GS3-ECO', 'GS1-GEO', 'GS1-HIS', 'GS1-ART', 'GS2-POL', 'GS3-ENV', 'MISC'];

for (const prefix of prefixes) {
  const matches = ids.filter(id => id.startsWith(prefix) || id.includes(prefix));
  console.log(`\n=== ${prefix} (${matches.length} nodes) ===`);
  matches.forEach(id => {
    const node = UNIFIED_NODES_BY_ID[id];
    console.log(`  ${id} : ${node.title || node.name} (${node.subject} > ${node.section} > ${node.topic})`);
  });
}
