export function parseTrustProxy(value) {
  if (value === undefined || value === null || value === '') return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return value;
}

export function parseNonNegativeInt(value, fallback) {
  if (value === undefined || !/^\d+$/.test(String(value).trim())) return fallback;
  const parsed = Number(String(value).trim());
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function createRateLimiter({ capacity, refillPerMinute, now = Date.now, maxKeys = 10_000 }) {
  if (capacity === 0 || refillPerMinute === 0) return (_req, _res, next) => next();
  if (!Number.isFinite(capacity) || capacity < 0 || !Number.isFinite(refillPerMinute) || refillPerMinute < 0) {
    throw new RangeError('Rate limit capacity and refillPerMinute must be positive');
  }
  if (!Number.isSafeInteger(maxKeys) || maxKeys < 1) throw new RangeError('maxKeys must be a positive integer');

  const buckets = new Map();
  const refillPerMs = refillPerMinute / 60_000;
  const fullAfterMs = capacity / refillPerMs;
  let lastTimestamp = -Infinity;

  return (req, res, next) => {
    const timestamp = Math.max(lastTimestamp, now());
    lastTimestamp = timestamp;
    // A full idle bucket carries no useful state. Bound the remainder with LRU eviction.
    for (const [key, bucket] of buckets) {
      if (timestamp - bucket.updatedAt < fullAfterMs) break;
      buckets.delete(key);
    }

    const key = req.ip;
    const previous = buckets.get(key);
    const tokens = previous
      ? Math.min(capacity, previous.tokens + Math.max(0, timestamp - previous.updatedAt) * refillPerMs)
      : capacity;
    buckets.delete(key);
    if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
    buckets.set(key, { tokens: tokens >= 1 ? tokens - 1 : tokens, updatedAt: timestamp });

    if (tokens < 1) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000))));
      return res.status(429).json({ error: 'rate_limited' });
    }
    return next();
  };
}

export function createOriginGuard(allowedOrigin) {
  const allowed = new Set((allowedOrigin || '').split(',').map((origin) => origin.trim()).filter(Boolean));
  return (req, res, next) => {
    const origin = req.get?.('Origin') ?? req.headers?.origin;
    if (allowed.size && origin && !allowed.has(origin)) {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }
    return next();
  };
}

export function buildCsp(env = process.env) {
  const scripts = ["'self'", "'wasm-unsafe-eval'", 'blob:', 'https://webapi.amap.com'];
  if (env.CSP_SCRIPT_UNSAFE_EVAL === '1') scripts.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://webapi.amap.com https://*.amap.com https://*.is.autonavi.com https://*.autonavi.com",
    "connect-src 'self' blob: data: https://*.amap.com https://*.autonavi.com",
    "font-src 'self' data:",
    "media-src 'self' blob: data: mediastream:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function createSecurityHeaders(env = process.env) {
  const cspName = env.CSP_REPORT_ONLY === '1'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  const csp = buildCsp(env);
  return (req, res, next) => {
    res.setHeader(cspName, csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=()');
    if (env.HSTS === '1' && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    }
    next();
  };
}

export function setNoCache(res) {
  res.setHeader('Cache-Control', 'no-cache');
}

export function setStaticCacheHeaders(res, filePath) {
  if (filePath.endsWith('/index.html')) setNoCache(res);
  else if (/\/assets\/[^/]+-[\w-]{8,}\.[^/]+$/.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}
