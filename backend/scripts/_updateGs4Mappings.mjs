import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const gs4 = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pyq_theme_layers/gs4_theme_layer.json'), 'utf8'));

const gs4Mappings = {
  // Ethics Theory > Ethics and Human Interface
  'Ethics in Human Actions': ['GS4-ETH-GOV', 'GS4-ETH-HV'],
  'Determinants of Ethics in Human Actions': ['GS4-ETH-GOV'],
  'Consequences of Ethics in Human Actions': ['GS4-ETH-GOV'],
  'Role of Family, Society and Educational Institutions': ['GS4-ETH-HV', 'GS4-ETH-ATT'],
  'Human Values from Great Leaders, Reformers and Administrators': ['GS4-ETH-THINK', 'GS4-ETH-HV'],
  'Ethics in Private and Public Relationships': ['GS4-ETH-GOV', 'GS4-ETH-CS'],
  'Ethics and its Scope': ['GS4-ETH-GOV', 'GS4-ETH-APPLIED'],
  'Digital and Technology Ethics': ['GS4-ETH-APPLIED', 'GS4-ETH-GOV'],

  // Ethics Theory > Emotional Intelligence
  'Concept of Emotional Intelligence': ['GS4-ETH-EI'],
  'Emotional Intelligence in Ethical Decision Making': ['GS4-ETH-EI', 'GS4-ETH-GOV'],
  'Application of EI in Administration and Governance': ['GS4-ETH-EI', 'GS4-ETH-GOV'],
  'Managing Negative Emotions': ['GS4-ETH-EI'],

  // Ethics Theory > Aptitude and Foundational Values for Civil Service
  'Values and Public Values': ['GS4-ETH-HV', 'GS4-ETH-ATT'],
  'Aptitude': ['GS4-ETH-ATT'],
  'Integrity': ['GS4-ETH-ATT', 'GS4-ETH-PROB'],
  'Impartiality and Non-Partisanship': ['GS4-ETH-ATT'],
  'Objectivity': ['GS4-ETH-ATT'],
  'Dedication to Public Service': ['GS4-ETH-ATT', 'GS4-ETH-GOV'],
  'Empathy, Tolerance and Compassion': ['GS4-ETH-ATT', 'GS4-ETH-HV'],
  'Traits of an Effective Civil Servant': ['GS4-ETH-ATT', 'GS4-ETH-GOV'],

  // Public Administration Ethics > Public/Civil Service Values
  'Ethics in Public Administration': ['GS4-ETH-GOV'],
  'Ethics in Public Administration and its Problems': ['GS4-ETH-GOV', 'GS4-ETH-CS'],
  'Accountability and Ethical Governance': ['GS4-ETH-GOV', 'GS4-ETH-PROB'],
  'Strengthening Ethical and Moral Values in Governance': ['GS4-ETH-GOV', 'GS4-ETH-HV'],
  'Laws, Rules, Regulations and Conscience as Sources of Ethical Guidance': ['GS4-ETH-GOV', 'GS4-ETH-ATT'],
  'Ethical Concerns and Dilemmas in Government and Private Institutions': ['GS4-ETH-GOV', 'GS4-ETH-CS'],
  'Applied Ethics': ['GS4-ETH-APPLIED', 'GS4-ETH-GOV'],
  'Ethical Issues in International Relations and Funding': ['GS4-ETH-APPLIED'],
  'Corporate Governance': ['GS4-ETH-GOV', 'GS4-ETH-PROB'],
  'Constitutional Values and Public Accountability': ['GS4-ETH-GOV', 'GS4-ETH-PROB'],
  'Digitalization and Ethical Governance': ['GS4-ETH-APPLIED', 'GS4-ETH-GOV'],

  // Probity in Governance
  'Concept of Probity': ['GS4-ETH-PROB'],
  'Philosophical Basis of Governance and Probity': ['GS4-ETH-PROB', 'GS4-ETH-THINK'],
  'Information Sharing and Transparency in Government': ['GS4-ETH-PROB', 'GS4-ETH-GOV'],
  'Challenges of Corruption': ['GS4-ETH-PROB', 'GS4-ETH-GOV'],
  'Codes of Ethics and Codes of Conduct': ['GS4-ETH-PROB', 'GS4-ETH-ATT'],
  "Citizen's Charter": ['GS4-ETH-PROB', 'GS4-ETH-GOV'],
  'Quality of Service Delivery': ['GS4-ETH-PROB', 'GS4-ETH-GOV'],
  'Utilisation of Public Funds': ['GS4-ETH-PROB'],
  'Concept of Public Service': ['GS4-ETH-GOV', 'GS4-ETH-ATT'],
  'Work Culture': ['GS4-ETH-ATT', 'GS4-ETH-GOV'],
  'Gender and Probity in Public Service': ['GS4-ETH-PROB', 'GS4-ETH-GOV'],
  'Whistleblower Protection': ['GS4-ETH-PROB'],

  // Moral Thinkers and Philosophers
  'Indian Thinkers': ['GS4-ETH-THINK', 'GS4-ETH-HV'],
  'Western Thinkers': ['GS4-ETH-THINK'],
  'Quote Based Questions': ['GS4-ETH-THINK', 'GS4-ETH-HV'],
  'Indian Ethical Traditions': ['GS4-ETH-THINK', 'GS4-ETH-HV'],
  'Moral Reasoning and Intuition': ['GS4-ETH-THINK', 'GS4-ETH-ATT'],
  'Ethical Leadership and Character': ['GS4-ETH-THINK', 'GS4-ETH-ATT'],

  // Applied Ethics and Case Patterns > Applied Ethics
  'Technology and Digital Ethics': ['GS4-ETH-APPLIED', 'GS4-ETH-CS'],
  'Environmental and Development Ethics': ['GS4-ETH-APPLIED'],
  'War, Peace and International Ethics': ['GS4-ETH-APPLIED'],
  'Administrative Rationality and Ethics': ['GS4-ETH-GOV', 'GS4-ETH-CS'],
  'Governance Reform Ethics': ['GS4-ETH-GOV', 'GS4-ETH-CS'],
  'Gender, Inclusion and Equity': ['GS4-ETH-APPLIED', 'GS4-ETH-CS'],

  // Applied Ethics and Case Patterns > Case Study Pattern Framework
  'Crisis of Conscience Pattern': ['GS4-ETH-CS', 'GS4-ETH-ATT'],
  'Conflict of Interest Pattern': ['GS4-ETH-CS', 'GS4-ETH-PROB'],
  'Corruption and Probity Pattern': ['GS4-ETH-CS', 'GS4-ETH-PROB'],
  'Citizen-Centric Administration Pattern': ['GS4-ETH-CS', 'GS4-ETH-GOV'],
  'Compassion vs Rules Pattern': ['GS4-ETH-CS', 'GS4-ETH-ATT'],
  'Technology Misuse Pattern': ['GS4-ETH-CS', 'GS4-ETH-APPLIED'],
  'Gender and Vulnerability Pattern': ['GS4-ETH-CS', 'GS4-ETH-APPLIED'],
  'Institutional Integrity Pattern': ['GS4-ETH-CS', 'GS4-ETH-PROB'],
  'International and Environmental Tradeoff Pattern': ['GS4-ETH-CS', 'GS4-ETH-APPLIED'],
};

let updated = 0;
for (const subjectData of Object.values(gs4.subjects)) {
  for (const theme of subjectData.themes) {
    for (const subtheme of theme.subthemes) {
      const mapping = gs4Mappings[subtheme.name];
      if (mapping) {
        subtheme.mappedNodes = mapping;
        updated++;
      }
    }
  }
}

fs.writeFileSync(path.join(__dirname, '../data/pyq_theme_layers/gs4_theme_layer.json'), JSON.stringify(gs4, null, 2), 'utf8');
console.log('GS4: Updated', updated, 'subtheme mappedNodes');
