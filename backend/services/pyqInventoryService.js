import { query } from '../db/index.js';
import { buildPyqCorpusInventory, getWorkspacePyqMetrics } from '../brain/pyqCorpusInventory.js';

export async function fetchAttemptedPyqIds(userId) {
  if (!userId) return null;
  try {
    const results = await Promise.all([
      query('SELECT DISTINCT question_id FROM public.pyq_attempts WHERE user_id = $1', [userId]),
      query('SELECT DISTINCT question_id FROM public.mains_answer_attempts WHERE user_id = $1', [userId]),
    ]);
    return new Set(results.flatMap(r => r.rows.map(row => row.question_id)).filter(Boolean));
  } catch {
    return null; // Unavailable evidence is not zero attempts.
  }
}

export async function reconcileDashboardPyqInventory(data, userId) {
  const inventory = buildPyqCorpusInventory();
  const attempts = await fetchAttemptedPyqIds(userId);
  for (const paper of data.papers || []) {
    const metrics = getWorkspacePyqMetrics(paper.paperKey, attempts, inventory);
    if (!metrics) continue;
    // Only presentation inventory fields: progress/readiness were already computed.
    Object.assign(paper.pyq, metrics, { totalPyqs: metrics.physicalCorpusTotal, attemptedPyqs: metrics.attemptedUnique });
  }
  return data;
}
