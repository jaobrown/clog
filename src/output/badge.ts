import chalk from "chalk";
import boxen from "boxen";
import { formatDuration, formatNumber } from "../utils/format.js";
import type { RankData } from "../utils/api.js";

const CLOG_ASCII = `
  ██████╗██╗      ██████╗  ██████╗
 ██╔════╝██║     ██╔═══██╗██╔════╝
 ██║     ██║     ██║   ██║██║  ███╗
 ██║     ██║     ██║   ██║██║   ██║
 ╚██████╗███████╗╚██████╔╝╚██████╔╝
  ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ `;

export interface BadgeOptions {
  username: string;
  rankData: RankData | null;
  localStats?: {
    totalSessions: number;
    totalDurationMs: number;
    currentStreak?: number;
  };
}

export function renderBadge(options: BadgeOptions): string {
  const { username, rankData, localStats } = options;
  const profileUrl = `https://clog.sh/u/${username}`;

  const header = chalk.cyan(CLOG_ASCII);

  const lines: string[] = [];

  lines.push(chalk.bold.white(`  @${username}`));
  lines.push("");

  if (rankData) {
    lines.push(
      `  ${chalk.yellow("★")} ${chalk.bold(`#${rankData.rank}`)} this week ${chalk.dim(`of ${rankData.totalParticipants}`)}`
    );
    lines.push("");
    lines.push(
      `  ${chalk.bold("Sessions")}   ${formatNumber(rankData.totalSessions)}`
    );
    lines.push(
      `  ${chalk.bold("Duration")}   ${formatDuration(rankData.totalDurationMs)}`
    );
    lines.push(
      `  ${chalk.bold("Streak")}     ${rankData.currentStreak} day${rankData.currentStreak !== 1 ? "s" : ""}`
    );
  } else if (localStats) {
    lines.push(chalk.dim("  Leaderboard rank will appear after next sync"));
    lines.push("");
    lines.push(
      `  ${chalk.bold("Sessions")}   ${formatNumber(localStats.totalSessions)}`
    );
    lines.push(
      `  ${chalk.bold("Duration")}   ${formatDuration(localStats.totalDurationMs)}`
    );
    if (localStats.currentStreak !== undefined) {
      lines.push(
        `  ${chalk.bold("Streak")}     ${localStats.currentStreak} day${localStats.currentStreak !== 1 ? "s" : ""}`
      );
    }
  } else {
    lines.push(
      chalk.dim("  Welcome! Your stats will appear after your first sync.")
    );
  }

  lines.push("");
  lines.push(`  ${chalk.cyan(profileUrl)}`);

  const card = boxen(lines.join("\n"), {
    padding: { top: 0, bottom: 0, left: 0, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "cyan",
  });

  return `${header}\n${card}`;
}
