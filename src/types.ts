export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface Session {
  id: string;
  title: string | null;
  timestamp: string;
  durationMs: number;
  totalDurationMs: number;
  gitBranch: string | null;
  model: string | null;
  tokens: TokenUsage;
  totalTokens: TokenUsage;
  subagentCount: number;
}

export interface Project {
  projectName: string;
  projectPath: string;
  totalSessions: number;
  totalDurationMs: number;
  totalTokens: TokenUsage;
  sessions: Session[];
}

export interface Summary {
  totalSessions: number;
  totalDurationMs: number;
  totalTokens: number;
  projectCount: number;
}

export interface ActivityDay {
  sessions: number;
  durationMs: number;
}

export interface OutputData {
  generatedAt: string;
  username: string;
  summary: Summary;
  projects: Project[];
  activity: Record<string, ActivityDay>;
}

export interface Config {
  username: string;
  repoPath: string;
  createdAt: string;
}
