import { describe, it, expect, afterAll } from 'vitest';
import { access, readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../runner.js';

const TASK_DIR = './tasks';
const TIMEOUT_MS = 60_000;

describe('integration: prompt-wrapping-test task writes to output dir', () => {
  let tempOutputDir: string;

  afterAll(async () => {
    if (tempOutputDir) {
      await rm(tempOutputDir, { recursive: true, force: true });
    }
  });

  it(
    'runs the prompt-wrapping-test tag and writes the output file',
    async () => {
      tempOutputDir = await mkdtemp(
        join(tmpdir(), 'claude-tasks-integration-')
      );

      await run(['prompt-wrapping-test'], TASK_DIR, tempOutputDir);

      const summaryRaw = await readFile(
        join(tempOutputDir, 'task-runs.json'),
        'utf-8'
      );
      const summary = JSON.parse(summaryRaw) as {
        taskRuns: Array<{ taskName: string; status: string; outputDir: string }>;
      };

      const taskRun = summary.taskRuns.find(
        (r) => r.taskName === 'test-prompt-wrapping'
      );
      expect(taskRun).toBeDefined();
      expect(taskRun!.status).toBe('success');

      // Verify the file was actually written to the task's output directory
      const outputFile = join(taskRun!.outputDir, 'output.md');
      await expect(access(outputFile)).resolves.toBeUndefined();
      const contents = await readFile(outputFile, 'utf-8');
      expect(contents).toContain('Hello from integration test!');
    },
    TIMEOUT_MS
  );
});

describe('integration: prompt-failure-test task reports failure', () => {
  let tempOutputDir: string;

  afterAll(async () => {
    if (tempOutputDir) {
      await rm(tempOutputDir, { recursive: true, force: true });
    }
  });

  it(
    'runs the prompt-failure-test tag and records a failed task run',
    async () => {
      tempOutputDir = await mkdtemp(
        join(tmpdir(), 'claude-tasks-integration-')
      );

      await run(['prompt-failure-test'], TASK_DIR, tempOutputDir);

      const summaryRaw = await readFile(
        join(tempOutputDir, 'task-runs.json'),
        'utf-8'
      );
      const summary = JSON.parse(summaryRaw) as {
        taskRuns: Array<{ taskName: string; status: string }>;
      };

      const taskRun = summary.taskRuns.find(
        (r) => r.taskName === 'test-prompt-failure'
      );
      expect(taskRun).toBeDefined();
      expect(taskRun!.status).toBe('failed');
    },
    TIMEOUT_MS
  );
});

describe('integration: mcp-tool-integration-test task', () => {
  let tempOutputDir: string;

  afterAll(async () => {
    if (tempOutputDir) {
      await rm(tempOutputDir, { recursive: true, force: true });
    }
  });

  it(
    'runs the integration-test tag and records a successful task run',
    async () => {
      tempOutputDir = await mkdtemp(
        join(tmpdir(), 'claude-tasks-integration-')
      );

      await run(['integration-test'], TASK_DIR, tempOutputDir);

      const summaryRaw = await readFile(
        join(tempOutputDir, 'task-runs.json'),
        'utf-8'
      );
      const summary = JSON.parse(summaryRaw) as {
        taskRuns: Array<{ taskName: string; status: string }>;
      };

      expect(summary.taskRuns.length).toBeGreaterThanOrEqual(1);

      const taskRun = summary.taskRuns.find(
        (r) => r.taskName === 'mcp-tool-integration-test'
      );
      expect(taskRun).toBeDefined();
      expect(taskRun!.status).toBe('success');
    },
    TIMEOUT_MS
  );
});
