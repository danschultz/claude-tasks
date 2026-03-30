import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import matter from 'gray-matter';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ── Types ────────────────────────────────────────────────────────────────────

interface McpServerSpec {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface TaskFrontmatter {
  name: string;
  tags: string | string[];
  claudeOptions?: {
    allowedTools?: string[];
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    debug?: boolean;
    disallowedTools?: string[];
    effort?: 'low' | 'medium' | 'high';
    maxBudgetUsd?: number;
    maxThinkingTokens?: number;
    maxTurns?: number;
    mcpServers?: McpServerSpec[];
    model?: string;
    tools?: string[];
  };
}

export interface TaskDefinition {
  file: string;
  data: TaskFrontmatter;
  content: string;
}

export interface TaskRun {
  taskId: string;
  taskName: string;
  status: 'success' | 'failed';
  outputDir: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  resultSummary: string;
}

import { formatLocalISO, formatDirDatetime } from './datetime.js';
export { formatLocalISO, formatDirDatetime };

/** Convert the frontmatter claudeOptions into SDK Options, with cwd set to outputDir. */
export function buildQueryOptions(
  claudeOptions: TaskFrontmatter['claudeOptions'],
  cwd: string
): Options {
  const opts: Options = { cwd };
  if (!claudeOptions) return opts;

  const { mcpServers, ...rest } = claudeOptions;

  // Pass all scalar options through directly
  Object.assign(opts, rest);

  // Convert mcpServers array [{name, command, args}] → Record<name, config>
  if (mcpServers && mcpServers.length > 0) {
    opts.mcpServers = Object.fromEntries(
      mcpServers.map(({ name, ...config }) => [name, config])
    );
  }

  return opts;
}

/** Wrap a task's content in a system prompt that provides context and enforces a JSON result format. */
export function buildTaskPrompt(
  taskContent: string,
  outputDir: string
): string {
  return `# Task Runner

You're a task runner that runs jobs. You're invoked by a parent Node process
through a code agent. The Node process will process the result and expects is
expecting JSON.

## Input

* Any files the task wants to write should be written to \`${outputDir}\`.

## Output Format

* Respond with _ONLY_ a raw JSON object — no backticks, no markdown, no
  explanation. Do _NOT_ wrap in code fences. The exact format: \`{"status":
  "success", "message": "..."} or {"status": "failed", "message": "..."}\`

---

Here's the task to run:

${taskContent}`;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/** Read all .md files from taskDir and parse their frontmatter. */
export async function discoverTasks(
  taskDir: string
): Promise<TaskDefinition[]> {
  const files = await readdir(taskDir);
  const tasks: TaskDefinition[] = [];

  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const filePath = join(taskDir, file);
    const raw = await readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);
    tasks.push({
      file: filePath,
      data: data as TaskFrontmatter,
      content: content.trim(),
    });
  }

  return tasks;
}

/** Return only tasks whose tags overlap with the requested tags. */
export function filterTasksByTags(
  tasks: TaskDefinition[],
  tags: string[]
): TaskDefinition[] {
  return tasks.filter((task) => {
    const taskTags = Array.isArray(task.data.tags)
      ? task.data.tags
      : [task.data.tags];
    return tags.some((tag) => taskTags.includes(tag));
  });
}

/** Execute a single task via the Claude Agent SDK and return its result. */
export async function runTask(
  task: TaskDefinition,
  outputDir: string
): Promise<{ status: 'success' | 'failed'; resultSummary: string }> {
  const options = buildQueryOptions(task.data.claudeOptions, outputDir);
  const prompt = buildTaskPrompt(task.content, outputDir);
  const q = query({ prompt, options });

  for await (const msg of q) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success' && !msg.is_error) {
        try {
          const parsed = JSON.parse(msg.result) as {
            status: string;
            message: string;
          };
          if (parsed.status === 'failed') {
            return { status: 'failed', resultSummary: parsed.message };
          }
          return {
            status: 'success',
            resultSummary: parsed.message ?? msg.result,
          };
        } catch {
          return { status: 'success', resultSummary: msg.result };
        }
      } else if (msg.subtype === 'success' && msg.is_error) {
        return { status: 'failed', resultSummary: msg.result };
      } else {
        const detail = 'errors' in msg ? msg.errors.join('; ') : msg.subtype;
        return {
          status: 'failed',
          resultSummary: `Error (${msg.subtype}): ${detail}`,
        };
      }
    }
  }

  return {
    status: 'failed',
    resultSummary: 'Task completed without a result message.',
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function run(
  tags: string[],
  taskDir: string,
  outputDir: string
): Promise<void> {
  const runDatetime = new Date();
  const datetimeStr = formatDirDatetime(runDatetime);

  const allTasks = await discoverTasks(taskDir);
  const scheduled = filterTasksByTags(allTasks, tags);

  if (scheduled.length === 0) {
    console.log(`No tasks found matching tags: ${tags.join(', ')}`);
    return;
  }

  console.log(
    `Running ${scheduled.length} task(s): ${scheduled.map((t) => t.data.name).join(', ')}`
  );

  const taskRuns: TaskRun[] = [];

  for (const task of scheduled) {
    const taskOutputDir = resolve(
      join(outputDir, `${task.data.name}_${datetimeStr}`)
    );
    await mkdir(taskOutputDir, { recursive: true });

    const taskId = randomUUID();
    const startedAt = new Date();
    console.log(`Starting task: ${task.data.name}`);

    let result: { status: 'success' | 'failed'; resultSummary: string };
    try {
      result = await runTask(task, taskOutputDir);
    } catch (err) {
      result = {
        status: 'failed',
        resultSummary: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const endedAt = new Date();
    const durationSeconds = Math.ceil(
      (endedAt.getTime() - startedAt.getTime()) / 1000
    );

    console.log(`Task ${task.data.name}: ${result.status}`);

    taskRuns.push({
      taskId,
      taskName: task.data.name,
      status: result.status,
      outputDir: taskOutputDir,
      startedAt: formatLocalISO(startedAt),
      endedAt: formatLocalISO(endedAt),
      durationSeconds,
      resultSummary: result.resultSummary,
    });
  }

  const summaryPath = join(outputDir, 'task-runs.json');

  let existingRuns: TaskRun[] = [];
  try {
    const existing = await readFile(summaryPath, 'utf-8');
    existingRuns =
      (JSON.parse(existing) as { taskRuns: TaskRun[] }).taskRuns ?? [];
  } catch {
    // File doesn't exist yet — start fresh
  }

  const allRuns = [...existingRuns, ...taskRuns];
  allRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  await writeFile(
    summaryPath,
    JSON.stringify({ taskRuns: allRuns }, null, 2),
    'utf-8'
  );
  console.log(`Summary written to ${summaryPath}`);
}

// ── CLI Entry Point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tagsArg = process.argv[2];
  if (!tagsArg) {
    console.error('Usage: runner <tag1,tag2,...>');
    process.exit(1);
  }

  const tags = tagsArg
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const taskDir = process.env.TASK_DIR ?? './tasks';
  const outputDir = process.env.OUTPUT_DIR ?? './output';

  run(tags, taskDir, outputDir).catch((err) => {
    console.error('Runner failed:', err);
    process.exit(1);
  });
}
