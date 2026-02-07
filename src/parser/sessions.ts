import * as fs from "fs";
import * as path from "path";
import type { TokenUsage, Session, Project } from "../types.js";
import { getProjectsDir } from "../utils/config.js";
import { emptyTokens, addTokens } from "../utils/tokens.js";
import {
  readSessionsIndex,
  getMainSessions,
  type SessionIndexEntry,
} from "./index-reader.js";

interface ParsedLine {
  type?: string;
  subtype?: string;
  summary?: string;
  durationMs?: number;
  message?: {
    role?: string;
    model?: string;
    content?:
      | string
      | Array<{
          type?: string;
          name?: string;
          text?: string;
          content?: string;
        }>;
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
  sessionId?: string;
}

interface SessionTokenData {
  tokens: TokenUsage;
  durationMs: number;
  model: string | null;
  toolUsage: Record<string, number>;
  cwd: string | null;
}

/**
 * Parse a session file for token data and tool usage only.
 * Used when we already have metadata from sessions-index.json.
 */
function parseSessionTokens(filePath: string): SessionTokenData | null {
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

    // Calculate duration from timestamps
    const timestamps = lines
      .filter((l) => l.timestamp)
      .map((l) => new Date(l.timestamp!).getTime())
      .filter((t) => !isNaN(t));

    const durationMs =
      timestamps.length >= 2
        ? Math.max(...timestamps) - Math.min(...timestamps)
        : 0;

    // Get model from first assistant message
    const firstAssistantMsg = lines.find((l) => l.message?.role === "assistant");
    const model = firstAssistantMsg?.message?.model || null;

    // Get cwd from first user message
    const firstUserMsg = lines.find((l) => l.message?.role === "user");
    const cwd = firstUserMsg?.cwd || null;

    // Aggregate token counts from assistant messages
    const tokens = emptyTokens();
    const toolUsage: Record<string, number> = {};

    for (const line of lines) {
      const usage = line.message?.usage || line.usage;
      if (line.message?.role === "assistant" && usage) {
        tokens.inputTokens += usage.input_tokens || 0;
        tokens.outputTokens += usage.output_tokens || 0;
        tokens.cacheReadTokens += usage.cache_read_input_tokens || 0;
        tokens.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      }

      // Count tool usage from assistant message content
      if (
        line.message?.role === "assistant" &&
        Array.isArray(line.message.content)
      ) {
        for (const block of line.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolUsage[block.name] = (toolUsage[block.name] || 0) + 1;
          }
        }
      }
    }

    return { tokens, durationMs, model, toolUsage, cwd };
  } catch {
    return null;
  }
}

/**
 * Get parent session ID from an agent file.
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

/**
 * Extract readable text from Claude message content blocks.
 */
function getMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }

    if (!block || typeof block !== "object") {
      continue;
    }

    const value = block as { text?: unknown; content?: unknown };
    if (typeof value.text === "string") {
      parts.push(value.text);
      continue;
    }

    if (typeof value.content === "string") {
      parts.push(value.content);
    }
  }

  return parts.join("\n");
}

function extractCommandName(text: string): string | null {
  if (!text) return null;

  const tagged = text.match(/<command-name>\s*([^<\n]+)\s*<\/command-name>/i);
  if (tagged?.[1]) {
    return tagged[1].trim();
  }

  return null;
}

function isAgentTeamCommand(commandName: string): boolean {
  const normalized = commandName.toLowerCase();
  return (
    normalized.includes("team") ||
    normalized.includes("feature-dev") ||
    normalized.includes("agent-dev")
  );
}

function deriveCommandTitle(commandName: string): string {
  if (isAgentTeamCommand(commandName)) {
    return `Agent Team Session (${commandName})`;
  }

  return `Command Session (${commandName})`;
}

function deriveTitleFromTranscript(lines: ParsedLine[]): string | null {
  for (const line of lines) {
    if (line.message?.role !== "user") continue;

    const commandName = extractCommandName(getMessageText(line.message.content));
    if (commandName) {
      return deriveCommandTitle(commandName);
    }
  }

  const sampledUserText = lines
    .filter((line) => line.message?.role === "user")
    .slice(0, 8)
    .map((line) => getMessageText(line.message?.content))
    .join("\n");

  if (
    sampledUserText.includes("<teammate-message") ||
    sampledUserText.includes("TeamCreate") ||
    sampledUserText.includes("TaskCreate")
  ) {
    return "Agent Team Session";
  }

  return null;
}

