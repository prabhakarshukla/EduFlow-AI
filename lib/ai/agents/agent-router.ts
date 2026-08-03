import { AgentContext, AgentType } from "./shared";
import { agentName as plannerAgentName, runAgent as runPlannerAgent } from "./planner-agent";
import { agentName as tutorAgentName, runAgent as runTutorAgent } from "./tutor-agent";
import { agentName as notesAgentName, runAgent as runNotesAgent } from "./notes-agent";
import { agentName as productivityAgentName, runAgent as runProductivityAgent } from "./productivity-agent";
import { agentName as moodAgentName, runAgent as runMoodAgent } from "./mood-agent";
import { agentName as timetableAgentName, runAgent as runTimetableAgent } from "./timetable-agent";
import { agentName as recommendationAgentName, runAgent as runRecommendationAgent } from "./recommendation-agent";
import { agentName as mindmapAgentName, runAgent as runMindmapAgent } from "./mindmap-agent";
import {agentName as quizAgentName,runAgent as runQuizAgent} from "./quiz-agent";
import {agentName as flashcardAgentName,runAgent as runFlashcardAgent,} from "./flashcard-agent";
export type AgentRouterInput = {
  agentType?: AgentType | string;
  userMessage: string;
  context?: AgentContext;
};

const agentMap = {
  planner: {
    name: plannerAgentName,
    runAgent: runPlannerAgent,
  },
  tutor: {
    name: tutorAgentName,
    runAgent: runTutorAgent,
  },
  notes: {
    name: notesAgentName,
    runAgent: runNotesAgent,
  },
  flashcard: {
  name: flashcardAgentName,
  runAgent: runFlashcardAgent,
  },
  productivity: {
    name: productivityAgentName,
    runAgent: runProductivityAgent,
  },
  mood: {
    name: moodAgentName,
    runAgent: runMoodAgent,
  },
  timetable: {
    name: timetableAgentName,
    runAgent: runTimetableAgent,
  },
  recommendation: {
    name: recommendationAgentName,
    runAgent: runRecommendationAgent,
  },
  mindmap: {
    name: mindmapAgentName,
    runAgent: runMindmapAgent,
  },
  quiz: {
    name: quizAgentName,
    runAgent: runQuizAgent,
},
} as const;

function normalizeAgentType(agentType?: AgentType | string) {
  if (!agentType) return "tutor" as const;

  const normalized = agentType.trim().toLowerCase();
  if (normalized in agentMap) {
    return normalized as keyof typeof agentMap;
  }

  return "tutor" as const;
}

export async function routeAgent({ agentType, userMessage, context }: AgentRouterInput) {
  const selected = agentMap[normalizeAgentType(agentType)];
  return selected.runAgent({ userMessage, context });
}

export function getAgentName(agentType?: AgentType | string) {
  return agentMap[normalizeAgentType(agentType)].name;
}
