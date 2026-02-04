import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { Config } from "../types.js";

const CONFIG_PATH = path.join(os.homedir(), ".claude", "clog.json");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

export function readConfig(): Config | null {
  if (!configExists()) {
    return null;
  }
  try {
    const content = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content) as Config;
  } catch {
    return null;
  }
}

export function normalizeConfig(config: Config): Config {
  return {
    ...config,
    redactedProjects: Array.isArray(config.redactedProjects)
      ? config.redactedProjects
      : [],
  };
}

export function readConfigWithDefaults(): Config | null {
  const config = readConfig();
  if (!config) return null;
  return normalizeConfig(config);
}

export function writeConfig(config: Config): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getClaudeDir(): string {
  return path.join(os.homedir(), ".claude");
}

export function getProjectsDir(): string {
  return path.join(getClaudeDir(), "projects");
}
