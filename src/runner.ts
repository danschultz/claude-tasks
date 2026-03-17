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
  claude_options?: {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as ISO 8601 with the local timezone offset (e.g. 2026-03-15T10:00:00-07:00). */
export function formatLocalISO(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hh = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const mm = String(absOffset % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

/** Format a Date as a compact local datetime string for directory names (e.g. 20260315_100000). */
export function formatDirDatetime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Convert the frontmatter claude_options into SDK Options, with cwd set to outputDir. */
export function buildQueryOptions(
  claudeOptions: TaskFrontmatter['claude_options'],
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

// ── Core Functions ────────────────────────────────────────────────────────────

/** Read all .md files from taskDir and parse their frontmatter. */
export async function discoverTasks(taskDir: string): Promise<TaskDefinition[]> {
  const files = await readdir(taskDir);
  const tasks: TaskDefinition[] = [];

  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const filePath = join(taskDir, file);
    const raw = await readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);
    tasks.push({ file: filePath, data: data as TaskFrontmatter, content: content.trim() });
  }

  return tasks;
}

/** Return only tasks whose tags overlap with the requested tags. */
export function filterTasksByTags(tasks: TaskDefinition[], tags: string[]): TaskDefinition[] {
  return tasks.filter((task) => {
    const taskTags = Array.isArray(task.data.tags) ? task.data.tags : [task.data.tags];
    return tags.some((tag) => taskTags.includes(tag));
  });
}

/** Execute a single task via the Claude Agent SDK and return its result. */
export async function runTask(
  task: TaskDefinition,
  outputDir: string
): Promise<{ status: 'success' | 'failed'; resultSummary: string }> {
  const options = buildQueryOptions(task.data.claude_options, outputDir);
  const q = query({ prompt: task.content, options });

  for await (const msg of q) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        return { status: 'success', resultSummary: msg.result };
      } else {
        const detail = 'errors' in msg ? msg.errors.join('; ') : msg.subtype;
        return { status: 'failed', resultSummary: `Error (${msg.subtype}): ${detail}` };
      }
    }
  }

  return { status: 'failed', resultSummary: 'Task completed without a result message.' };
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

  console.log(`Running ${scheduled.length} task(s): ${scheduled.map((t) => t.data.name).join(', ')}`);

  const taskRuns: TaskRun[] = [];

  for (const task of scheduled) {
    const taskOutputDir = resolve(join(outputDir, `${task.data.name}_${datetimeStr}`));
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
    const durationSeconds = Math.ceil((endedAt.getTime() - startedAt.getTime()) / 1000);

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

  taskRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const summaryPath = join(outputDir, 'task-runs.json');
  await writeFile(summaryPath, JSON.stringify({ taskRuns }, null, 2), 'utf-8');
  console.log(`Summary written to ${summaryPath}`);
}

// ── CLI Entry Point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tagsArg = process.argv[2];
  if (!tagsArg) {
    console.error('Usage: runner <tag1,tag2,...>');
    process.exit(1);
  }

  const tags = tagsArg.split(',').map((t) => t.trim()).filter(Boolean);
  const taskDir = process.env.TASK_DIR ?? './tasks';
  const outputDir = process.env.OUTPUT_DIR ?? './output';

  run(tags, taskDir, outputDir).catch((err) => {
    console.error('Runner failed:', err);
    process.exit(1);
  });
}
