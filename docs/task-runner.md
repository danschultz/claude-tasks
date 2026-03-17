# Task Runner

The task runner is a TypeScript script that discovers, schedules, and executes
tasks using the Claude Agent SDK.

## Invocation

The runner is invoked with a comma-separated list of tags:

```
runner tag1,tag2,...
```

Only tasks whose `tags` frontmatter field matches at least one of the provided
tags will be scheduled to run.

## Environment Variables

| Variable     | Default    | Description                                        |
|--------------|------------|----------------------------------------------------|
| `TASK_DIR`   | `./tasks`  | Directory containing task Markdown files.          |
| `OUTPUT_DIR` | `./output` | Root directory where task output is written.       |

## Execution Flow

1. **Discover tasks** — Read all Markdown files in `TASK_DIR` and parse their
   frontmatter.

2. **Schedule tasks** — Filter to tasks whose `tags` field includes at least one
   of the input tags.

3. **Create output directories** — For each scheduled task, create a directory
   under `OUTPUT_DIR` named:

   ```
   [task-name]_[datetime]
   ```

   where `[datetime]` is the local machine time at the moment the runner starts.

4. **Run tasks** — Execute each scheduled task using the Claude Agent SDK, with
   the `claudeOptions` from the task's frontmatter. Any files the task produces
   are written to its output directory. The runner does not set `permissionMode`
   or `allowDangerouslySkipPermissions` — all permission configuration must be
   defined in the task's `claudeOptions`. The task's return message is a summary
   of the task:

   - **Success**: A summary of all outputs — the files written by the agent,
     their paths, and a description of their contents.
   - **Failed**: A description of the error, diagnostic information to help
     identify the root cause, and possible remediation steps.

5. **Write summary** — After all tasks complete, write a summary of the run to
   `task-runs.json` in `OUTPUT_DIR`. Task runs are sorted by `startedAt` in
   descending order (most recent first).

## Run Summary Format

`task-runs.json` contains the results of all task runs:

```json
{
  "taskRuns": [
    {
      "taskId": "UUID",
      "taskName": "my-task",
      "status": "success | failed",
      "outputDir": "/full/output/dir",
      "startedAt": "2026-03-15T10:00:00-07:00",
      "endedAt": "2026-03-15T10:01:24-07:00",
      "durationSeconds": 84,
      "resultSummary": "Message from task"
    }
  ]
}
```

### Fields

| Field             | Type   | Description                                                          |
|-------------------|--------|----------------------------------------------------------------------|
| `taskId`          | string | UUID uniquely identifying this task run.                             |
| `taskName`        | string | The name of the task, derived from the task file.                    |
| `status`          | string | `"success"` or `"failed"`.                                           |
| `outputDir`       | string | Absolute path to the output directory for this task run.             |
| `startedAt`       | string | ISO 8601 local machine timestamp with timezone offset when the task began executing. |
| `endedAt`         | string | ISO 8601 local machine timestamp with timezone offset when the task finished.        |
| `durationSeconds` | number | Elapsed time in seconds, rounded up (ceiling) to the nearest whole second. |
| `resultSummary`   | string | The return summary message from Claude (see Execution Flow step 4).  |
