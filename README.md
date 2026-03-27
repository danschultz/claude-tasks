[![CI](https://github.com/danschultz/claude-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/danschultz/claude-tasks/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/danschultz/claude-tasks)](https://github.com/danschultz/claude-tasks/releases)

# claude-tasks

**claude-tasks** is a task runner that uses the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) to execute AI-powered tasks defined as Markdown files. Define what you want Claude to do in plain Markdown, run it locally or in Docker, and schedule it with crontab.

## What It Can Do

- Run one or more Claude agent tasks filtered by tag
- Configure each task with a specific model, max turns, allowed tools, and MCP servers
- Write task output to timestamped directories for easy review
- Record a `task-runs.json` summary with status, duration, and results for every run

## Defining a Task

Tasks are Markdown files with YAML frontmatter. The frontmatter configures how Claude runs the task; the body is the natural language prompt.

```markdown
---
name: morning-weather
tags: daily
claudeOptions:
  model: claude-haiku-4-5
  effort: low
  maxTurns: 3
---

Fetch today's weather forecast for San Francisco, CA.
Write a brief summary including temperature range, conditions, and any precipitation to `weather.md`.
```

- `claude-haiku-4-5` — fast and inexpensive, ideal for simple retrieval tasks
- `effort: low` — no complex reasoning required
- `maxTurns: 3` — fetch, summarize, write; minimal back-and-forth needed

Place your task files in a directory (default: `./tasks`) and run them by tag.

## Running with Docker

Pull the image from the GitHub Container Registry and mount your tasks and output directories.

### Method 1 — Anthropic API key

```sh
docker run --rm \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v ./tasks:/tasks \
  -v ./output:/output \
  ghcr.io/danschultz/claude-tasks:latest \
  daily
```

### Method 2 — Claude Desktop / OAuth credentials

If you have authenticated via Claude Desktop or `claude login` on your host machine, mount your credentials directory read-only:

```sh
docker run --rm \
  -v ~/.config/claude:/home/node/.config/claude:ro \
  -v ./tasks:/tasks \
  -v ./output:/output \
  ghcr.io/danschultz/claude-tasks:latest \
  daily
```

The argument after the image name (`daily` above) is a tag filter — only tasks whose `tags` field includes that value will run. Pass a comma-separated list to match multiple tags (e.g. `daily,weekly`).

## Scheduling with crontab

Wrap a `docker run` command in a crontab entry to run tasks on a schedule.

```
# Run tasks tagged "daily" every day at 8am
0 8 * * * docker run --rm -e ANTHROPIC_API_KEY=<key> -v /path/to/tasks:/tasks -v /path/to/output:/output ghcr.io/danschultz/claude-tasks:latest daily
```

Open your crontab with `crontab -e` and add the line above, replacing `<key>` and the paths with your actual values.

## Documentation

- [Task File Format](docs/task-file-format.md) — full frontmatter reference and `claudeOptions` settings
- [Task Runner](docs/task-runner.md) — how tasks are discovered, filtered, and executed
- [Docker](docs/docker.md) — image details, environment variables, and volume mounts
