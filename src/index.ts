import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runSync } from "./commands/sync.js";
import { runStats } from "./commands/stats.js";

const program = new Command();

program
  .name("clog")
  .description("Track and share your Claude Code usage")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize clog with a GitHub repository")
  .action(runInit);

program
  .command("sync")
  .description("Parse sessions and sync to GitHub")
  .action(runSync);

program
  .command("stats")
  .description("Display usage statistics")
  .action(runStats);

// Default command: show stats
program.action(runStats);

program.parse();
