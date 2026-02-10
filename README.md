```
 ██████╗██╗      ██████╗  ██████╗
██╔════╝██║     ██╔═══██╗██╔════╝
██║     ██║     ██║   ██║██║  ███╗
██║     ██║     ██║   ██║██║   ██║
╚██████╗███████╗╚██████╔╝╚██████╔╝
 ╚═════╝╚══════╝ ╚═════╝  ╚═════╝
```

Track and share your Claude Code usage.

Clog parses your local Claude Code sessions and gives you stats on sessions, duration, tokens, and projects. Sync to a public GitHub repo, join the leaderboard at [clog.sh](https://clog.sh), and set up automatic background syncing.

## Requirements

- Node.js 18+
- [GitHub CLI](https://cli.github.com/) (`gh`) - for GitHub sync; required for [profile + leaderboard](https://clog.sh)

## Quick Start

```bash
npx @jaobrown/clog init
```

That's it. `init` walks you through everything:
1. Sets up your GitHub repo
2. Optionally configures automatic background syncing
3. Runs your first sync
4. Shows your stats and leaderboard rank

Your profile appears on [clog.sh](https://clog.sh) immediately.

## Commands

### View local stats

```bash
npx @jaobrown/clog
# or
npx @jaobrown/clog stats
```

Shows a summary of your Claude Code usage:
- Total sessions, duration, and tokens
- Project count and current streak
- Top 5 projects by time spent
- Recent sessions

### Initialize and sync

```bash
npx @jaobrown/clog init
```

Creates a public GitHub repository, syncs your stats, and optionally sets up automatic background syncing. You'll be prompted for:
- GitHub username
- Repository name (default: `clog`)
- Local repo path (default: `~/.clog/repo`)
- Whether to redact any project directories
- Whether to enable automatic background syncing

### Manual sync

```bash
npx @jaobrown/clog sync
```

Parses your sessions and pushes updated stats to your GitHub repo. The repo includes:
- `data/latest.json` - Public profile payload (summary, activity, project/session metadata used by clog.sh)
- `README.md` - Formatted stats display

> **Tip:** If you set up automatic syncing during `init` or via `clog schedule`, you don't need to run this manually.

### Automatic syncing

```bash
npx @jaobrown/clog schedule
```

Set up automatic background syncing so your stats stay up to date without manual effort. Choose how often to sync (1x to 12x per day, or a custom cron expression).

Uses launchd on macOS and cron on Linux. Survives reboots.

```bash
npx @jaobrown/clog schedule status    # check current schedule
npx @jaobrown/clog schedule stop      # disable syncing
npx @jaobrown/clog schedule start     # re-enable syncing
npx @jaobrown/clog schedule update    # change frequency
npx @jaobrown/clog schedule logs      # view recent sync logs
```

### Redact sensitive projects

```bash
npx @jaobrown/clog redact [path]

# Examples: `npx @jaobrown/clog redact my-app` or `npx @jaobrown/clog redact /Users/you/code/my-app`
```

Marks a directory as redacted (defaults to the current directory). Redacted projects still count toward totals, but their project name and session titles are hidden everywhere clog syncs data:
- Project name: `top secret`
- Session title: `**********`

Tip: Redaction matches by full path, project name, or basename. If you used a path under `~/.claude/projects/`, use the real project directory (for example `/Users/you/code/my-app`) or just the project name (`npx @jaobrown/clog redact my-app`).

## How it works

clog reads Claude Code session files from `~/.claude/projects/`. Each session includes:
- Session title and timestamp
- Duration
- Token usage (input, output, cache)
- Git branch and model used
- Subagent activity

When syncing to GitHub, clog publishes only profile/leaderboard data:
- Summary totals and daily activity
- Project names and session titles/timestamps/durations
- Aggregated token usage, tool usage, and model breakdown

It does not publish local project paths, per-session git branches/model IDs, message counts, or conversation content.

## Data storage

- **Claude Code sessions**: `~/.claude/projects/`
- **clog config**: `~/.claude/clog.json`
- **Sync repo** (default): `~/.clog/repo/`
- **Sync logs**: `~/.claude/clog-sync.log` (when schedule is active)

## FAQ

**How do I get started?**
Run `npx @jaobrown/clog init` — it handles everything including your first sync.

**How often should I sync?**
Set up automatic syncing with `npx @jaobrown/clog schedule` and never think about it again. Choose anywhere from 1x to 12x per day. If you prefer manual control, run `npx @jaobrown/clog sync` whenever you want.

**Can I redact sensitive data?**
Yes. Use `npx @jaobrown/clog redact [path]` to hide a project's name and session titles in `clog stats`, the README, and `latest.json`. You can redact as many projects as you need. You can also set up redactions during `init`.

**When will my profile appear on the leaderboard?**
Your profile syncs to [clog.sh](https://clog.sh) immediately during `init`. After that, the leaderboard refreshes from GitHub hourly.

**What data is shared?**
Only aggregate stats: session counts, durations, tokens, project names, session titles/timestamps, activity history, and model/tool breakdowns. No conversation content, code, prompts, or local paths are ever shared.

## License

MIT
