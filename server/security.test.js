import { describe, expect, it, vi } from 'vitest';
import {
  buildCsp,
  createOriginGuard,
  createRateLimiter,
  createSecurityHeaders,
  parseNonNegativeInt,
  parseTrustProxy,
  setNoCache,
  setStaticCacheHeaders,
} from './security.js';

function runMiddleware(middleware, { ip = '192.0.2.1', origin, secure = false } = {}) {
  const headers = {};
  const response = {
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const next = vi.fn();
  middleware({ ip, headers: origin ? { origin } : {}, secure }, response, next);
  return { response, headers, next };
}

describe('rate limiting', () => {
  it('exhausts the burst, returns a retry delay, and refills over time', () => {
    let time = 0;
    const limiter = createRateLimiter({ capacity: 2, refillPerMinute: 60, now: () => time });
    expect(runMiddleware(limiter).next).toHaveBeenCalledOnce();
    expect(runMiddleware(limiter).next).toHaveBeenCalledOnce();
    const blocked = runMiddleware(limiter);
    expect(blocked.response.statusCode).toBe(429);
    expect(blocked.response.body).toEqual({ error: 'rate_limited' });
    expect(blocked.headers['retry-after']).toBe('1');
    time = 1000;
    expect(runMiddleware(limiter).next).toHaveBeenCalledOnce();
  });

  it('separates IPs and can be disabled with a zero parameter', () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerMinute: 1, now: () => 0 });
    expect(runMiddleware(limiter, { ip: 'a' }).next).toHaveBeenCalledOnce();
    expect(runMiddleware(limiter, { ip: 'a' }).response.statusCode).toBe(429);
    expect(runMiddleware(limiter, { ip: 'b' }).next).toHaveBeenCalledOnce();
    for (const option of [{ capacity: 0, refillPerMinute: 1 }, { capacity: 1, refillPerMinute: 0 }]) {
      const disabled = createRateLimiter(option);
      expect(runMiddleware(disabled).next).toHaveBeenCalledOnce();
      expect(runMiddleware(disabled).next).toHaveBeenCalledOnce();
    }
  });

  it('expires full idle buckets and evicts the least recently used key at maxKeys', () => {
    let time = 0;
    const limiter = createRateLimiter({ capacity: 1, refillPerMinute: 60, now: () => time, maxKeys: 2 });
    runMiddleware(limiter, { ip: 'a' });
    runMiddleware(limiter, { ip: 'b' });
    runMiddleware(limiter, { ip: 'c' });
    expect(runMiddleware(limiter, { ip: 'a' }).next).toHaveBeenCalledOnce();
    expect(runMiddleware(limiter, { ip: 'a' }).response.statusCode).toBe(429);
    time = 1000;
    runMiddleware(limiter, { ip: 'd' });
    expect(runMiddleware(limiter, { ip: 'a' }).next).toHaveBeenCalledOnce();
  });
});

describe('proxy and security configuration', () => {
  it('parses trust proxy values and invalid rate limit values', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy(' ')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('0')).toBe(0);
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.0/8, loopback')).toBe('10.0.0.0/8, loopback');
    expect(parseNonNegativeInt('0', 20)).toBe(0);
    for (const bad of [' ', '-1', '1.2', '1e2', '0x10', 'oops', 'Infinity']) expect(parseNonNegativeInt(bad, 20)).toBe(20);
  });

  it('builds a compatible CSP with opt-in switches', () => {
    const csp = buildCsp({});
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval' https://webapi.amap.com");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(buildCsp({ CSP_SCRIPT_UNSAFE_EVAL: '1' })).toContain("https://webapi.amap.com 'unsafe-eval'");
  });

  it('checks only configured origins and applies security headers', () => {
    const guard = createOriginGuard('https://one.example, https://two.example');
    expect(runMiddleware(guard, { origin: 'https://one.example' }).next).toHaveBeenCalledOnce();
    expect(runMiddleware(guard).next).toHaveBeenCalledOnce();
    expect(runMiddleware(createOriginGuard(''), { origin: 'https://other.example' }).next).toHaveBeenCalledOnce();
    const blocked = runMiddleware(guard, { origin: 'https://other.example' });
    expect(blocked.response.statusCode).toBe(403);
    expect(blocked.response.body).toEqual({ error: 'origin_not_allowed' });

    const headers = runMiddleware(createSecurityHeaders({ HSTS: '1' }), { secure: true }).headers;
    expect(headers['content-security-policy']).toContain('https://webapi.amap.com');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['permissions-policy']).toContain('camera=(self)');
    expect(headers['strict-transport-security']).toBe('max-age=15552000');
    expect(runMiddleware(createSecurityHeaders({ HSTS: '1' })).headers['strict-transport-security']).toBeUndefined();
    const report = runMiddleware(createSecurityHeaders({ CSP_REPORT_ONLY: '1' })).headers;
    expect(report['content-security-policy-report-only']).toBeDefined();
    expect(report['content-security-policy']).toBeUndefined();
  });

  it('caches hashed assets immutably and always revalidates the HTML shell', () => {
    const headers = {};
    const response = { setHeader(name, value) { headers[name] = value; } };
    setStaticCacheHeaders(response, '/app/dist/assets/index-aB12_cDe.js');
    expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    delete headers['Cache-Control'];
    setStaticCacheHeaders(response, '/app/dist/mediapipe/wasm/vision_wasm_internal.wasm');
    expect(headers['Cache-Control']).toBeUndefined();
    setStaticCacheHeaders(response, '/app/dist/index.html');
    expect(headers['Cache-Control']).toBe('no-cache');
    delete headers['Cache-Control'];
    setNoCache(response); // SPA fallback uses the same policy.
    expect(headers['Cache-Control']).toBe('no-cache');
  });
});

describe('middleware route ordering', () => {
  it('keeps health open and runs origin and rate checks before body parsing', () => {
    const guard = createOriginGuard('https://allowed.example');
    const limiter = createRateLimiter({ capacity: 1, refillPerMinute: 1 });
    const parseBody = vi.fn((_req, _res, next) => next());
    const security = createSecurityHeaders({});
    const runRoute = (middlewares, origin) => {
      const headers = {};
      const req = { ip: '192.0.2.1', headers: origin ? { origin } : {}, secure: false };
      const res = {
        statusCode: 200,
        body: undefined,
        setHeader(name, value) { headers[name.toLowerCase()] = value; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      let index = 0;
      const next = () => { middlewares[index++]?.(req, res, next); };
      next();
      return { res, headers };
    };
    const llmRoute = [security, guard, limiter, parseBody, (_req, res) => res.json({ ok: true })];
    const denied = runRoute(llmRoute, 'https://bad.example');
    expect(denied.res.statusCode).toBe(403);
    expect(denied.res.body).toEqual({ error: 'origin_not_allowed' });
    expect(parseBody).not.toHaveBeenCalled();
    const first = runRoute(llmRoute, 'https://allowed.example');
    expect(first.res.body).toEqual({ ok: true });
    expect(parseBody).toHaveBeenCalledOnce();
    const limited = runRoute(llmRoute, 'https://allowed.example');
    expect(limited.res.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeTruthy();
    expect(parseBody).toHaveBeenCalledOnce();
    const health = runRoute([security, (_req, res) => res.json({ ok: true })]);
    expect(health.res.body).toEqual({ ok: true });
    expect(health.headers['content-security-policy']).toContain('webapi.amap.com');
  });
});
