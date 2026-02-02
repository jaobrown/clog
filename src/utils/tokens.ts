import type { TokenUsage } from "../types.js";

export function emptyTokens(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
}

export function addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
  };
}

export function getTotalTokenCount(tokens: TokenUsage): number {
  return (
    tokens.inputTokens +
    tokens.outputTokens +
    tokens.cacheReadTokens +
    tokens.cacheCreationTokens
  );
}
