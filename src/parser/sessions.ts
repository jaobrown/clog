import * as fs from "fs";
import * as path from "path";
import type { TokenUsage, Session, Project } from "../types.js";
import { getProjectsDir } from "../utils/config.js";
import { emptyTokens, addTokens } from "../utils/tokens.js";

interface ParsedLine {
  type?: string;
  subtype?: string;
  summary?: string;
  durationMs?: number;
  message?: {
    role?: string;
    model?: string;
    content?: Array<{ type?: string; name?: string }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  toolUseResult?: unknown;
  timestamp?: string;
  gitBranch?: string;
  cwd?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

interface RawSession {
  id: string;
  title: string | null;
  timestamp: string;
  durationMs: number;
  gitBranch: string | null;
  model: string | null;
  tokens: TokenUsage;
  cwd: string | null;
  subagents: RawSession[];
}

function parseSessionFile(filePath: string): Omit<RawSession, "subagents"> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as ParsedLine;
        } catch {
          return null;
        }
      })
      .filter((l): l is ParsedLine => l !== null);

    if (lines.length === 0) return null;

    // Extract summary/title
    const summaryLine = lines.find((l) => l.type === "summary");
    const title = summaryLine?.summary || null;

    // Extract duration (sum all turn_duration entries)
    const durationMs = lines
      .filter((l) => l.subtype === "turn_duration")
      .reduce((sum, l) => sum + (l.durationMs || 0), 0);

    // Get metadata from first user message
    const firstUserMsg = lines.find(
      (l) => l.message?.role === "user" && l.timestamp
    );
    const rawTimestamp = firstUserMsg?.timestamp || "";
    const fileMtime = fs.statSync(filePath).mtime.toISOString();
    const timestamp =
      rawTimestamp && !Number.isNaN(Date.parse(rawTimestamp))
        ? rawTimestamp
        : fileMtime;
    const gitBranch = firstUserMsg?.gitBranch || null;
    const cwd = firstUserMsg?.cwd || null;

    // Get model from first assistant message
    const firstAssistantMsg = lines.find((l) => l.message?.role === "assistant");
    const model = firstAssistantMsg?.message?.model || null;

    // Aggregate token counts from assistant messages
    const tokens = emptyTokens();
    for (const line of lines) {
      const usage = line.message?.usage || line.usage;
      if (line.message?.role === "assistant" && usage) {
        tokens.inputTokens += usage.input_tokens || 0;
        tokens.outputTokens += usage.output_tokens || 0;
        tokens.cacheReadTokens += usage.cache_read_input_tokens || 0;
        tokens.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      }
    }

    return {
      id: path.basename(filePath, ".jsonl"),
      title,
      timestamp,
      durationMs,
      gitBranch,
      model,
      tokens,
      cwd,
    };
  } catch {
    return null;
  }
}

/**
 * Extract parent session ID from an agent file by reading its sessionId field.
 * Agent files store their parent's session ID in the first line.
 */
function getParentSessionId(agentFilePath: string): string | null {
  try {
    const content = fs.readFileSync(agentFilePath, "utf-8");
    const firstLine = content.split("\n")[0];
    if (!firstLine) return null;
    const parsed = JSON.parse(firstLine);
    return parsed.sessionId || null;
  } catch {
    return null;
  }
}

function parseSessionWithSubagents(
  sessionFile: string,
  sessionDir?: string,
  additionalAgentPaths?: string[]
): RawSession | null {
  const baseSession = parseSessionFile(sessionFile);
  if (!baseSession) return null;

  const subagents: RawSession[] = [];

  // Check for subagents directory
  // Session dir is the directory with same name as session file (without .jsonl)
  const subagentsDir = sessionDir
    ? path.join(sessionDir, "subagents")
    : path.join(sessionFile.replace(".jsonl", ""), "subagents");

  if (fs.existsSync(subagentsDir) && fs.statSync(subagentsDir).isDirectory()) {
    const subagentFiles = fs
      .readdirSync(subagentsDir)
      .filter((f) => f.endsWith(".jsonl"));

    for (const subFile of subagentFiles) {
      const subPath = path.join(subagentsDir, subFile);
      const subSession = parseSessionWithSubagents(subPath);
      if (subSession) {
        subagents.push(subSession);
      }
    }
  }

  // Parse additional orphaned agent files (top-level agents referencing this session)
  if (additionalAgentPaths) {
    for (const agentPath of additionalAgentPaths) {
      const subSession = parseSessionWithSubagents(agentPath);
      if (subSession) {
        subagents.push(subSession);
      }
    }
  }

  return {
    ...baseSession,
    subagents,
  };
}

