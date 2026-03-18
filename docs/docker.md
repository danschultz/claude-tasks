# Docker

This document describes how to build and publish the Docker image for
`claude-tasks`.

## Overview

The Docker image runs `src/runner.ts`, which discovers and executes Claude agent
tasks defined as Markdown files. Any arguments passed to `docker run` are
forwarded to the runner as tag filters (see `docs/task-runner.md`).

## Authentication

The container runs the `claude` CLI, which requires authentication. Two methods
are supported:

### Method 1 — Anthropic API key

Pass your API key as an environment variable:

```sh
docker run --rm \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v ./tasks:/tasks \
  -v ./output:/output \
  ghcr.io/<owner>/claude-tasks:latest \
  daily
```

### Method 2 — Claude Desktop / OAuth credentials

If you have authenticated via Claude Desktop or `claude login` on your host
machine, credentials are stored at `~/.config/claude/`. Mount that directory
read-only into the container:

```sh
docker run --rm \
  -v ~/.config/claude:/home/node/.config/claude:ro \
  -v ./tasks:/tasks \
  -v ./output:/output \
  ghcr.io/<owner>/claude-tasks:latest \
  daily
```

## Prerequisites

`tsx` must be listed under `dependencies` (not `devDependencies`) in
`package.json` so it is available after `npm ci --omit=dev`.

## Dockerfile

* The Node major version **must always match the version in `.nvmrc`**, which is
  the source of truth.
* When `.nvmrc` changes, update the `FROM` line accordingly.

## Environment Variables

| Variable   | Default    | Description                                        |
|------------|------------|----------------------------------------------------|
| `TASK_DIR` | `/tasks`   | Directory containing task Markdown files to run.   |
| `OUTPUT_DIR` | `/output` | Root directory where task output is written.      |

## Volume Mounts

Bind-mount the host directories that contain your tasks and where you want
output written. The container runs as the default `node` user, so the mounted
directories must be readable/writable by that user (UID 1000).

## Local Development

Build the image locally with:

```sh
npm run docker:build
```

This tags the image as `claude-tasks:local`. Use this tag in place of the GHCR
image when running locally.

## Usage Examples

Run all tasks tagged `daily`:

```sh
docker run --rm \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v ./tasks:/tasks \
  -v ./output:/output \
  ghcr.io/<owner>/claude-tasks:latest \
  daily
```

Run tasks tagged `daily` or `weekly` with a custom task directory:

```sh
docker run --rm \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e TASK_DIR=/custom-tasks \
  -v ./my-tasks:/custom-tasks \
  -v ./output:/output \
  ghcr.io/<owner>/claude-tasks:latest \
  daily,weekly
```

## Artifacts

A Github Actions workflow builds the image on every published release and pushes
it to the GitHub Container Registry (`ghcr.io`).

**Tags published per release:**

| Tag pattern             | Example            |
|-------------------------|--------------------|
| `latest`                | `latest`           |
| `{major}`               | `1`                |
| `{major}.{minor}`       | `1.2`              |
| `{major}.{minor}.{patch}` | `1.2.3`          |
| `sha-{short-sha}`       | `sha-a1b2c3d`      |
