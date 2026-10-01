export class LLMService {
  static initialize(): void {
    // The server owns LLM configuration.
  }

  static async generateResponse(prompt: string): Promise<string> {
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You need to fully embody JARVIS, the AI system from Marvel movies.Speak concisely and accurately, without rambling.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 503) {
          const error = await res.json().catch(() => null);
          if (error?.error === 'llm_not_configured') return 'Systems offline.';
        }
        return 'Communication link unstable.';
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === "string" && text.length > 0
        ? text
        : "I am unable to process that data, sir.";
    } catch {
      return "Communication protocols failing, sir.";
    }
  }
}