function getIndexEntryTitle(entry: SessionIndexEntry): string {
  const summary = entry.summary?.trim();
  if (summary) {
    return summary;
  }

  const customTitle = entry.customTitle?.trim();
  if (customTitle) {
    return customTitle;
  }

  const commandName = extractCommandName(entry.firstPrompt ?? "");
  if (commandName) {
    return deriveCommandTitle(commandName);
  }

  return "(no title)";
}

interface AggregatedSession {
  id: string;
  title: string;
  timestamp: string;
  durationMs: number;
  gitBranch: string | null;
  model: string | null;
  tokens: TokenUsage;
  toolUsage: Record<string, number>;
  messageCount: number;
  cwd: string | null;
  subagentTokens: TokenUsage;
  subagentDurationMs: number;
  subagentCount: number;
}

/**
 * Parse all projects using sessions-index.json as the primary metadata source.
 */
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
    if (projectDir.startsWith(".")) continue;

    const project = parseProjectWithIndex(projectDirPath);
    if (project) {
      projects.push(project);
    }
  }

  // Sort projects by total duration (most active first)
  projects.sort((a, b) => b.totalDurationMs - a.totalDurationMs);

  return projects;
}

function parseProjectWithIndex(projectDirPath: string): Project | null {
  const index = readSessionsIndex(projectDirPath);

  if (index) {
    return parseProjectFromIndex(projectDirPath, index);
  }

  // Fallback to legacy parsing if no index exists
  return parseProjectLegacy(projectDirPath);
}

function parseProjectFromIndex(
  projectDirPath: string,
  index: ReturnType<typeof readSessionsIndex>
): Project | null {
  if (!index) return null;

  const mainSessions = getMainSessions(index);
  if (mainSessions.length === 0) return null;

  // Build a map of sidechain sessions by their session ID
  const sidechainMap = new Map<string, SessionIndexEntry[]>();
  for (const entry of index.entries) {
    if (entry.isSidechain) {
      // Group sidechains - we'll match them to parents below
      // For now, just track them
      sidechainMap.set(entry.sessionId, [entry]);
    }
  }

  // Find agent files at the top level that reference parent sessions
  const items = fs.readdirSync(projectDirPath);
  const agentFiles = items.filter(
    (item) =>
      item.startsWith("agent-") &&
      item.endsWith(".jsonl") &&
      fs.statSync(path.join(projectDirPath, item)).isFile()
  );

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

  const aggregatedSessions: AggregatedSession[] = [];

  for (const entry of mainSessions) {
    // Parse token data from the JSONL file
    const tokenData = parseSessionTokens(entry.fullPath);
    if (!tokenData) continue;

    // Aggregate subagent data
    let subagentTokens = emptyTokens();
    let subagentDurationMs = 0;
    let subagentCount = 0;

    // Check subagents directory
    const sessionDir = entry.fullPath.replace(".jsonl", "");
    const subagentsDir = path.join(sessionDir, "subagents");

    if (fs.existsSync(subagentsDir) && fs.statSync(subagentsDir).isDirectory()) {
      const subData = aggregateSubagents(subagentsDir);
      subagentTokens = addTokens(subagentTokens, subData.tokens);
      subagentDurationMs += subData.durationMs;
      subagentCount += subData.count;

      // Merge tool usage
      for (const [tool, count] of Object.entries(subData.toolUsage)) {
        tokenData.toolUsage[tool] = (tokenData.toolUsage[tool] || 0) + count;
      }
    }

    // Check orphaned agent files
    const orphanedAgents = agentsByParent.get(entry.sessionId) || [];
    for (const agentPath of orphanedAgents) {
      const agentData = parseSessionTokens(agentPath);
      if (agentData) {
        subagentTokens = addTokens(subagentTokens, agentData.tokens);
        subagentDurationMs += agentData.durationMs;
        subagentCount++;

        for (const [tool, count] of Object.entries(agentData.toolUsage)) {
          tokenData.toolUsage[tool] = (tokenData.toolUsage[tool] || 0) + count;
        }
      }
    }

    aggregatedSessions.push({
      id: entry.sessionId,
      title: getIndexEntryTitle(entry),
      timestamp: entry.created,
      durationMs: tokenData.durationMs,
      gitBranch: entry.gitBranch || null,
      model: tokenData.model,
      tokens: tokenData.tokens,
      toolUsage: tokenData.toolUsage,
      messageCount: entry.messageCount,
      cwd: tokenData.cwd,
      subagentTokens,
      subagentDurationMs,
      subagentCount,
    });
  }

  // If sessions-index.json is stale, pick up any new top-level sessions
  // that are not in the index (Claude Code stopped updating the index
  // in some recent builds).
  const indexedSessionIds = new Set(mainSessions.map((entry) => entry.sessionId));
  const sessionFiles = items.filter(
    (item) =>
      !item.startsWith("agent-") &&
      item.endsWith(".jsonl") &&
      fs.statSync(path.join(projectDirPath, item)).isFile()
  );

  for (const sessionFile of sessionFiles) {
    const sessionId = path.basename(sessionFile, ".jsonl");
    if (indexedSessionIds.has(sessionId)) continue;
    const sessionPath = path.join(projectDirPath, sessionFile);
    const extra = parseMissingSession(sessionPath, sessionId, agentsByParent);
    if (extra) {
      aggregatedSessions.push(extra);
    }
  }

  if (aggregatedSessions.length === 0) return null;

  // Sort by timestamp to find most recent
  aggregatedSessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Get project path from most recent session's cwd or index entry
  const projectPath =
    aggregatedSessions.find((s) => s.cwd)?.cwd ||
    mainSessions[0].projectPath ||
    path.basename(projectDirPath);

  // Skip worktree directories
  if (projectPath.includes("/worktrees/") || projectPath.includes("/.claude/")) {
    return null;
  }

  const projectName = path.basename(projectPath);
  const sessions: Session[] = aggregatedSessions.map((s) => ({
    id: s.id,
    title: s.title,
    timestamp: s.timestamp,
    durationMs: s.durationMs,
    totalDurationMs: s.durationMs + s.subagentDurationMs,
    gitBranch: s.gitBranch,
    model: s.model,
    tokens: s.tokens,
    totalTokens: addTokens(s.tokens, s.subagentTokens),
    subagentCount: s.subagentCount,
    toolUsage: Object.keys(s.toolUsage).length > 0 ? s.toolUsage : undefined,
    messageCount: s.messageCount,
  }));

  // Calculate project totals
  let totalDurationMs = 0;
  let totalTokens = emptyTokens();
  let totalSessions = 0;

  for (const session of sessions) {
    totalDurationMs += session.totalDurationMs;
    totalTokens = addTokens(totalTokens, session.totalTokens);
    totalSessions += 1 + session.subagentCount;
  }

  return {
    projectName,
    projectPath,
    totalSessions,
    totalDurationMs,
    totalTokens,
    sessions,
  };
}

