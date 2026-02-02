import type { Summary, Session, Project } from "../types.js";
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

// Box drawing constants
const BOX_WIDTH = 58;

const BOX_ROUND = {
  topLeft: '╭', topRight: '╮',
  bottomLeft: '╰', bottomRight: '╯',
  horizontal: '─', vertical: '│',
  leftT: '├', rightT: '┤',
};

const BOX_SHARP = {
  topLeft: '┌', topRight: '┐',
  bottomLeft: '└', bottomRight: '┘',
  horizontal: '─', vertical: '│',
};

// Box drawing helpers
function boxTop(box: typeof BOX_ROUND | typeof BOX_SHARP, title?: string): string {
  if (title) {
    const titlePart = `${box.horizontal} ${title} `;
    const remaining = BOX_WIDTH - titlePart.length;
    return box.topLeft + titlePart + box.horizontal.repeat(remaining) + box.topRight;
  }
  return box.topLeft + box.horizontal.repeat(BOX_WIDTH) + box.topRight;
}

function boxBottom(box: typeof BOX_ROUND | typeof BOX_SHARP): string {
  return box.bottomLeft + box.horizontal.repeat(BOX_WIDTH) + box.bottomRight;
}

function boxLine(box: typeof BOX_ROUND | typeof BOX_SHARP, content: string): string {
  const padding = BOX_WIDTH - content.length;
  return box.vertical + content + ' '.repeat(Math.max(0, padding)) + box.vertical;
}

function boxDivider(box: typeof BOX_ROUND): string {
  return box.leftT + box.horizontal.repeat(BOX_WIDTH) + box.rightT;
}

function centerText(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

function renderBar(value: number, maxValue: number, width: number): string {
  if (maxValue === 0) return '░'.repeat(width);
  const filled = Math.round((value / maxValue) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function generateReadme(
  username: string,
  summary: Summary,
  recentSessions: RecentSession[],
  topProjects: ProjectStat[] = []
): string {
  const statsBlock = formatStatsBlock(summary);
  const projectsBlock = formatProjectsBlock(topProjects);
  const recentBlock = formatRecentBlock(recentSessions.slice(0, 5));

  return `# 📓 clog

> [@${username}](https://clog.sh/u/${username})'s claude code work log

<!-- CLOG_STATS_START -->
\`\`\`
${statsBlock}
\`\`\`
<!-- CLOG_STATS_END -->

<!-- CLOG_PROJECTS_START -->
\`\`\`
${projectsBlock}
\`\`\`
<!-- CLOG_PROJECTS_END -->

<!-- CLOG_RECENT_START -->
\`\`\`
${recentBlock}
\`\`\`
<!-- CLOG_RECENT_END -->

---

<sub>auto-synced with [clog](https://clog.sh) • [view full profile →](https://clog.sh/u/${username})</sub>
`;
}

function formatStatsBlock(summary: Summary): string {
  const sessions = summary.totalSessions.toString();
  const tokens = formatTokens(summary.totalTokens);
  const time = formatDurationCompact(summary.totalDurationMs);
  const projects = summary.projectCount.toString();

  const lines: string[] = [];
  lines.push(boxTop(BOX_ROUND));
  lines.push(boxLine(BOX_ROUND, centerText('Claude Code Stats', BOX_WIDTH)));
  lines.push(boxDivider(BOX_ROUND));
  lines.push(boxLine(BOX_ROUND, ''));

  // 2x2 grid layout
  const col1 = `   Sessions     ${sessions.padEnd(12)}`;
  const col2 = `Tokens      ${tokens.padEnd(12)}`;
  lines.push(boxLine(BOX_ROUND, col1 + col2));

  const col3 = `   Duration     ${time.padEnd(12)}`;
  const col4 = `Projects    ${projects.padEnd(12)}`;
  lines.push(boxLine(BOX_ROUND, col3 + col4));

  lines.push(boxLine(BOX_ROUND, ''));
  lines.push(boxBottom(BOX_ROUND));

  return lines.join('\n');
}

function formatProjectsBlock(topProjects: ProjectStat[]): string {
  const lines: string[] = [];
  lines.push(boxTop(BOX_SHARP, 'Top Projects'));
  lines.push(boxLine(BOX_SHARP, ''));

  if (topProjects.length === 0) {
    lines.push(boxLine(BOX_SHARP, '  No projects yet - run some claude code!'));
  } else {
    const maxDuration = Math.max(...topProjects.map(p => p.totalDurationMs));
    const BAR_WIDTH = 20;

    for (const project of topProjects) {
      const name = truncate(project.projectName, 12).padEnd(12);
      const bar = renderBar(project.totalDurationMs, maxDuration, BAR_WIDTH);
      const duration = formatDurationCompact(project.totalDurationMs).padStart(8);
      lines.push(boxLine(BOX_SHARP, `  ${name}  ${bar}  ${duration}`));
    }
  }

  lines.push(boxLine(BOX_SHARP, ''));
  lines.push(boxBottom(BOX_SHARP));

  return lines.join('\n');
}

function formatRecentBlock(sessions: RecentSession[]): string {
  const lines: string[] = [];
  lines.push(boxTop(BOX_SHARP, 'Recent Sessions'));
  lines.push(boxLine(BOX_SHARP, ''));

  if (sessions.length === 0) {
    lines.push(boxLine(BOX_SHARP, '  No sessions yet - run some claude code!'));
  } else {
    for (const s of sessions) {
      const date = s.timestamp.split("T")[0];
      const project = truncate(s.projectName, 8).padEnd(8);
      const title = truncate(s.title || "untitled", 22).padEnd(22);
      const tokens = formatTokens(s.totalTokens).padStart(5);
      const time = formatDurationCompact(s.totalDurationMs).padStart(6);
      lines.push(boxLine(BOX_SHARP, `  ${date}  ${project}  ${title}  ${tokens}  ${time}`));
    }
  }

  lines.push(boxLine(BOX_SHARP, ''));
  lines.push(boxBottom(BOX_SHARP));

  return lines.join('\n');
}

function formatTokens(n: number): string {
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
  return str.slice(0, maxLen - 1) + "…";
}

export function updateReadme(
  existingContent: string,
  username: string,
  summary: Summary,
  recentSessions: RecentSession[],
  topProjects: ProjectStat[] = []
): string {
  const statsBlock = `\`\`\`\n${formatStatsBlock(summary)}\n\`\`\``;
  const projectsBlock = `\`\`\`\n${formatProjectsBlock(topProjects)}\n\`\`\``;
  const recentBlock = `\`\`\`\n${formatRecentBlock(recentSessions.slice(0, 5))}\n\`\`\``;

  let content = existingContent;

  content = replaceBetweenMarkers(content, "CLOG_STATS_START", "CLOG_STATS_END", statsBlock);
  content = replaceBetweenMarkers(content, "CLOG_PROJECTS_START", "CLOG_PROJECTS_END", projectsBlock);
  content = replaceBetweenMarkers(content, "CLOG_RECENT_START", "CLOG_RECENT_END", recentBlock);

  return content;
}

function replaceBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startTag = `<!-- ${startMarker} -->`;
  const endTag = `<!-- ${endMarker} -->`;
  const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, "g");
  return content.replace(regex, `${startTag}\n${newContent}\n${endTag}`);
}

export function getRecentSessions(projects: Project[], limit: number = 5): RecentSession[] {
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

export function getTopProjects(projects: Project[], limit: number = 5): ProjectStat[] {
  const projectStats: ProjectStat[] = projects.map(project => {
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
