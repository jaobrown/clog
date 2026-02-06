const CONVEX_SITE_URL = "https://merry-mammoth-232.convex.site";
const CONVEX_URL = "https://merry-mammoth-232.convex.cloud";

export interface RankData {
  username: string;
  rank: number | null;
  totalParticipants: number;
  totalSessions: number;
  totalDurationMs: number;
  currentStreak: number;
  weeklyDurationMs: number;
}

export async function fetchUserRank(
  username: string
): Promise<RankData | null> {
  try {
    const url = `${CONVEX_SITE_URL}/api/rank?username=${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.rank === null) return null;
    return data as RankData;
  } catch {
    return null;
  }
}

export async function syncProfileToConvex(
  profileData: Record<string, unknown>
): Promise<boolean> {
  try {
    const url = `${CONVEX_URL}/api/mutation`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "profiles:upsertProfile",
        args: profileData,
        format: "json",
      }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