function parseMissingSession(
  sessionPath: string,
  sessionId: string,
  agentsByParent: Map<string, string[]>
): AggregatedSession | null {
  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
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

    const summaryLine = lines.find((l) => l.type === "summary");
    const summaryTitle = summaryLine?.summary?.trim();
    const title =
      summaryTitle || deriveTitleFromTranscript(lines) || "(no title)";

    const timestamps = lines
      .filter((l) => l.timestamp)
      .map((l) => new Date(l.timestamp!).getTime())
      .filter((t) => !isNaN(t));

    const durationMs =
      timestamps.length >= 2
        ? Math.max(...timestamps) - Math.min(...timestamps)
        : 0;

    const firstUserMsg = lines.find(
      (l) => l.message?.role === "user" && l.timestamp
    );
    const rawTimestamp = firstUserMsg?.timestamp || "";
    const fileMtime = fs.statSync(sessionPath).mtime.toISOString();
    const timestamp =
      rawTimestamp && !Number.isNaN(Date.parse(rawTimestamp))
        ? rawTimestamp
        : fileMtime;
    const gitBranch = firstUserMsg?.gitBranch || null;

    const firstAssistantMsg = lines.find((l) => l.message?.role === "assistant");
    const model = firstAssistantMsg?.message?.model || null;
    const cwd = firstUserMsg?.cwd || null;

    const tokens = emptyTokens();
    const toolUsage: Record<string, number> = {};
    let messageCount = 0;

    for (const line of lines) {
      if (line.message) messageCount += 1;
      const usage = line.message?.usage || line.usage;
      if (line.message?.role === "assistant" && usage) {
        tokens.inputTokens += usage.input_tokens || 0;
        tokens.outputTokens += usage.output_tokens || 0;
        tokens.cacheReadTokens += usage.cache_read_input_tokens || 0;
        tokens.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      }

      if (
        line.message?.role === "assistant" &&
        Array.isArray(line.message.content)
      ) {
        for (const block of line.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolUsage[block.name] = (toolUsage[block.name] || 0) + 1;
          }
        }
      }
    }

    // Aggregate subagents
    let subagentTokens = emptyTokens();
    let subagentDurationMs = 0;
    let subagentCount = 0;

    const sessionDir = sessionPath.replace(".jsonl", "");
    const subagentsDir = path.join(sessionDir, "subagents");

    if (fs.existsSync(subagentsDir) && fs.statSync(subagentsDir).isDirectory()) {
      const subData = aggregateSubagents(subagentsDir);
      subagentTokens = addTokens(subagentTokens, subData.tokens);
      subagentDurationMs += subData.durationMs;
      subagentCount += subData.count;

      for (const [tool, count] of Object.entries(subData.toolUsage)) {
        toolUsage[tool] = (toolUsage[tool] || 0) + count;
      }
    }

    const orphanedAgents = agentsByParent.get(sessionId) || [];
    for (const agentPath of orphanedAgents) {
      const agentData = parseSessionTokens(agentPath);
      if (agentData) {
        subagentTokens = addTokens(subagentTokens, agentData.tokens);
        subagentDurationMs += agentData.durationMs;
        subagentCount++;

        for (const [tool, count] of Object.entries(agentData.toolUsage)) {
          toolUsage[tool] = (toolUsage[tool] || 0) + count;
        }
      }
    }

    return {
      id: sessionId,
      title,
      timestamp,
      durationMs,
      gitBranch,
      model,
      tokens,
      toolUsage,
      messageCount,
      cwd,
      subagentTokens,
      subagentDurationMs,
      subagentCount,
    };
  } catch {
    return null;
  }
}

