export type AgentType = "planner" | "tutor" | "notes" | "flashcard" | "productivity" | "mood" | "timetable" | "recommendation" | "mindmap";

export type AgentContext = string | Record<string, unknown> | null | undefined;

export type AgentRunInput = {
  userMessage: string;
  context?: AgentContext;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const isRealOpenAiKey =
  process.env.OPENAI_API_KEY?.startsWith("sk-proj-") ||
  (process.env.OPENAI_API_KEY?.startsWith("sk-") && !process.env.OPENAI_API_KEY?.startsWith("sk-or-"));

const DEFAULT_MODEL =
  process.env.OPENAI_MODEL ||
  (isRealOpenAiKey ? "gpt-4o-mini" : "openrouter/free");

const DEFAULT_BASE_URL =
  process.env.OPENAI_BASE_URL ||
  (isRealOpenAiKey
    ? "https://api.openai.com/v1"
    : process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1");
const DEFAULT_REFERER =
  process.env.OPENAI_HTTP_REFERER || "http://localhost:3000";
const DEFAULT_TITLE = process.env.OPENAI_APP_TITLE || "EduFlow AI";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function resolveChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function formatContext(context: AgentContext): string | null {
  if (context == null) return null;
  if (typeof context === "string") {
    const trimmed = context.trim();
    return trimmed || null;
  }

  try {
    return JSON.stringify(context, null, 2);
  } catch (error) {
    return null;
  }
}

function buildHeaders() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing OPENAI_API_KEY.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": DEFAULT_REFERER,
    "X-Title": DEFAULT_TITLE,
  };
}

function buildPromptWithContext(userMessage: string, context: AgentContext) {
  const contextText = formatContext(context);
  if (!contextText) return userMessage;

  return `Additional context:\n${contextText}\n\nUser request:\n${userMessage}`;
}

function getTextFromGeminiResponse(data: GeminiResponse) {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function runAgentCompletion({
  systemPrompt,
  userMessage,
  context,
  temperature = 0.4,
  maxTokens = 1200,
}: {
  systemPrompt: string;
  userMessage: string;
  context?: AgentContext;
  temperature?: number;
  maxTokens?: number;
}) {
  const prompt = userMessage.trim();
  if (!prompt) {
    throw new Error("User message is required.");
  }

  const provider = (process.env.AI_PROVIDER || "openrouter")
    .trim()
    .toLowerCase();

  if (provider === "gemini") {
    try {
      return await runGeminiCompletion({
        systemPrompt,
        userMessage: prompt,
        context,
        temperature,
        maxTokens,
      });
    } catch (geminiError) {
      const message =
        geminiError instanceof Error ? geminiError.message : "Gemini failed.";
      console.error("[runAgentCompletion] Gemini error:", message);

      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          `Gemini request failed and no OpenRouter fallback key is configured: ${message}`,
        );
      }

      console.warn("[runAgentCompletion] Falling back to OpenRouter.");
    }
  } else if (provider && provider !== "openrouter" && provider !== "openai") {
    console.warn(
      `[runAgentCompletion] Unknown AI_PROVIDER "${provider}". Using OpenRouter-compatible fallback.`,
    );
  }

  return runOpenRouterCompletion({
    systemPrompt,
    userMessage: prompt,
    context,
    temperature,
    maxTokens,
  });
}

