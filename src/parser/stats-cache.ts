import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ModelUsageEntry {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests?: number;
  costUSD?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  modelUsage: Record<string, ModelUsageEntry>;
  totalSessions: number;
  totalMessages: number;
  longestSession?: {
    sessionId: string;
    messageCount: number;
  };
  firstSessionDate?: string;
  hourCounts: Record<string, number>;
}

/**
 * Read the global stats-cache.json file from ~/.claude/
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function readStatsCache(): StatsCache | null {
  const cachePath = path.join(os.homedir(), ".claude", "stats-cache.json");

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(content) as StatsCache;
  } catch {
    return null;
  }
}

/**
 * Get peak activity hours (top 3 hours with most sessions).
 */
export function getPeakHours(cache: StatsCache): number[] {
  const entries = Object.entries(cache.hourCounts);
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, 3).map(([hour]) => parseInt(hour, 10));
}

/**
 * Get model usage breakdown with tokens by model.
 */
export function getModelBreakdown(
  cache: StatsCache
): Record<string, { inputTokens: number; outputTokens: number; cacheTokens: number }> {
  const breakdown: Record<string, { inputTokens: number; outputTokens: number; cacheTokens: number }> = {};

  for (const [model, usage] of Object.entries(cache.modelUsage)) {
    // Simplify model name (e.g., "claude-opus-4-5-20251101" -> "opus-4.5")
    const simpleName = simplifyModelName(model);

    const cacheTokens = (usage.cacheReadInputTokens || 0) + (usage.cacheCreationInputTokens || 0);

    if (breakdown[simpleName]) {
      breakdown[simpleName].inputTokens += usage.inputTokens;
      breakdown[simpleName].outputTokens += usage.outputTokens;
      breakdown[simpleName].cacheTokens += cacheTokens;
    } else {
      breakdown[simpleName] = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheTokens,
      };
    }
  }

  return breakdown;
}

/**
 * Simplify model name for display.
 * e.g., "claude-opus-4-5-20251101" -> "opus-4.5"
 *       "claude-sonnet-4-5-20250929" -> "sonnet-4.5"
 */
function simplifyModelName(model: string): string {
  const match = model.match(/claude-(\w+)-(\d+)-(\d+)/);
  if (match) {
    const [, name, major, minor] = match;
    return `${name}-${major}.${minor}`;
  }

  // Fallback: try to extract just the model family
  if (model.includes("opus")) return "opus";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("haiku")) return "haiku";

  return model;
}

/**
 * Calculate current coding streak (consecutive days with activity).
 */
export function getCurrentStreak(cache: StatsCache): number {
  if (!cache.dailyActivity || cache.dailyActivity.length === 0) {
    return 0;
  }

  // Sort by date descending
  const sorted = [...cache.dailyActivity].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let streak = 0;
  let checkDate = today;

  // Start from today or yesterday
  const mostRecentDate = new Date(sorted[0].date);
  mostRecentDate.setHours(0, 0, 0, 0);

  // If most recent activity is not today or yesterday, streak is 0
  if (mostRecentDate.getTime() < yesterday.getTime()) {
    return 0;
  }

  // Count consecutive days
  for (const activity of sorted) {
    const activityDate = new Date(activity.date);
    activityDate.setHours(0, 0, 0, 0);

    // If this is the expected date, count it
    if (activityDate.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (activityDate.getTime() < checkDate.getTime()) {
      // Gap found, check if it's just one day off from the start
      if (streak === 0 && activityDate.getTime() === yesterday.getTime()) {
        streak++;
        checkDate = new Date(yesterday);
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return streak;
}
