import { STATIC_DEMO } from './staticDemo';

export class LLMService {
  static initialize(): void {
    // The server owns LLM configuration.
  }

  static async generateResponse(prompt: string): Promise<string> {
    if (STATIC_DEMO) return '静态演示模式，未连接后端。';
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: '你是机库里的老班长，说话简短、实在，不超过两句话。',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 503) {
          const error = await res.json().catch(() => null);
          if (error?.error === 'llm_not_configured') return '对讲机没信号。';
        }
        return '对讲机没信号。';
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === "string" && text.length > 0
        ? text
        : "没听清，再说一遍。";
    } catch {
      return "对讲机没信号。";
    }
  }
}