function aggregateSubagents(subagentsDir: string): {
  tokens: TokenUsage;
  durationMs: number;
  count: number;
  toolUsage: Record<string, number>;
} {
  let tokens = emptyTokens();
  let durationMs = 0;
  let count = 0;
  const toolUsage: Record<string, number> = {};

  const subagentFiles = fs
    .readdirSync(subagentsDir)
    .filter((f) => f.endsWith(".jsonl"));

  for (const subFile of subagentFiles) {
    const subPath = path.join(subagentsDir, subFile);
    const subData = parseSessionTokens(subPath);
    if (subData) {
      tokens = addTokens(tokens, subData.tokens);
      durationMs += subData.durationMs;
      count++;

      for (const [tool, cnt] of Object.entries(subData.toolUsage)) {
        toolUsage[tool] = (toolUsage[tool] || 0) + cnt;
      }

      // Recursively check nested subagents
      const nestedDir = subPath.replace(".jsonl", "");
      const nestedSubagentsDir = path.join(nestedDir, "subagents");
      if (
        fs.existsSync(nestedSubagentsDir) &&
        fs.statSync(nestedSubagentsDir).isDirectory()
      ) {
        const nested = aggregateSubagents(nestedSubagentsDir);
        tokens = addTokens(tokens, nested.tokens);
        durationMs += nested.durationMs;
        count += nested.count;

        for (const [tool, cnt] of Object.entries(nested.toolUsage)) {
          toolUsage[tool] = (toolUsage[tool] || 0) + cnt;
        }
      }
    }
  }

  return { tokens, durationMs, count, toolUsage };
}

/**
 * Legacy parsing for projects without sessions-index.json.
 */
function parseProjectLegacy(projectDirPath: string): Project | null {
  const items = fs.readdirSync(projectDirPath);

  const agentFiles = items.filter(
    (item) =>
      item.startsWith("agent-") &&
      item.endsWith(".jsonl") &&
      fs.statSync(path.join(projectDirPath, item)).isFile()
  );

  const sessionFiles = items.filter(
    (item) =>
      !item.startsWith("agent-") &&
      item.endsWith(".jsonl") &&
      fs.statSync(path.join(projectDirPath, item)).isFile()
  );

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

  const sessions: Session[] = [];

  for (const sessionFile of sessionFiles) {
    const sessionPath = path.join(projectDirPath, sessionFile);
    const sessionId = path.basename(sessionFile, ".jsonl");
    const session = parseSessionLegacy(sessionPath, sessionId, agentsByParent);
    if (session) {
      sessions.push(session);
    }
  }

  if (sessions.length === 0) return null;

  sessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Try to get project path from cwd
  let projectPath = path.basename(projectDirPath);
  for (const sessionFile of sessionFiles) {
    const sessionPath = path.join(projectDirPath, sessionFile);
    const tokenData = parseSessionTokens(sessionPath);
    if (tokenData?.cwd) {
      projectPath = tokenData.cwd;
      break;
    }
  }

  if (projectPath.includes("/worktrees/") || projectPath.includes("/.claude/")) {
    return null;
  }

  const projectName = path.basename(projectPath);

  let totalDurationMs = 0;
  let totalTokens = emptyTokens();
  let totalSessions = 0;

  for (const session of sessions) {
    totalDurationMs += session.totalDurationMs;
    totalTokens = addTokens(totalTokens, session.totalTokens);
    totalSessions += 1 + session.subagentCount;
  }

  return {
    projectName,
    projectPath,
    totalSessions,
    totalDurationMs,
    totalTokens,
    sessions,
  };
}

