# CLAUDE.md

This is a project that runs tasks using Claude. Tasks are defined as Markdown
files and run using the Claude Agent Typescript SDK.

## Documentation

* @docs/task-file-format.md: Describes the Markdown file format used to define
  tasks, including all `claudeOptions` configuration options.
* @docs/task-runner.md: Describes how the task runner discovers, schedules, and
  executes tasks.

## Project Structure

* `./docs`: A directory containing documentation for the project.

## Project Workflows

* `npm run test:unit`: Run unit tests (`*.unit.test.ts`).
* `npm run test:integration`: Run integration tests (`*.integration.test.ts`).
