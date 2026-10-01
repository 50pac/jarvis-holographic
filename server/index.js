import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));

// Node keeps existing process.env values when loading a file.
for (const name of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(rootDir, name));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const llmBaseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const llmApiKey = process.env.LLM_API_KEY || '';
const llmModel = process.env.LLM_MODEL || 'deepseek-chat';
const amapKey = process.env.AMAP_KEY || '';
const amapSecurityCode = process.env.AMAP_SECURITY_CODE || '';
const llmConfigured = Boolean(llmApiKey.trim());
const amapConfigured = Boolean(amapKey.trim() && amapSecurityCode.trim());
const app = express();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.json({
    amapKey,
    amapProxyHost: '/_AMapService',
    llmConfigured,
    amapConfigured,
  });
});

app.post('/api/llm', express.json({ limit: '32kb' }), async (req, res) => {
  if (!llmConfigured) {
    return res.status(503).json({
      error: 'llm_not_configured',
      message: 'LLM_API_KEY is not set on the server.',
    });
  }

  const body = req.body;
  let messages;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (body.messages !== undefined) {
      messages = body.messages;
    } else if (typeof body.prompt === 'string') {
      messages = [{ role: 'user', content: body.prompt }];
    }
  }

  const validMessages = Array.isArray(messages)
    && messages.length > 0
    && messages.length <= 20
    && messages.every((message) => message
      && typeof message === 'object'
      && ['system', 'user', 'assistant'].includes(message.role)
      && typeof message.content === 'string'
      && message.content.trim().length > 0
      && message.content.length <= 8000)
    && messages.reduce((total, message) => total + message.content.length, 0) <= 24000;

  if (!validMessages) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  messages = messages.map(({ role, content }) => ({ role, content }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const upstream = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: llmModel, messages, stream: false }),
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'llm_upstream_error', status: upstream.status });
    }
    const result = await upstream.json();
    return res.json(result);
  } catch {
    return res.status(502).json({
      error: 'llm_upstream_error',
      status: controller.signal.aborted ? 504 : 0,
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.use('/_AMapService', async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!amapSecurityCode.trim()) {
    return res.status(503).json({ error: 'amap_not_configured' });
  }

  const incoming = new URL(req.originalUrl, 'http://localhost');
  const target = new URL('https://restapi.amap.com/');
  target.pathname = incoming.pathname.slice('/_AMapService'.length) || '/';
  for (const [key, value] of incoming.searchParams) {
    if (key.toLowerCase() !== 'jscode') target.searchParams.append(key, value);
  }
  target.searchParams.set('jscode', amapSecurityCode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {},
      body: req.method === 'POST' ? req : undefined,
      duplex: req.method === 'POST' ? 'half' : undefined,
      signal: controller.signal,
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), res);
    else res.end();
  } catch {
    if (res.headersSent) res.destroy();
    else res.status(502).json({ error: 'amap_upstream_error' });
  } finally {
    clearTimeout(timeout);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const distDir = join(rootDir, 'dist');
if (process.env.NODE_ENV === 'production' || existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  if (res.headersSent) return res.destroy();
  res.status(error.status === 413 ? 413 : 400).json({ error: 'invalid_request' });
});

app.listen(port, host, () => {
  console.log(`Proxy listening on ${host}:${port} (LLM configured: ${llmConfigured}, AMap configured: ${amapConfigured})`);
});
