import {
  AIFallbackEngine,
  AI_PROVIDERS,
  FallbackResult,
} from "./fallback-engine";
import type { AgentType } from "../agents/shared";

export interface GenerateOptions {
  agentType: AgentType;
  userMessage: string;
  context?: Record<string, unknown> | string | null;
  temperature?: number;
  maxTokens?: number;
  enableFallback?: boolean;
}

export interface GenerateResult extends FallbackResult {
  agentType: AgentType;
}

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  planner:
    "You are EduFlow AI's Planner Agent. Create detailed, actionable study plans.",
  tutor:
    "You are EduFlow AI's Tutor Agent. Explain concepts clearly with examples.",
  notes:
    "You are EduFlow AI's Notes Agent. Generate concise, exam-friendly notes.",
  productivity:
    "You are EduFlow AI's Productivity Agent. Provide time management and focus strategies.",
  mood: "You are EduFlow AI's Mood Agent. Offer emotional support and motivation.",
  timetable:
    "You are EduFlow AI's Timetable Agent. Create balanced study schedules.",
  recommendation:
    "You are EduFlow AI's Recommendation Agent. Suggest relevant resources and strategies.",
  mindmap:
    "You are EduFlow AI's Mind Map Agent. Create hierarchical concept maps.",
  quiz: "You are EduFlow AI's Quiz Agent. Generate diverse, challenging quiz questions.",
};

function buildPrompt(
  userMessage: string,
  context?: Record<string, unknown> | string | null,
): string {
  let prompt = userMessage.trim();

  if (context) {
    const contextText =
      typeof context === "string"
        ? context
        : JSON.stringify(context, null, 2);
    prompt = `Additional context:
${contextText}

User request:
${prompt}`;
  }

  return prompt;
}

export async function generateWithFallback({
  agentType,
  userMessage,
  context,
  enableFallback = true,
}: GenerateOptions): Promise<GenerateResult> {
  const systemPrompt = SYSTEM_PROMPTS[agentType] || SYSTEM_PROMIPTS.notes;
  const prompt = buildPrompt(userMessage, context);

  if (!enableFallback) {
    // Use the original provider without fallback
    const { runAgentCompletion } = await import("../agents/shared");
    const startTime = Date.now();
    const content = await runAgentCompletion({
      systemPrompt,
      userMessage: prompt,
      temperature: 0.45,
      maxTokens: 1200,
    });

    return {
      content,
      provider: process.env.AI_PROVIDER || "openrouter",
      model: "default",
      attempts: 1,
      latencyMs: Date.now() - startTime,
      agentType,
    };
  }

  const engine = new AIFallbackEngine({
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 30000,
  });

  const result = await engine.generateWithFallback(prompt, systemPrompt);

  return {
    ...result,
    agentType,
  };
}

export function getAvailableProviders(): string[] {
  return Object.entries(AI_PROVIDERS)
    .filter(([, config]) => config.enabled)
    .map(([key, config]) => `${config.name} (${key})`);
}
