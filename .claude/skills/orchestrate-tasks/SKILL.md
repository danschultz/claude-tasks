---
name: orchestrate-tasks
description: Orchestrates the execution of tasks defined in Markdown files.
---

## Overview

This project is designed to orchestrate the execution of tasks defined in Markdown files. Each task is described in a Markdown file with frontmatter that specifies the task's name and tags. The project includes a script to execute these tasks.

## Step 1: Find Task Files

Find each Markdown file in the `./tasks` directory.

## Step 2: Extract Frontmatter

Extract **only** the frontmatter from the Markdown file. You will not need the body of the file. The frontmatter includes details about how the task should be executed.

## Step 3: Execute Task

Execute a task if the task's tags matches a tag in the comma-delimited $ARGUMENTS. Otherwise, skip the task.

The process for executing a task is as follows:

1. Assign the task a random UUID.
2. Create a folder in the `./output` directory with the name of the task and a timestamp (e.g., `./output/test-task-1_2024-06-01T12-00-00`).
3. Run the task using the task-runner agent.

When running the task-runner agent, do the following:

- Pass in the path to the individual task to be executed.
- Pass in the folder path as an argument so that the task-runner agent knows where to write the output.
- Configure the task-runner agent to use tools defined in the task's frontmatter.

For diagnostics and logs, track:

- The date and time the task was started and completed.
- The duration of the task execution in seconds.

## Step 4: Summary and Logging

After all tasks have completed:

- Print a summary of which tasks were run and which were skipped.
- Write a JSON log file in the `./output` directory that contains the details of the task run. The log file should be named `task-run-log.json`.

Here is an example of the JSON log file format:

```json
{
  "task_runs": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "test-task-1",
      "started_at": "2024-06-01T12:00:00",
      "ended_at": "2024-06-01T12:05:00",
      "duration_seconds": 300,
      "status": "success",
      "output_dir": "./output/test-task-1_2024-06-01T12-00-00"
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "test-task-2",
      "started_at": "2024-06-01T12:00:00",
      "ended_at": "2024-06-01T12:05:00",
      "duration_seconds": 300,
      "status": "failed",
      "output_dir": "./output/test-task-2_2024-06-01T12-00-00"
    }
  ]
}
```

## Step 5: Log Maintenance

Remove any entries from the log file that are older than 30 days.
