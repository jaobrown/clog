import chalk from "chalk";
import * as path from "path";
import { configExists, readConfigWithDefaults, writeConfig } from "../utils/config.js";
import { normalizeRedactionPath } from "../utils/redaction.js";

export async function runRedact(pathArg?: string): Promise<void> {
  if (!configExists()) {
    console.log(chalk.red("Not initialized. Run: npx @jaobrown/clog init"));
    process.exit(1);
  }

  const config = readConfigWithDefaults();
  if (!config) {
    console.log(chalk.red("Could not read config. Run: npx @jaobrown/clog init"));
    process.exit(1);
  }

  const rawPath = pathArg && pathArg.trim().length > 0 ? pathArg : process.cwd();
  const normalizedPath = normalizeRedactionPath(rawPath);

  if (config.redactedProjects.includes(normalizedPath)) {
    console.log(chalk.yellow("Already redacted."));
    console.log(chalk.dim(`Path: ${normalizedPath}`));
    return;
  }

  const updated = {
    ...config,
    redactedProjects: [...config.redactedProjects, normalizedPath],
  };

  writeConfig(updated);

  console.log(chalk.green("Redaction saved."));
  console.log(chalk.dim(`Path: ${normalizedPath}`));
  console.log(
    chalk.dim(
      `Basename: ${path.basename(normalizedPath)} (projects matching this name will redact)`
    )
  );
}
