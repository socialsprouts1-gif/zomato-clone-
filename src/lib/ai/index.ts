import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * Optional OpenAI call (GPT-4o-mini). Returns null when OPENAI_API_KEY is not set or the call fails,
 * so every caller must have a deterministic fallback.
 */
export async function aiComplete(system: string, user: string, maxTokens = 220): Promise<string | null> {
  const { OPENAI_API_KEY } = getServerEnv();
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export const isAiEnabled = () => Boolean(getServerEnv().OPENAI_API_KEY);
