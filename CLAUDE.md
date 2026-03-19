# CLAUDE.md

This is a project that runs tasks using Claude. Tasks are defined as Markdown
files and run using the Claude Agent Typescript SDK.

## Documentation

* @docs/task-file-format.md: Describes the Markdown file format used to define
  tasks, including all `claudeOptions` configuration options.
* @docs/task-runner.md: Describes how the task runner discovers, schedules, and
  executes tasks.
* @docs/docker.md: Describes how to build and publish the Docker image,
  including the Dockerfile specification and GitHub Actions publishing workflow.

## Project Structure

* `./docs`: A directory containing documentation for the project.

## Testing

Tests live in `src/__tests__/` and follow the naming convention
`{filename}.{unit|integration}.test.ts`.

Test task files (Markdown task files used for testing) should follow the naming
convention `test-{name}.md` (e.g. `test-foo-bar.md`).

* `npm run test:unit`: Run unit tests (`*.unit.test.ts`).
* `npm run test:integration`: Run integration tests (`*.integration.test.ts`).

## Project Tasks

NPM scripts are used for various tasks of the project (builds, linting, testing,
etc). Scripts make it easier for human or machine to automate the various
aspects of the project. Add, update or remove scripts whenever these aspects
change.

* `npm run docker:build`: Build the Docker image locally, tagged as
  `claude-tasks:local`.
* `npm run test:unit`: Run unit tests (`*.unit.test.ts`).
* `npm run test:integration`: Run integration tests (`*.integration.test.ts`).

