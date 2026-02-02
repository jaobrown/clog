import type { Project, OutputData, Summary, ActivityDay } from "../types.js";
import { parseAllProjects, getTotalTokenCount } from "../parser/sessions.js";
import { formatDate } from "../utils/format.js";

export function generateOutputData(username: string): OutputData {
  const projects = parseAllProjects();

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

  return {
    generatedAt: new Date().toISOString(),
    username,
    summary,
    projects,
    activity,
  };
}
