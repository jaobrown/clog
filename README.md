# clog

Track and share your Claude Code usage.

clog parses your local Claude Code sessions and gives you stats on sessions, duration, tokens, and projects. Optionally sync to a public GitHub repo to share your coding activity.

## Requirements

- Node.js 18+
- [GitHub CLI](https://cli.github.com/) (`gh`) - for GitHub sync features

## Usage

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

### Initialize GitHub sync

```bash
npx @jaobrown/clog init
```

Creates a public GitHub repository to sync your stats. You'll be prompted for:
- GitHub username
- Repository name (default: `clog`)
- Local repo path (default: `~/.clog/repo`)

### Sync to GitHub

```bash
npx @jaobrown/clog sync
```

Parses your sessions and pushes updated stats to your GitHub repo. The repo includes:
- `data/latest.json` - Full session data
- `README.md` - Formatted stats display

## How it works

clog reads Claude Code session files from `~/.claude/projects/`. Each session includes:
- Session title and timestamp
- Duration
- Token usage (input, output, cache)
- Git branch and model used
- Subagent activity

## Data storage

- **Claude Code sessions**: `~/.claude/projects/`
- **clog config**: `~/.claude/clog.json`
- **Sync repo** (default): `~/.clog/repo/`

## License

MIT
