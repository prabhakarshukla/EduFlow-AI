import { AgentRunInput, runAgentCompletion } from "./shared";

export const agentName = "Flashcard Agent";

export const agentdetails =
  "Generates study flashcards from topics, notes, or study material.";

export const systemPrompt = `
You are EduFlow AI's Flashcard Agent.

Generate concise study flashcards.

Rules:
- Generate 8 flashcards.
- Each flashcard must have one clear question and one clear answer.
- Keep answers short but useful.
- Use only the provided notes if notes are provided.
- Return ONLY raw JSON.
- Do not wrap the response in markdown.
- Do not use code fences.

Output format:
{
  "flashcards": [
    {
      "question": "Question text",
      "answer": "Answer text"
    }
  ]
}
`;

export async function runAgent({
  userMessage,
  context,
}: AgentRunInput) {
  return runAgentCompletion({
    systemPrompt,
    userMessage,
    context,
    temperature: 0.4,
    maxTokens: 1200,
  });
}