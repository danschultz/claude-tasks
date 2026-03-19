# CI/CD Pipeline

## Overview

The CI/CD pipeline runs automated checks on every pull request, merge to `main`,
and release. It validates unit tests pass and the Docker image builds successfully.
Releases publish versioned Docker images to the GitHub Container Registry
(`ghcr.io`).

## Environment

| Setting | Value |
|---|---|
| Node version | Read from `.nvmrc` at the repo root |

## Triggers

| Event | When It Fires |
|---|---|
| `push` to `main` | On every commit merged or pushed directly to `main` |
| `pull_request` to `main` | On every commit pushed to an open pull request |
| `release` (published) | When a GitHub release is published (see [Creating a Release](#creating-a-release)) |

## Jobs

### Unit Tests

Sets up Node using the version from `.nvmrc`, then runs `npm run test:unit` to
execute the unit test suite.

### Docker Build & Publish

Builds the Docker image using `docker/build-push-action` and pushes it to
`ghcr.io/danschultz/claude-tasks` with tags based on the trigger type (see
[Docker Image Tags](#docker-image-tags) below). GitHub Actions layer caching
is enabled to speed up builds. For pull requests from forks, the image is built
but not pushed.

## Docker Image Tags

Every CI build produces a `sha-{short-sha}` tag for traceability. Releases
additionally produce human-readable version tags.

| Trigger | Tags Applied |
|---|---|
| `push` to `main` | `sha-{short-sha}` |
| `pull_request` | `sha-{short-sha}` |
| `release` (published) | `sha-{short-sha}`, `latest`, `{major}`, `{major}.{minor}`, `{major}.{minor}.{patch}` |

For example, publishing release `1.2.3` would produce tags:
`sha-abc1234`, `latest`, `1`, `1.2`, `1.2.3`.

## Creating a Release

Releases are triggered manually via the `release.yml` GitHub Actions workflow
using `workflow_dispatch`. To create a release:

1. Navigate to **Actions → Release** in the GitHub repository
2. Click **Run workflow**
3. Enter the version number (e.g. `1.2.3`) following [semantic versioning](https://semver.org/)
4. Click **Run workflow**

The release workflow creates a GitHub release, which in turn triggers the main
CI pipeline to build and publish the versioned Docker image tags.

## Future Work

**Integration tests** are currently skipped. Running them requires Claude Code
to be installed and authenticated with a user account, which is not yet
configured for CI. Once that is set up, integration tests can be enabled for
`push` to `main` and release triggers.
