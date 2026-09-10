// Physical identity is independent of syllabus nodes and subject labels.
export const PHYSICAL_PAPERS = ['PRELIMS_GS', 'CSAT', 'MAINS_GS1', 'MAINS_GS2', 'MAINS_GS3', 'MAINS_GS4', 'ESSAY', 'OPTIONAL_P1', 'OPTIONAL_P2'];
export const PHYSICAL_STAGE = { PRELIMS_GS: 'prelims', CSAT: 'csat', MAINS_GS1: 'mains', MAINS_GS2: 'mains', MAINS_GS3: 'mains', MAINS_GS4: 'ethics', ESSAY: 'essay', OPTIONAL_P1: 'optional', OPTIONAL_P2: 'optional' };

export function getPhysicalExamIdentity(q = {}, sourcePaper = null) {
  const id = String(q.id || '').toUpperCase();
  const stage = String(q.stage || '').toLowerCase();
  const paper = String(q.paper || '').toUpperCase();
  const candidates = new Set();
  if (sourcePaper) candidates.add(sourcePaper);
  if (q.physicalPaper) candidates.add(q.physicalPaper);
  if (/^(PRE_CSAT_|CSAT_)/.test(id) || stage === 'csat' || paper === 'CSAT') candidates.add('CSAT');
  if (/^PRE_(?!CSAT_)/.test(id)) candidates.add('PRELIMS_GS');
  const gs = id.match(/^(?:MAINS?_)?(GS[1-4])_/);
  if (gs) candidates.add(`MAINS_${gs[1]}`);
  if (/^ESSAY_/.test(id) || stage === 'essay' || paper === 'ESSAY') candidates.add('ESSAY');
  if (/^ETH_/.test(id) || stage === 'ethics') candidates.add('MAINS_GS4');
  const optional = id.match(/^(?:OPTIONAL|OPT)_.*?P([12])_/);
  if (optional) candidates.add(`OPTIONAL_P${optional[1]}`);
  if (paper.includes('OPTIONAL') && [1, 2].includes(Number(q.paperNumber))) candidates.add(`OPTIONAL_P${q.paperNumber}`);
  // Historical Prelims records use GS2/GS3 as syllabus labels. Stage is authoritative.
  if (stage === 'prelims' && !candidates.has('CSAT')) candidates.add('PRELIMS_GS');
  if (stage !== 'prelims' && /^GS[1-4]$/.test(paper)) candidates.add(`MAINS_${paper}`);
  const values = [...candidates].sort();
  const valid = values.length === 1 && PHYSICAL_PAPERS.includes(values[0]);
  return { physicalPaper: valid ? values[0] : null, status: valid ? 'resolved' : values.length ? 'conflicting' : 'unresolved', candidates: values };
}
