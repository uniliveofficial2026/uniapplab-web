/**
 * Lightweight client for server-side AI (Vercel AI SDK on /api/ai/*).
 * Keeps the `ai` package off the browser bundle.
 */
export type PlatformAiGenerateResult = {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export async function platformAiGenerate(
  prompt: string,
  options?: { maxOutputTokens?: number },
): Promise<PlatformAiGenerateResult> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      prompt,
      maxOutputTokens: options?.maxOutputTokens,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `AI request failed (${res.status})`);
  }

  return (await res.json()) as PlatformAiGenerateResult;
}

export async function platformAiHealth(): Promise<{ status: string; geminiConfigured: boolean }> {
  const res = await fetch('/api/ai/health', { credentials: 'include' });
  if (!res.ok) throw new Error(`AI health failed (${res.status})`);
  return (await res.json()) as { status: string; geminiConfigured: boolean };
}
