import chalk from "chalk";
import boxen from "boxen";
import { parseAllProjects } from "../parser/sessions.js";
import { formatDuration, formatNumber, formatRelativeDate } from "../utils/format.js";
import { emptyTokens, addTokens, getTotalTokenCount } from "../utils/tokens.js";
import { readConfigWithDefaults } from "../utils/config.js";
import { applyRedactions } from "../utils/redaction.js";
import type { Project, Session } from "../types.js";

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T12:00:00Z"); // Use noon to avoid DST issues
  date.setUTCDate(date.getUTCDate() + days);
  return getDateKey(date);
}

function calculateStreak(projects: Project[]): number {
  // Get all session dates as a set
  const dates = new Set<string>();
  for (const project of projects) {
    for (const session of project.sessions) {
      dates.add(session.timestamp.slice(0, 10));
    }
  }

  if (dates.size === 0) return 0;

  const today = getDateKey(new Date());
  const yesterday = addDays(today, -1);

  // Check if streak starts from today or yesterday
  if (!dates.has(today) && !dates.has(yesterday)) {
    return 0;
  }

  // Start from today (or yesterday if no activity today) and count backwards
  let currentDate = dates.has(today) ? today : yesterday;
  let streak = 0;

  while (dates.has(currentDate)) {
    streak++;
    currentDate = addDays(currentDate, -1);
  }

  return streak;
}

function renderBar(value: number, maxValue: number, width: number): string {
  const filled = Math.round((value / maxValue) * width);
  return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
}

export async function runStats(): Promise<void> {
  const config = readConfigWithDefaults();
  const projects = applyRedactions(
    parseAllProjects(),
    config?.redactedProjects ?? []
  );

  if (projects.length === 0) {
    console.log(chalk.yellow("\nNo sessions found.\n"));
    console.log(chalk.dim("Claude Code sessions are stored in ~/.claude/projects/"));
    return;
  }

  // Calculate totals
  let totalSessions = 0;
  let totalDurationMs = 0;
  let totalTokens = emptyTokens();

  for (const project of projects) {
    totalSessions += project.totalSessions;
    totalDurationMs += project.totalDurationMs;
    totalTokens = addTokens(totalTokens, project.totalTokens);
  }

  const streak = calculateStreak(projects);

  // Summary box
  const summaryContent = [
    `${chalk.bold("Sessions")}     ${formatNumber(totalSessions)}`,
    `${chalk.bold("Duration")}     ${formatDuration(totalDurationMs)}`,
    `${chalk.bold("Tokens")}       ${formatNumber(getTotalTokenCount(totalTokens))}`,
    `${chalk.bold("Projects")}     ${projects.length}`,
    `${chalk.bold("Streak")}       ${streak} day${streak !== 1 ? "s" : ""}`,
  ].join("\n");

  console.log(
    boxen(summaryContent, {
      title: "Claude Code Stats",
      titleAlignment: "center",
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: "cyan",
    })
  );

  // Top projects bar chart
  console.log(chalk.bold("Top Projects\n"));

  const topProjects = projects.slice(0, 5);
  const maxDuration = Math.max(topProjects[0]?.totalDurationMs ?? 1, 1);
  const maxNameLength = Math.max(...topProjects.map((p) => p.projectName.length));

  for (const project of topProjects) {
    const name = project.projectName.padEnd(maxNameLength);
    const bar = renderBar(project.totalDurationMs, maxDuration, 20);
    const duration = formatDuration(project.totalDurationMs);
    console.log(`  ${chalk.bold(name)}  ${bar}  ${chalk.dim(duration)}`);
  }

  // Recent sessions
  console.log(chalk.bold("\n\nRecent Sessions\n"));

  const allSessions: Array<Session & { projectName: string }> = [];
  for (const project of projects) {
    for (const session of project.sessions) {
      allSessions.push({ ...session, projectName: project.projectName });
    }
  }

  allSessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const recentSessions = allSessions.slice(0, 8);

  for (const session of recentSessions) {
    const title = session.title || chalk.dim("(no title)");
    const truncatedTitle = title.length > 50 ? title.slice(0, 47) + "..." : title;
    const date = formatRelativeDate(session.timestamp);
    const duration = formatDuration(session.totalDurationMs);
    const subagents =
      session.subagentCount > 0
        ? chalk.dim(` +${session.subagentCount} agent${session.subagentCount > 1 ? "s" : ""}`)
        : "";

    console.log(`  ${chalk.cyan("•")} ${truncatedTitle}`);
    console.log(
      `    ${chalk.dim(session.projectName)} · ${chalk.dim(date)} · ${chalk.dim(duration)}${subagents}`
    );
  }

  console.log();
}
