import type {
  OutputData,
  Summary,
  ActivityDay,
  PublicOutputData,
  PublicProject,
  TokenUsage,
} from "../types.js";
import { parseAllProjects, getTotalTokenCount } from "../parser/sessions.js";
import { formatDate } from "../utils/format.js";
import { applyRedactions } from "../utils/redaction.js";
import { addTokens, emptyTokens } from "../utils/tokens.js";
import {
  readStatsCache,
  getModelBreakdown,
  getPeakHours,
  getCurrentStreak,
} from "../parser/stats-cache.js";

export function generateOutputData(
  username: string,
  redactedProjects: string[] = []
): OutputData {
  const projects = applyRedactions(parseAllProjects(), redactedProjects);

  // Calculate summary
  let totalSessions = 0;
  let totalDurationMs = 0;
  let totalTokens = 0;

  for (const project of projects) {
    totalSessions += project.totalSessions;
    totalDurationMs += project.totalDurationMs;
    totalTokens += getTotalTokenCount(project.totalTokens);
  }

  const summary: Summary = {
    totalSessions,
    totalDurationMs,
    totalTokens,
    projectCount: projects.length,
  };

  // Build activity map (by date)
  const activity: Record<string, ActivityDay> = {};

  for (const project of projects) {
    for (const session of project.sessions) {
      const dateKey = formatDate(session.timestamp);
      if (!activity[dateKey]) {
        activity[dateKey] = { sessions: 0, durationMs: 0 };
      }
      activity[dateKey].sessions += 1 + session.subagentCount;
      activity[dateKey].durationMs += session.totalDurationMs;
    }
  }

  // Read stats cache for additional data
  const statsCache = readStatsCache();

  const outputData: OutputData = {
    generatedAt: new Date().toISOString(),
    username,
    summary,
    projects,
    activity,
  };

  if (statsCache) {
    outputData.modelBreakdown = getModelBreakdown(statsCache);
    outputData.peakHours = getPeakHours(statsCache);
    outputData.currentStreak = getCurrentStreak(statsCache);
  }

  return outputData;
}

function getAggregatedToolUsage(data: OutputData): Record<string, number> | undefined {
  const toolUsage: Record<string, number> = {};

  for (const project of data.projects) {
    for (const session of project.sessions) {
      if (!session.toolUsage) continue;
      for (const [tool, count] of Object.entries(session.toolUsage)) {
        toolUsage[tool] = (toolUsage[tool] || 0) + count;
      }
    }
  }

  return Object.keys(toolUsage).length > 0 ? toolUsage : undefined;
}

function getAggregatedTokenUsage(data: OutputData): TokenUsage | undefined {
  let tokenUsage = emptyTokens();
  for (const project of data.projects) {
    tokenUsage = addTokens(tokenUsage, project.totalTokens);
  }

  const totalTokens = getTotalTokenCount(tokenUsage);
  return totalTokens > 0 ? tokenUsage : undefined;
}

export function toPublicOutputData(data: OutputData): PublicOutputData {
  const projects: PublicProject[] = data.projects.map((project) => ({
    projectName: project.projectName,
    totalSessions: project.totalSessions,
    totalDurationMs: project.totalDurationMs,
    sessions: project.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      timestamp: session.timestamp,
      totalDurationMs: session.totalDurationMs,
    })),
  }));

  return {
    generatedAt: data.generatedAt,
    username: data.username,
    summary: data.summary,
    projects,
    activity: data.activity,
    tokenUsage: getAggregatedTokenUsage(data),
    toolUsage: getAggregatedToolUsage(data),
    modelBreakdown: data.modelBreakdown,
  };
}
