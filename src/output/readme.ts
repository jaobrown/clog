import type { Summary, Project, ModelBreakdown } from "../types.js";
import { getTotalTokenCount } from "../utils/tokens.js";

interface RecentSession {
  timestamp: string;
  projectName: string;
  title: string | null;
  totalTokens: number;
  totalDurationMs: number;
}

export interface ProjectStat {
  projectName: string;
  totalDurationMs: number;
  totalTokens: number;
  sessionCount: number;
}

// Simple ASCII formatting
const LINE_WIDTH = 50;

function renderBar(value: number, maxValue: number, width: number): string {
  if (maxValue === 0) return "-".repeat(width);
  const filled = Math.round((value / maxValue) * width);
  return "#".repeat(filled) + "-".repeat(width - filled);
}

export function generateReadme(
  username: string,
  summary: Summary,
  recentSessions: RecentSession[],
  topProjects: ProjectStat[] = [],
  modelBreakdown?: Record<string, ModelBreakdown>,
  peakHours?: number[],
  currentStreak?: number
): string {
  const statsBlock = formatStatsBlock(summary, currentStreak);
  const projectsBlock = formatProjectsBlock(topProjects);
  const recentBlock = formatRecentBlock(recentSessions.slice(0, 5));
  const modelBlock = formatModelBlock(modelBreakdown);
  const activityBlock = formatActivityBlock(peakHours);

  let content = `# clog

> [@${username}](https://clog.sh/u/${username})'s claude code work log

\`\`\`
${statsBlock}
\`\`\`

\`\`\`
${projectsBlock}
\`\`\`

\`\`\`
${recentBlock}
\`\`\`
`;

  if (modelBlock) {
    content += `
\`\`\`
${modelBlock}
\`\`\`
`;
  }

  if (activityBlock) {
    content += `
\`\`\`
${activityBlock}
\`\`\`
`;
  }

  content += `
---

<sub>auto-synced with [clog](https://clog.sh) • [view full profile](https://clog.sh/u/${username})</sub>
`;

  return content;
}

function formatStatsBlock(summary: Summary, currentStreak?: number): string {
  const sessions = summary.totalSessions.toString();
  const tokens = formatTokens(summary.totalTokens);
  const time = formatDurationCompact(summary.totalDurationMs);
  const projects = summary.projectCount.toString();

  const lines: string[] = [];
  lines.push("CLAUDE CODE STATS");
  lines.push("=".repeat(LINE_WIDTH));
  lines.push("");
  lines.push(`  Sessions   ${sessions.padEnd(15)} Tokens     ${tokens}`);
  lines.push(`  Duration   ${time.padEnd(15)} Projects   ${projects}`);

  if (currentStreak !== undefined && currentStreak > 0) {
    lines.push(`  Streak     ${currentStreak} day${currentStreak !== 1 ? "s" : ""}`);
  }

  lines.push("");

  return lines.join("\n");
}

function formatProjectsBlock(topProjects: ProjectStat[]): string {
  const lines: string[] = [];
  lines.push("TOP PROJECTS");
  lines.push("=".repeat(LINE_WIDTH));
  lines.push("");

  if (topProjects.length === 0) {
    lines.push("  No projects yet - run some claude code!");
  } else {
    const maxDuration = Math.max(...topProjects.map((p) => p.totalDurationMs));
    const BAR_WIDTH = 20;

    for (const project of topProjects) {
      const name = truncate(project.projectName, 14).padEnd(14);
      const bar = renderBar(project.totalDurationMs, maxDuration, BAR_WIDTH);
      const duration = formatDurationCompact(project.totalDurationMs).padStart(9);
      lines.push(`  ${name} ${bar} ${duration}`);
    }
  }

  lines.push("");

  return lines.join("\n");
}

function formatRecentBlock(sessions: RecentSession[]): string {
  const lines: string[] = [];
  lines.push("RECENT SESSIONS");
  lines.push("=".repeat(LINE_WIDTH));
  lines.push("");

  if (sessions.length === 0) {
    lines.push("  No sessions yet - run some claude code!");
  } else {
    for (const s of sessions) {
      const date = s.timestamp.split("T")[0];
      const project = truncate(s.projectName, 10).padEnd(10);
      const title = truncate(s.title || "untitled", 24).padEnd(24);
      const tokens = formatTokens(s.totalTokens).padStart(6);
      const time = formatDurationCompact(s.totalDurationMs).padStart(8);
      lines.push(`  ${date}  ${project}  ${title}  ${tokens}  ${time}`);
    }
  }

  lines.push("");

  return lines.join("\n");
}

function formatModelBlock(
  modelBreakdown?: Record<string, ModelBreakdown>
): string | null {
  if (!modelBreakdown || Object.keys(modelBreakdown).length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("MODEL USAGE");
  lines.push("=".repeat(LINE_WIDTH));
  lines.push("");

  // Sort models by total tokens (input + output)
  const sorted = Object.entries(modelBreakdown).sort(
    (a, b) =>
      b[1].inputTokens + b[1].outputTokens - (a[1].inputTokens + a[1].outputTokens)
  );

  const maxTotal = Math.max(
    ...sorted.map(([, v]) => v.inputTokens + v.outputTokens)
  );
  const BAR_WIDTH = 20;

  for (const [model, usage] of sorted) {
    const name = truncate(model, 12).padEnd(12);
    const total = usage.inputTokens + usage.outputTokens;
    const bar = renderBar(total, maxTotal, BAR_WIDTH);
    const tokenStr = formatTokens(total).padStart(8);
    const cacheStr = usage.cacheTokens > 0 ? ` (${formatTokens(usage.cacheTokens)} cached)` : "";
    lines.push(`  ${name} ${bar} ${tokenStr}${cacheStr}`);
  }

  lines.push("");

  return lines.join("\n");
}

function formatActivityBlock(peakHours?: number[]): string | null {
  if (!peakHours || peakHours.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("PEAK HOURS");
  lines.push("=".repeat(LINE_WIDTH));
  lines.push("");

  const formatted = peakHours.map((h) => formatHour(h)).join(", ");
  lines.push(`  Most active: ${formatted}`);
  lines.push("");

  return lines.join("\n");
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatDurationCompact(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "...";
}

export function getRecentSessions(
  projects: Project[],
  limit: number = 5
): RecentSession[] {
  const allSessions: RecentSession[] = [];

  for (const project of projects) {
    for (const session of project.sessions) {
      const totalTokens = getTotalTokenCount(session.totalTokens);

      allSessions.push({
        timestamp: session.timestamp,
        projectName: project.projectName,
        title: session.title,
        totalTokens,
        totalDurationMs: session.totalDurationMs,
      });
    }
  }

  allSessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return allSessions.slice(0, limit);
}

export function getTopProjects(
  projects: Project[],
  limit: number = 5
): ProjectStat[] {
  const projectStats: ProjectStat[] = projects.map((project) => {
    let totalTokens = 0;
    let totalDurationMs = 0;

    for (const session of project.sessions) {
      totalTokens += getTotalTokenCount(session.totalTokens);
      totalDurationMs += session.totalDurationMs;
    }

    return {
      projectName: project.projectName,
      totalDurationMs,
      totalTokens,
      sessionCount: project.sessions.length,
    };
  });

  // Sort by duration descending
  projectStats.sort((a, b) => b.totalDurationMs - a.totalDurationMs);

  return projectStats.slice(0, limit);
}
