import type { Summary, Session, Project } from "../types.js";
import { getTotalTokenCount } from "../utils/tokens.js";

interface RecentSession {
  timestamp: string;
  projectName: string;
  title: string | null;
  totalTokens: number;
  totalDurationMs: number;
}

export function generateReadme(
  username: string,
  summary: Summary,
  recentSessions: RecentSession[]
): string {
  const statsBlock = formatStatsBlock(summary);
  const recentBlock = formatRecentBlock(recentSessions.slice(0, 5));

  return `# 📓 clog

> [@${username}](https://clog.dev/u/${username})'s claude code work log

<!-- CLOG_STATS_START -->
\`\`\`
${statsBlock}
\`\`\`
<!-- CLOG_STATS_END -->

<!-- CLOG_RECENT_START -->
\`\`\`
${recentBlock}
\`\`\`
<!-- CLOG_RECENT_END -->

---

<sub>auto-synced with [clog](https://clog.dev) • [view full profile →](https://clog.dev/u/${username})</sub>
`;
}

function formatStatsBlock(summary: Summary): string {
  const sessions = summary.totalSessions.toString();
  const tokens = formatTokens(summary.totalTokens);
  const time = formatDurationCompact(summary.totalDurationMs);

  return `SESSIONS          TOKENS            TIME
─────────────────────────────────────────
${sessions.padEnd(18)}${tokens.padEnd(18)}${time}
total             consumed          coded`;
}

function formatRecentBlock(sessions: RecentSession[]): string {
  if (sessions.length === 0) {
    return `// recent\n\nno sessions yet - run some claude code!`;
  }

  const lines = sessions.map((s) => {
    const date = s.timestamp.split("T")[0];
    const project = truncate(s.projectName, 10).padEnd(10);
    const title = truncate(s.title || "untitled", 40).padEnd(42);
    const tokens = formatTokens(s.totalTokens).padStart(5);
    const time = formatDurationCompact(s.totalDurationMs);
    return `${date} ${project} - ${title} ${tokens} │ ${time}`;
  });

  return `// recent\n\n${lines.join("\n")}`;
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
  recentSessions: RecentSession[]
): string {
  const statsBlock = `\`\`\`\n${formatStatsBlock(summary)}\n\`\`\``;
  const recentBlock = `\`\`\`\n${formatRecentBlock(recentSessions.slice(0, 5))}\n\`\`\``;

  let content = existingContent;

  content = replaceBetweenMarkers(
    content,
    "CLOG_STATS_START",
    "CLOG_STATS_END",
    statsBlock
  );

  content = replaceBetweenMarkers(
    content,
    "CLOG_RECENT_START",
    "CLOG_RECENT_END",
    recentBlock
  );

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