function parseSessionLegacy(
  sessionPath: string,
  sessionId: string,
  agentsByParent: Map<string, string[]>
): Session | null {
  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
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
    const summaryTitle = summaryLine?.summary?.trim();
    const title = summaryTitle || deriveTitleFromTranscript(lines) || null;

    // Extract timestamps
    const timestamps = lines
      .filter((l) => l.timestamp)
      .map((l) => new Date(l.timestamp!).getTime())
      .filter((t) => !isNaN(t));

    const durationMs =
      timestamps.length >= 2
        ? Math.max(...timestamps) - Math.min(...timestamps)
        : 0;

    const firstUserMsg = lines.find(
      (l) => l.message?.role === "user" && l.timestamp
    );
    const rawTimestamp = firstUserMsg?.timestamp || "";
    const fileMtime = fs.statSync(sessionPath).mtime.toISOString();
    const timestamp =
      rawTimestamp && !Number.isNaN(Date.parse(rawTimestamp))
        ? rawTimestamp
        : fileMtime;
    const gitBranch = firstUserMsg?.gitBranch || null;

    const firstAssistantMsg = lines.find((l) => l.message?.role === "assistant");
    const model = firstAssistantMsg?.message?.model || null;

    const tokens = emptyTokens();
    const toolUsage: Record<string, number> = {};

    for (const line of lines) {
      const usage = line.message?.usage || line.usage;
      if (line.message?.role === "assistant" && usage) {
        tokens.inputTokens += usage.input_tokens || 0;
        tokens.outputTokens += usage.output_tokens || 0;
        tokens.cacheReadTokens += usage.cache_read_input_tokens || 0;
        tokens.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      }

      if (
        line.message?.role === "assistant" &&
        Array.isArray(line.message.content)
      ) {
        for (const block of line.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolUsage[block.name] = (toolUsage[block.name] || 0) + 1;
          }
        }
      }
    }

    // Aggregate subagents
    let subagentTokens = emptyTokens();
    let subagentDurationMs = 0;
    let subagentCount = 0;

    const sessionDir = sessionPath.replace(".jsonl", "");
    const subagentsDir = path.join(sessionDir, "subagents");

    if (fs.existsSync(subagentsDir) && fs.statSync(subagentsDir).isDirectory()) {
      const subData = aggregateSubagents(subagentsDir);
      subagentTokens = addTokens(subagentTokens, subData.tokens);
      subagentDurationMs += subData.durationMs;
      subagentCount += subData.count;

      for (const [tool, count] of Object.entries(subData.toolUsage)) {
        toolUsage[tool] = (toolUsage[tool] || 0) + count;
      }
    }

    const orphanedAgents = agentsByParent.get(sessionId) || [];
    for (const agentPath of orphanedAgents) {
      const agentData = parseSessionTokens(agentPath);
      if (agentData) {
        subagentTokens = addTokens(subagentTokens, agentData.tokens);
        subagentDurationMs += agentData.durationMs;
        subagentCount++;

        for (const [tool, count] of Object.entries(agentData.toolUsage)) {
          toolUsage[tool] = (toolUsage[tool] || 0) + count;
        }
      }
    }

    return {
      id: sessionId,
      title,
      timestamp,
      durationMs,
      totalDurationMs: durationMs + subagentDurationMs,
      gitBranch,
      model,
      tokens,
      totalTokens: addTokens(tokens, subagentTokens),
      subagentCount,
      toolUsage: Object.keys(toolUsage).length > 0 ? toolUsage : undefined,
    };
  } catch {
    return null;
  }
}

export { getTotalTokenCount } from "../utils/tokens.js";
