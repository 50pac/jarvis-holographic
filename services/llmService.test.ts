import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('returns the static demo message without calling fetch', async () => {
  vi.stubEnv('VITE_STATIC_DEMO', 'true');
  vi.resetModules();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const { LLMService } = await import('./llmService');
  expect(await LLMService.generateResponse('Hello')).toMatch(/static demonstration.*LLM services are unavailable/i);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('calls the API in the default mode', async () => {
  vi.stubEnv('VITE_STATIC_DEMO', 'false');
  vi.resetModules();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'At your service.' } }] }) });
  vi.stubGlobal('fetch', fetchMock);
  const { LLMService } = await import('./llmService');
  expect(await LLMService.generateResponse('Hello')).toBe('At your service.');
  expect(fetchMock).toHaveBeenCalledWith('/api/llm', expect.objectContaining({ method: 'POST' }));
});