async function runGeminiCompletion({
  systemPrompt,
  userMessage,
  context,
  temperature,
  maxTokens,
}: {
  systemPrompt: string;
  userMessage: string;
  context?: AgentContext;
  temperature: number;
  maxTokens: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing GEMINI_API_KEY.");
  }

  const model = DEFAULT_GEMINI_MODEL.trim();
  if (!model) {
    throw new Error("Server is missing GEMINI_MODEL.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: `${systemPrompt}\nKeep the response concise and useful.` }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildPromptWithContext(userMessage, context) }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: Math.max(maxTokens, 8192),
    },
  });

  console.log("[runAgentCompletion] Gemini request:", {
    model,
    provider: "gemini",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (fetchError) {
    const errorMsg =
      fetchError instanceof Error ? fetchError.message : "Network error";
    throw new Error(`Gemini network error: ${errorMsg}`);
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (parseError) {
    const errorMsg =
      parseError instanceof Error ? parseError.message : "JSON parse error";
    throw new Error(`Failed to parse Gemini response: ${errorMsg}`);
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const content = getTextFromGeminiResponse(data);
  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  return content;
}

async function runOpenRouterCompletion({
  systemPrompt,
  userMessage,
  context,
  temperature,
  maxTokens,
}: {
  systemPrompt: string;
  userMessage: string;
  context?: AgentContext;
  temperature: number;
  maxTokens: number;
}) {
  const contextText = formatContext(context);
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (contextText) {
    messages.push({
      role: "system",
      content: `Additional context:\n${contextText}`,
    });
  }

  messages.push({ role: "user", content: userMessage });

  const url = resolveChatCompletionsUrl(DEFAULT_BASE_URL);
  const headers = buildHeaders();
  const body = JSON.stringify({
    model: DEFAULT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  console.log("[runAgentCompletion] Request details:", {
    url,
    model: DEFAULT_MODEL,
    messageCount: messages.length,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });
  } catch (fetchError) {
    const errorMsg =
      fetchError instanceof Error ? fetchError.message : "Network error";
    console.error("[runAgentCompletion] Fetch error:", errorMsg);
    throw new Error(`Network error: ${errorMsg}`);
  }

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch (parseError) {
    const errorMsg =
      parseError instanceof Error ? parseError.message : "JSON parse error";
    console.error("[runAgentCompletion] JSON parse error:", errorMsg);
    throw new Error(`Failed to parse response: ${errorMsg}`);
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `HTTP ${response.status}`;
    console.error("[runAgentCompletion] API error:", errorMsg);
    throw new Error(`AI provider returned error: ${errorMsg}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.error("[runAgentCompletion] Empty response from AI");
    throw new Error("AI returned an empty response.");
  }

  return content;
}

export async function runChatCompletion({
  systemPrompt,
  messages,
  temperature = 0.5,
  maxTokens = 1500,
}: {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
}) {
  if (!messages || messages.length === 0) {
    throw new Error("Conversation history is required.");
  }

  const provider = (process.env.AI_PROVIDER || "openrouter")
    .trim()
    .toLowerCase();

  if (provider === "gemini") {
    try {
      return await runGeminiChatCompletion({
        systemPrompt,
        messages,
        temperature,
        maxTokens,
      });
    } catch (geminiError) {
      const message =
        geminiError instanceof Error ? geminiError.message : "Gemini failed.";
      console.error("[runChatCompletion] Gemini error:", message);

      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          `Gemini request failed and no OpenRouter fallback key is configured: ${message}`,
        );
      }

      console.warn("[runChatCompletion] Falling back to OpenRouter.");
    }
  }

  return runOpenRouterChatCompletion({
    systemPrompt,
    messages,
    temperature,
    maxTokens,
  });
}

async function runGeminiChatCompletion({
  systemPrompt,
  messages,
  temperature,
  maxTokens,
}: {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature: number;
  maxTokens: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Server is missing GEMINI_API_KEY.");
  }

  const model = DEFAULT_GEMINI_MODEL.trim();
  if (!model) {
    throw new Error("Server is missing GEMINI_MODEL.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Map user/assistant turns to user/model roles for Gemini API
  const contents = messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: `${systemPrompt}\nKeep the response clean and format with Markdown.` }],
    },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: Math.max(maxTokens, 8192),
    },
  });

  console.log("[runChatCompletion] Gemini request:", {
    model,
    provider: "gemini",
    messageCount: messages.length,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (fetchError) {
    const errorMsg =
      fetchError instanceof Error ? fetchError.message : "Network error";
    throw new Error(`Gemini network error: ${errorMsg}`);
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (parseError) {
    const errorMsg =
      parseError instanceof Error ? parseError.message : "JSON parse error";
    throw new Error(`Failed to parse Gemini response: ${errorMsg}`);
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const content = getTextFromGeminiResponse(data);
  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  return content;
}

async function runOpenRouterChatCompletion({
  systemPrompt,
  messages,
  temperature,
  maxTokens,
}: {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  temperature: number;
  maxTokens: number;
}) {
  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: msg.content,
    })),
  ];

  const url = resolveChatCompletionsUrl(DEFAULT_BASE_URL);
  const headers = buildHeaders();
  const body = JSON.stringify({
    model: DEFAULT_MODEL,
    messages: apiMessages,
    temperature,
    max_tokens: maxTokens,
  });

  console.log("[runChatCompletion] Request details:", {
    url,
    model: DEFAULT_MODEL,
    messageCount: apiMessages.length,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });
  } catch (fetchError) {
    const errorMsg =
      fetchError instanceof Error ? fetchError.message : "Network error";
    console.error("[runChatCompletion] Fetch error:", errorMsg);
    throw new Error(`Network error: ${errorMsg}`);
  }

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch (parseError) {
    const errorMsg =
      parseError instanceof Error ? parseError.message : "JSON parse error";
    console.error("[runChatCompletion] JSON parse error:", errorMsg);
    throw new Error(`Failed to parse response: ${errorMsg}`);
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `HTTP ${response.status}`;
    console.error("[runChatCompletion] API error:", errorMsg);
    throw new Error(`AI provider returned error: ${errorMsg}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.error("[runChatCompletion] Empty response from AI");
    throw new Error("AI returned an empty response.");
  }

  return content;
}
