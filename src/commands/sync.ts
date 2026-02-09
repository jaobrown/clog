import chalk from "chalk";
import ora from "ora";
import { readConfigWithDefaults, configExists } from "../utils/config.js";
import { generateOutputData, toPublicOutputData } from "../output/generator.js";
import { generateReadme, getRecentSessions, getTopProjects } from "../output/readme.js";
import { writeLatestJson, commitAndPush, hasChanges, writeReadme } from "../utils/git.js";
import { formatDuration, formatNumber } from "../utils/format.js";

export async function runSync(): Promise<void> {
  if (!configExists()) {
    console.log(chalk.red("Not initialized. Run: npx @jaobrown/clog init"));
    process.exit(1);
  }

  const config = readConfigWithDefaults();
  if (!config) {
    console.log(chalk.red("Could not read config. Run: npx @jaobrown/clog init"));
    process.exit(1);
  }

  const spinner = ora("Parsing sessions...").start();

  try {
    // Generate output data
    const data = generateOutputData(config.username, config.redactedProjects);
    const publicData = toPublicOutputData(data);

    spinner.text = "Writing latest.json...";
    writeLatestJson(config.repoPath, publicData);

    // Generate README
    spinner.text = "Generating README...";
    const recentSessions = getRecentSessions(data.projects, 5);
    const topProjects = getTopProjects(data.projects, 5);
    const readme = generateReadme(
      config.username,
      data.summary,
      recentSessions,
      topProjects,
      data.modelBreakdown,
      data.peakHours,
      data.currentStreak
    );
    writeReadme(config.repoPath, readme);

    // Check if there are changes
    spinner.text = "Checking for changes...";
    const changes = await hasChanges(config.repoPath);

    if (!changes) {
      spinner.succeed("No changes to sync");
      return;
    }

    // Commit and push
    spinner.text = "Pushing to GitHub...";
    const commitMessage = `📓 clog: ${formatNumber(data.summary.totalSessions)} sessions, ${formatDuration(data.summary.totalDurationMs)}`;
    await commitAndPush(config.repoPath, commitMessage, [
      "README.md",
      "data/latest.json",
    ]);

    spinner.succeed("Synced successfully");

    console.log(
      chalk.dim(
        `\n  ${formatNumber(data.summary.totalSessions)} sessions across ${data.summary.projectCount} projects`
      )
    );
    console.log(
      chalk.dim(`  ${formatDuration(data.summary.totalDurationMs)} total time`)
    );
    console.log(
      chalk.dim(`  ${formatNumber(data.summary.totalTokens)} tokens\n`)
    );
  } catch (error) {
    spinner.fail("Sync failed");
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
