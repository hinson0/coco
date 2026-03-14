export interface GlmOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

export interface GlmResponse {
  readonly content: string;
}

export async function callGlm(prompt: string, options: GlmOptions): Promise<GlmResponse> {
  const { apiKey, model = "glm-4-flash", timeoutMs = 8000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GLM API error: ${response.status}`);
    const data = await response.json();
    return { content: data.choices[0].message.content };
  } finally {
    clearTimeout(timer);
  }
}
