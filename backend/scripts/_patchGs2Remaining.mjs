// Patch remaining GS2 missing nodes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAYER_DIR = path.join(__dirname, '../data/pyq_theme_layers');

const gs2 = JSON.parse(fs.readFileSync(path.join(LAYER_DIR, 'gs2_theme_layer.json'), 'utf8'));

let fixed = 0;
for (const [subject, subjectData] of Object.entries(gs2.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const n = subtheme.name;
      const mn = subtheme.mappedNodes;

      // GS2-GOV-REGULATORS-QUASI: Competition Commission = regulatory body
      if (n === 'Development Process and Industry' || n === 'Statutory Commissions' || n === 'Quasi-Judicial Bodies') {
        if (!mn.includes('GS2-GOV-REGULATORS-QUASI')) {
          mn.push('GS2-GOV-REGULATORS-QUASI');
          fixed++;
          console.log('Added GS2-GOV-REGULATORS-QUASI to', n);
        }
      }

      // GS2-IR-NEIGHBOURS: Bangladesh, Pakistan neighbourhood questions
      if (n === 'Indian Ocean Neighbourhood' || n === 'BIMSTEC') {
        if (!mn.includes('GS2-IR-NEIGHBOURS')) {
          mn.push('GS2-IR-NEIGHBOURS');
          fixed++;
          console.log('Added GS2-IR-NEIGHBOURS to', n);
        }
      }
    }
  }
}

fs.writeFileSync(path.join(LAYER_DIR, 'gs2_theme_layer.json'), JSON.stringify(gs2, null, 2), 'utf8');
console.log('Done. Fixed:', fixed);
