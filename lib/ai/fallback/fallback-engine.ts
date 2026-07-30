export type AIProvider = "gemini" | "openrouter" | "openai" | "anthropic";

interface ProviderConfig {
  name: string;
  apiKeyEnv: string;
  baseUrl?: string;
  model: string;
  priority: number; // Lower = higher priority (tried first)
  enabled: boolean;
}

export const AI_PROVIDERS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    name: "Google Gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    priority: 1,
    enabled: !!process.env.GEMINI_API_KEY,
  },
  openrouter: {
    name: "OpenRouter",
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    model: process.env.OPENAI_MODEL || "openrouter/free",
    priority: 2,
    enabled: !!process.env.OPENAI_API_KEY?.startsWith("sk-or-"),
  },
  openai: {
    name: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    priority: 3,
    enabled: !!process.env.OPENAI_API_KEY?.startsWith("sk-proj-"),
  },
  anthropic: {
    name: "Anthropic Claude",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1",
    model: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
    priority: 4,
    enabled: !!process.env.ANTHROPIC_API_KEY,
  },
};

export interface FallbackResult {
  content: string;
  provider: string;
  model: string;
  attempts: number;
  latencyMs: number;
}

export interface FallbackOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULT_FALLBACK_OPTIONS: FallbackOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("503") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("connection") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up")
  );
}

export class AIFallbackEngine {
  private providers: ProviderConfig[];
  private options: FallbackOptions;

  constructor(options: FallbackOptions = {}) {
    this.options = { ...DEFAULT_FALLBACK_OPTIONS, ...options };
    this.providers = Object.values(AI_PROVIDERS)
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  async generateWithFallback(
    prompt: string,
    systemPrompt?: string,
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempts = 0;

    for (const provider of this.providers) {
      for (let attempt = 1; attempt <= (this.options.maxRetries || 1); attempt++) {
        attempts++;
        try {
          const content = await this.callProvider(provider, prompt, systemPrompt);
          return {
            content,
            provider: provider.name,
            model: provider.model,
            attempts,
            latencyMs: Date.now() - startTime,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(
            `[AIFallbackEngine] ${provider.name} attempt ${attempt} failed:`,
            lastError.message,
          );

          if (!isRetryableError(lastError) || attempt === this.options.maxRetries) {
            break; // Move to next provider
          }

          await sleep((this.options.retryDelayMs || 1000) * attempt);
        }
      }
    }

    throw new Error(
      `All AI providers failed after ${attempts} attempts. Last error: ${lastError?.message}`,
    );
  }

  private async callProvider(
    provider: ProviderConfig,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    switch (provider.apiKeyEnv) {
      case "GEMINI_API_KEY":
        return this.callGemini(provider, prompt, systemPrompt);
      case "OPENAI_API_KEY":
        return provider.baseUrl?.includes("openrouter")
          ? this.callOpenRouter(provider, prompt, systemPrompt)
          : this.callOpenAI(provider, prompt, systemPrompt);
      case "ANTHROPIC_API_KEY":
        return this.callAnthropic(provider, prompt, systemPrompt);
      default:
        throw new Error(`Unknown provider: ${provider.name}`);
    }
  }

  private async call>=$callGemini(
    provider: ProviderConfig,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      provider.model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemPrompt
          ? { parts: [{ text: systemPrompt }] }
          : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || `Gemini HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!content) throw new Error("Gemini returned empty response");
    return content;
  }

  private async callOpenRouter(
    provider: ProviderConfig,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENAI_HTTP_REFERER || "http://localhost:3000",
        "X-Title": process.env.OPENAI_APP_TITLE || "EduFlow AI",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.45,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || `OpenRouter HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenRouter returned empty response");
    return content;
  }

  private async callOpenAI(
    provider: ProviderConfig,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.45,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || `OpenAI HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI returned empty response");
    return content;
  }

  private async callAnthropic(
    provider: ProviderConfig,
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || `Anthropic HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const content = data.content?.find((c) => c.type === "text")?.text;
    if (!content) throw new Error("Anthropic returned empty response");
    return content;
  }
}
