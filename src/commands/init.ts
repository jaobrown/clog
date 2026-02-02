import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { configExists, writeConfig, readConfig } from "../utils/config.js";
import { writeReadme, writeGitkeep } from "../utils/git.js";
import { generateReadme } from "../output/readme.js";
import { runSync } from "./sync.js";

function checkGhCli(): boolean {
  try {
    execSync("gh --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkGhAuth(): boolean {
  try {
    execSync("gh auth status", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function runInit(): Promise<void> {
  console.log(chalk.bold("\nClog - Claude Code Stats\n"));

  // Check if already initialized
  if (configExists()) {
    const config = readConfig();
    console.log(
      chalk.yellow(
        `Already initialized for user ${chalk.bold(config?.username)}`
      )
    );
    console.log(chalk.dim(`Config: ~/.claude/clog.json`));
    console.log(chalk.dim(`Repo: ${config?.repoPath}`));

    const { reinit } = await inquirer.prompt<{ reinit: boolean }>([
      {
        type: "confirm",
        name: "reinit",
        message: "Do you want to reinitialize?",
        default: false,
      },
    ]);

    if (!reinit) {
      return;
    }
  }

  // Check gh CLI
  if (!checkGhCli()) {
    console.log(chalk.red("GitHub CLI (gh) is not installed."));
    console.log(chalk.dim("Install it from: https://cli.github.com/"));
    process.exit(1);
  }

  // Check gh auth
  if (!checkGhAuth()) {
    console.log(chalk.red("GitHub CLI is not authenticated."));
    console.log(chalk.dim("Run: gh auth login"));
    process.exit(1);
  }

  // Get username
  const { username } = await inquirer.prompt<{ username: string }>([
    {
      type: "input",
      name: "username",
      message: "GitHub username:",
      validate: (input: string) =>
        input.trim().length > 0 || "Username is required",
    },
  ]);

  // Get repo name
  const { repoName } = await inquirer.prompt<{ repoName: string }>([
    {
      type: "input",
      name: "repoName",
      message: "Repository name:",
      default: "clog",
      validate: (input: string) =>
        /^[a-zA-Z0-9._-]+$/.test(input.trim()) || "Invalid repository name",
    },
  ]);

  const defaultRepoPath = path.join(os.homedir(), ".clog", "repo");

  const { repoPath } = await inquirer.prompt<{ repoPath: string }>([
    {
      type: "input",
      name: "repoPath",
      message: "Local repo path:",
      default: defaultRepoPath,
    },
  ]);

  const fullRepoName = `${username}/${repoName}`;

  // Create repo
  const spinner = ora("Creating GitHub repository...").start();

  try {
    // Check if repo already exists
    try {
      execSync(`gh repo view ${fullRepoName}`, { stdio: "ignore" });
      spinner.info("Repository already exists");
    } catch {
      // Create new repo
      execSync(
        `gh repo create ${repoName} --public --description "My Claude Code stats"`,
        { stdio: "ignore" }
      );
      spinner.succeed("Created GitHub repository");
    }

    // Add topic
    spinner.start("Adding repository topic...");
    try {
      execSync(`gh repo edit ${fullRepoName} --add-topic clog-leaderboard`, {
        stdio: "ignore",
      });
      spinner.succeed("Added clog-leaderboard topic");
    } catch {
      spinner.warn("Could not add topic (may already exist)");
    }

    // Clone repo
    spinner.start("Cloning repository...");

    // Ensure parent directory exists
    const parentDir = path.dirname(repoPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Remove existing directory if it exists
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true });
    }

    execSync(`gh repo clone ${fullRepoName} "${repoPath}"`, {
      stdio: "ignore",
    });
    spinner.succeed("Cloned repository");

    // Create initial files
    spinner.start("Creating initial files...");
    const initialReadme = generateReadme(
      username,
      { totalSessions: 0, totalDurationMs: 0, totalTokens: 0, projectCount: 0 },
      [],
      []
    );
    writeReadme(repoPath, initialReadme);
    writeGitkeep(repoPath);
    spinner.succeed("Created initial files");

    // Initial commit
    spinner.start("Creating initial commit...");
    execSync('git add . && git commit -m "Initial commit" || true', {
      cwd: repoPath,
      stdio: "ignore",
    });
    execSync("git push || true", {
      cwd: repoPath,
      stdio: "ignore",
    });
    spinner.succeed("Pushed initial commit");

    // Save config
    writeConfig({
      username,
      repoName,
      repoPath,
      createdAt: new Date().toISOString(),
    });

    console.log(chalk.green("\nInitialization complete!"));
    console.log(chalk.dim(`Config saved to ~/.claude/clog.json`));
    console.log(
      chalk.dim(`Repository: https://github.com/${fullRepoName}\n`)
    );

    // Run first sync
    console.log(chalk.bold("Running first sync...\n"));
    await runSync();
  } catch (error) {
    spinner.fail("Initialization failed");
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
