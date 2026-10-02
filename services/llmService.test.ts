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
  expect(await LLMService.generateResponse('Hello')).toBe('静态演示模式，未连接后端。');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('calls the API in the default mode', async () => {
  vi.stubEnv('VITE_STATIC_DEMO', 'false');
  vi.resetModules();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '工单收到了。' } }] }) });
  vi.stubGlobal('fetch', fetchMock);
  const { LLMService } = await import('./llmService');
  expect(await LLMService.generateResponse('Hello')).toBe('工单收到了。');
  expect(fetchMock).toHaveBeenCalledWith('/api/llm', expect.objectContaining({ method: 'POST' }));
});
