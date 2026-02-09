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
  toolUsage?: Record<string, number>;
  messageCount?: number;
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

export interface ModelBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
}

export interface OutputData {
  generatedAt: string;
  username: string;
  summary: Summary;
  projects: Project[];
  activity: Record<string, ActivityDay>;
  modelBreakdown?: Record<string, ModelBreakdown>;
  peakHours?: number[];
  currentStreak?: number;
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency: string;
  cronExpr: string;
  lastSync: string | null;
  logPath: string;
}

export interface Config {
  username: string;
  repoName: string;
  repoPath: string;
  createdAt: string;
  redactedProjects: string[];
  schedule?: ScheduleConfig;
}
