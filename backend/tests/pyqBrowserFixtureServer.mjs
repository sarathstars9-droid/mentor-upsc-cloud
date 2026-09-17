import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.__pyqBrowserQuery = async sql => {
  assert(/^\s*SELECT\b/i.test(sql), 'Browser fixture permits SELECT only');
  return { rows: [] };
};
const databaseStub = 'data:text/javascript,' + encodeURIComponent('export const query = (...args) => globalThis.__pyqBrowserQuery(...args); export const pool = { query, end: async () => {} };');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/db/index.js')) return { url: databaseStub, shortCircuit: true };
    if (context.parentURL?.endsWith('/routes/progressRoutes.js') && /\/(progressService|telegramService)\.js$/.test(specifier)) {
      return { url: 'data:text/javascript,export%20const%20unused%20%3D%20true', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(backend);
process.chdir(backend);
const { default: drilldown } = await import('../routes/syllabusDrilldownRoutes.js');
const { default: progress } = await import('../routes/progressRoutes.js');
const { default: prelimsUnified } = await import('../routes/prelimsUnifiedRoutes.js');
const app = express();
app.use(express.json());
app.post('/api/auth/login', (_req, res) => res.json({ ok: true, token: 'local-pyq-browser-fixture' }));
app.get('/api/syllabus/drilldown/paper/:paperKey', (req, res) => res.redirect(307, `/api/syllabus/papers/${encodeURIComponent(req.params.paperKey)}${req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}`));
app.use('/api/syllabus', drilldown);
app.use('/api', progress);
app.use('/api/prelims-unified', prelimsUnified);
app.get('/api/weakness/map', (_req, res) => res.json({}));
app.get('/api/notifications/unread', (_req, res) => res.json({ ok: true, notifications: [] }));
app.get('/api/prelims/gs/counts', (_req, res) => res.json({ ok: true, total: 0, subjects: {} }));
app.get('/api/prelims/csat/counts', (_req, res) => res.json({ ok: true, total: 1200, quant: 501, lr: 255, rc: 444 }));
app.get('/api/prelims/csat/rc-subtopics', (_req, res) => res.json({ ok: true, counts: {} }));
app.get('/api/prelims/years', (_req, res) => res.json({ ok: true, years: [], availableFullLengthYears: [], fullLengthPapers: [] }));
app.get('/api/prelims/dashboard', (_req, res) => res.json({ ok: true, summary: {}, recommendations: [] }));
app.get('/api/weakness/top', (_req, res) => res.json({ ok: true, nodes: [{ node_id: 'GS1-HIS-ANC-PREHIST', node_name: 'Pre Historic Times', weakness_score: 0 }] }));
app.get('/api/prelims-tests/history', (_req, res) => res.json({ ok: true, attempts: [] }));
app.get('/api/revision', (_req, res) => res.json({ ok: true, items: [] }));
app.get('/api/adaptive/next-actions', (_req, res) => res.json({ ok: true, actions: [] }));
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'Fixture endpoint not implemented' }));
app.use(express.static(path.join(root, 'dist')));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(root, 'dist', 'index.html'));
});
const port = Number(process.env.PYQ_BROWSER_PORT || 8790);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`PYQ browser fixture listening on http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
