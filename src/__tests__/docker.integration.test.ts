import { describe, it, expect, afterAll } from 'vitest';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const IMAGE = 'claude-tasks:local';
const TASK_DIR = resolve('./tasks');
const TIMEOUT_MS = 120_000;

describe('integration: docker runner', () => {
  let tempOutputDir: string;

  afterAll(async () => {
    if (tempOutputDir) {
      await rm(tempOutputDir, { recursive: true, force: true });
    }
  });

  it(
    'runs docker-test tasks and records successful task runs',
    async () => {
      tempOutputDir = await mkdtemp(join(tmpdir(), 'claude-tasks-docker-'));
      const claudeConfigDir = join(homedir(), '.config', 'claude');

      const result = spawnSync(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${TASK_DIR}:/tasks:ro`,
          '-v',
          `${tempOutputDir}:/output`,
          '-v',
          `${claudeConfigDir}:/home/node/.config/claude:ro`,
          IMAGE,
          'docker-test',
        ],
        { encoding: 'utf-8', timeout: TIMEOUT_MS }
      );

      if (result.status !== 0) {
        throw new Error(`docker run failed (exit ${result.status}):\n${result.stderr}`);
      }

      const summaryRaw = await readFile(join(tempOutputDir, 'task-runs.json'), 'utf-8');
      const summary = JSON.parse(summaryRaw) as {
        taskRuns: Array<{ taskName: string; status: string }>;
      };

      expect(summary.taskRuns.length).toBeGreaterThanOrEqual(1);

      const mcpRun = summary.taskRuns.find((r) => r.taskName === 'docker-mcp-test');
      expect(mcpRun).toBeDefined();
      expect(mcpRun!.status).toBe('success');
    },
    TIMEOUT_MS
  );
});
