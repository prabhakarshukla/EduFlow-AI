import { ReadableStream } from "stream/web";
import { GoogleGenAI } from "@google/genai";

export type AgentType =
  | "planner"
  | "tutor"
  | "notes"
  | "productivity"
  | "mood"
  | "timetable"
  | "recommendation"
  | "mindmap"
  | "quiz";

export interface StreamCompletionInput {
  userMessage: string;
  agentType: AgentType | string;
  context?: Record<string, unknown> | string | null;
}

export interface LLMStreamOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}

const isRealOpenAiKey =
  process.env.OPENAI_API_KEY?.startsWith("sk-proj-") ||
  (process.env.OPENAI_API_KEY?.startsWith("sk-") &&
    !process.env.OPENAI_API_KEY?.startsWith("sk-or-"));

const DEFAULT_MODEL =
  process.env.OPENAI_MODEL || (isRealOpenAiKey ? "gpt-4o-mini" : "openrouter/free");
const DEFAULT_BASE_URL =
  process.env.OPENAI_BASE_URL ||
  (isRealOpenAiKey
    ? "https://api.openai.com/v1"
    : process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1");
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function resolveChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function formatContext(context?: Record<string, unknown> | string | null): string | null {
  if (context == null) return null;
  if (typeof context === "string") {
    const trimmed = context.trim();
    return trimmed || null;
  }
  try {
    return JSON.stringify(context, null, 2);
  } catch {
    return null;
  }
}

function buildPromptWithContext(userMessage: string, context?: Record<string, unknown> | string | null) {
  const contextText = formatContext(context);
  if (!contextText) return userMessage;
  return `Additional context:
${contextText}

User request:
${userMessage}`;
}

export class StreamingAgentRouter {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  async streamCompletion({
    userMessage,
    agentType = "notes",
    context,
  }: StreamCompletionInput): Promise<ReadableStream> {
    // Determine which provider to use for streaming
    const provider = (process.env.AI_PROVIDER || "openrouter").trim().toLowerCase();

    if (provider === "gemini" && this.ai) {
      return this.streamGemini({
        userMessage,
        context,
      });
    }

    return this.streamOpenRouter({
      userMessage,
      context,
    });
  }

  private async streamGemini({
    userMessage,
    context,
  }: {
    userMessage: string;
    context?: Record<string, unknown> | string | null;
  }): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Server is missing GEMINI_API_KEY.");
    }

    const model = DEFAULT_GEMINI_MODEL.trim();
    if (!model) {
      throw new Error("Server is missing GEMINI_MODEL.");
    }

    const prompt = buildPromptWithContext(userMessage, context);

    return new ReadableStream({
      async start(controller) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model,
          )}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.45,
                maxOutputTokens: 8192,
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: errorData?.error?.message || `Gemini HTTP ${response.status}` })}

`,
              ),
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "No response body from Gemini" })}

`,
              ),
            );
            controller.close();
            return;
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }

          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: message })}

`,
            ),
          );
          controller.close();
        }
      },
    });
  }

  private async streamOpenRouter({
    userMessage,
    context,
  }: {
    userMessage: string;
    context?: Record<string, unknown> | string | null;
  }): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Server is missing OPENAI_API_KEY.");
    }

    const prompt = buildPromptWithContext(userMessage, context);
    const url = resolveChatCompletionsUrl(DEFAULT_BASE_URL);
    const referer = process.env.OPENAI_HTTP_REFERER || "http://localhost:3000";
    const title = process.env.OPENAI_APP_TITLE || "EduFlow AI";

    return new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": referer,
              "X-Title": title,
            },
            body: JSON.stringify({
              model: DEFAULT_MODEL,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.45,
              max_tokens: 8192,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: errorData?.error?.message || `HTTP ${response.status}` })}

`,
              ),
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "No response body from OpenRouter" })}

`,
              ),
            );
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6).trim();
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const delta =
                  parsed?.choices?.[0]?.delta?.content ||
                  parsed?.choices?.[0]?.text ||
                  "";
                if (delta) {
                  controller.enqueue(
                    encoder.encode(`data: ${delta}

`),
                  );
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }

          // Process any remaining buffer
          if (buffer.trim()) {
            const line = buffer.trim();
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              try {
                const parsed = JSON.parse(data);
                const delta =
                  parsed?.choices?.[0]?.delta?.content ||
                  parsed?.choices?.[0]?.text ||
                  "";
                if (delta) {
                  controller.enqueue(encoder.encode(`data: ${delta}

`));
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}

`),
          );
          controller.close();
        }
      },
    });
  }
}
