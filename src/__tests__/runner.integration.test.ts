import { describe, it, expect, afterAll } from 'vitest';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './runner.js';

const TASK_DIR = './tasks';
const TIMEOUT_MS = 60_000;

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
