import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runSync } from "./commands/sync.js";
import { runStats } from "./commands/stats.js";
import { runRedact } from "./commands/redact.js";
import {
  runSchedule,
  runScheduleStatus,
  runScheduleStop,
  runScheduleStart,
  runScheduleUpdate,
  runScheduleLogs,
} from "./commands/schedule.js";

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

program
  .command("redact [path]")
  .description("Mark a directory as redacted")
  .action(runRedact);

// Schedule command with subcommands
const schedule = program
  .command("schedule")
  .description("Set up automatic background syncing");

schedule.action(runSchedule);

schedule
  .command("status")
  .description("Show current schedule and sync status")
  .action(runScheduleStatus);

schedule
  .command("stop")
  .description("Disable the scheduled sync")
  .action(runScheduleStop);

schedule
  .command("start")
  .description("Re-enable a stopped schedule")
  .action(runScheduleStart);

schedule
  .command("update")
  .description("Change sync frequency")
  .action(runScheduleUpdate);

schedule
  .command("logs")
  .description("Show recent sync history")
  .action(runScheduleLogs);

// Default command: show stats
program.action(runStats);

program.parse();
