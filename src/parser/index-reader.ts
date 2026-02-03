import * as fs from "fs";
import * as path from "path";

export interface SessionIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  summary: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

export interface SessionsIndex {
  version: number;
  entries: SessionIndexEntry[];
}

/**
 * Read sessions-index.json from a project directory.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function readSessionsIndex(projectDir: string): SessionsIndex | null {
  const indexPath = path.join(projectDir, "sessions-index.json");

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(indexPath, "utf-8");
    const parsed = JSON.parse(content) as SessionsIndex;

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Get non-sidechain sessions from an index.
 * These are the main user sessions, not sub-agents.
 */
export function getMainSessions(index: SessionsIndex): SessionIndexEntry[] {
  return index.entries.filter((entry) => !entry.isSidechain);
}

/**
 * Get sidechain (sub-agent) sessions from an index.
 */
export function getSidechainSessions(index: SessionsIndex): SessionIndexEntry[] {
  return index.entries.filter((entry) => entry.isSidechain);
}

/**
 * Build a map of session ID to index entry for quick lookup.
 */
export function buildSessionMap(
  index: SessionsIndex
): Map<string, SessionIndexEntry> {
  const map = new Map<string, SessionIndexEntry>();
  for (const entry of index.entries) {
    map.set(entry.sessionId, entry);
  }
  return map;
}
