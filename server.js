import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 10000);
const upstream = 'https://noose-interne-z2y73w.v2.appdeploy.ai';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '1mb' }));

app.get('/api/render-health', async (_req, res) => {
  try {
    const response = await fetch(`${upstream}/api/_healthcheck`);
    const text = await response.text();
    res.status(response.ok ? 200 : 502).json({ render: 'ok', upstreamStatus: response.status, upstreamBody: text.slice(0, 200) });
  } catch (error) {
    console.error('NOOSE upstream health failed', error);
    res.status(502).json({ render: 'ok', upstreamStatus: 'unreachable' });
  }
});

app.all('/api/*', async (req, res) => {
  try {
    const response = await fetch(`${upstream}${req.originalUrl}`, {
      method: req.method,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {})
    });
    const text = await response.text();
    console.log(`[API] ${req.method} ${req.path} -> upstream ${response.status}`);
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.send(text);
  } catch (error) {
    console.error(`[API] ${req.method} ${req.path} upstream unavailable`, error);
    res.status(502).json({ error: 'upstream_unavailable' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(port, '0.0.0.0', async () => {
  console.log(`N.O.O.S.E. internal portal listening on ${port}`);
  try {
    const response = await fetch(`${upstream}/api/_healthcheck`);
    console.log(`[UPSTREAM] health ${response.status}`);
  } catch (error) {
    console.error('[UPSTREAM] health unreachable', error);
  }
});
