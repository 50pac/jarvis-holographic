import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOriginGuard, createRateLimiter, createSecurityHeaders, parseNonNegativeInt, parseTrustProxy, setNoCache, setStaticCacheHeaders } from './security.js';

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
const llmConfigured = Boolean(llmApiKey.trim());
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.use(createSecurityHeaders(process.env));

const originGuard = createOriginGuard(process.env.ALLOWED_ORIGIN);
const llmLimiter = createRateLimiter({
  capacity: parseNonNegativeInt(process.env.RATE_LIMIT_LLM_BURST, 10),
  refillPerMinute: parseNonNegativeInt(process.env.RATE_LIMIT_LLM_PER_MIN, 20),
});
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.json({ llmConfigured });
});

app.post('/api/llm', originGuard, llmLimiter, express.json({ limit: '32kb' }), async (req, res) => {
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

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const distDir = join(rootDir, 'dist');
if (process.env.NODE_ENV === 'production' || existsSync(distDir)) {
  app.use(express.static(distDir, { setHeaders: setStaticCacheHeaders }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    setNoCache(res);
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  if (res.headersSent) return res.destroy();
  res.status(error.status === 413 ? 413 : 400).json({ error: 'invalid_request' });
});

app.listen(port, host, () => {
  console.log(`Proxy listening on ${host}:${port} (LLM configured: ${llmConfigured})`);
});