function countSubagents(session: RawSession): number {
  return session.subagents.reduce(
    (sum, sub) => sum + 1 + countSubagents(sub),
    0
  );
}

function calculateTotals(session: RawSession): {
  totalDurationMs: number;
  totalTokens: TokenUsage;
} {
  let totalDurationMs = session.durationMs;
  let totalTokens = { ...session.tokens };

  for (const sub of session.subagents) {
    const subTotals = calculateTotals(sub);
    totalDurationMs += subTotals.totalDurationMs;
    totalTokens = addTokens(totalTokens, subTotals.totalTokens);
  }

  return { totalDurationMs, totalTokens };
}

function rawToSession(raw: RawSession): Session {
  const { totalDurationMs, totalTokens } = calculateTotals(raw);
  return {
    id: raw.id,
    title: raw.title,
    timestamp: raw.timestamp,
    durationMs: raw.durationMs,
    totalDurationMs,
    gitBranch: raw.gitBranch,
    model: raw.model,
    tokens: raw.tokens,
    totalTokens,
    subagentCount: countSubagents(raw),
  };
}

export function parseAllProjects(): Project[] {
  const projectsDir = getProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const projects: Project[] = [];
  const projectDirs = fs.readdirSync(projectsDir);

  for (const projectDir of projectDirs) {
    const projectDirPath = path.join(projectsDir, projectDir);
    if (!fs.statSync(projectDirPath).isDirectory()) continue;

    // Skip hidden directories
    if (projectDir.startsWith(".")) continue;

    // Find top-level session files and separate agent files from regular sessions
    const items = fs.readdirSync(projectDirPath);

    // Agent files are orphaned sub-agents stored at top level (agent-*.jsonl)
    const agentFiles = items.filter(
      (item) =>
        item.startsWith("agent-") &&
        item.endsWith(".jsonl") &&
        fs.statSync(path.join(projectDirPath, item)).isFile()
    );

    // Regular session files (not agent files)
    const sessionFiles = items.filter(
      (item) =>
        !item.startsWith("agent-") &&
        item.endsWith(".jsonl") &&
        fs.statSync(path.join(projectDirPath, item)).isFile()
    );

    // Group agent files by their parent session ID
    const agentsByParent = new Map<string, string[]>();
    for (const agentFile of agentFiles) {
      const agentPath = path.join(projectDirPath, agentFile);
      const parentId = getParentSessionId(agentPath);
      if (parentId) {
        const existing = agentsByParent.get(parentId) || [];
        existing.push(agentPath);
        agentsByParent.set(parentId, existing);
      }
    }

    const rawSessions: RawSession[] = [];

    for (const sessionFile of sessionFiles) {
      const sessionPath = path.join(projectDirPath, sessionFile);
      const sessionId = path.basename(sessionFile, ".jsonl");
      const orphanedAgents = agentsByParent.get(sessionId) || [];
      const rawSession = parseSessionWithSubagents(sessionPath, undefined, orphanedAgents);
      if (rawSession) {
        rawSessions.push(rawSession);
      }
    }

    if (rawSessions.length === 0) continue;

    // Get project path from session cwd (more reliable than decoding directory name)
    // Use the most recent session's cwd as the canonical project path
    rawSessions.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const projectPath = rawSessions.find((s) => s.cwd)?.cwd || projectDir;

    // Skip worktree directories
    if (projectPath.includes("/worktrees/") || projectPath.includes("/.claude/")) continue;

    const projectName = path.basename(projectPath);
    const sessions = rawSessions.map(rawToSession);

    // Calculate project totals
    let totalDurationMs = 0;
    let totalTokens = emptyTokens();
    let totalSessions = 0;

    for (const session of sessions) {
      totalDurationMs += session.totalDurationMs;
      totalTokens = addTokens(totalTokens, session.totalTokens);
      totalSessions += 1 + session.subagentCount;
    }

    projects.push({
      projectName,
      projectPath,
      totalSessions,
      totalDurationMs,
      totalTokens,
      sessions,
    });
  }

  // Sort projects by total duration (most active first)
  projects.sort((a, b) => b.totalDurationMs - a.totalDurationMs);

  return projects;
}

// Re-export for backwards compatibility
export { getTotalTokenCount } from "../utils/tokens.js";
