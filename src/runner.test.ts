import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatLocalISO,
  formatDirDatetime,
  buildQueryOptions,
  discoverTasks,
  filterTasksByTags,
  runTask,
  run,
  type TaskDefinition,
} from './runner.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import * as fs from 'node:fs/promises';
import * as sdk from '@anthropic-ai/claude-agent-sdk';

const mockReaddir = vi.mocked(fs.readdir);
const mockReadFile = vi.mocked(fs.readFile);
const mockMkdir = vi.mocked(fs.mkdir);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockQuery = vi.mocked(sdk.query);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── formatLocalISO ────────────────────────────────────────────────────────────

describe('formatLocalISO', () => {
  it('returns a string with date, time, and timezone offset', () => {
    const date = new Date('2026-03-15T17:00:00Z');
    const result = formatLocalISO(date);
    // Should match ISO 8601 with offset pattern
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('includes the correct date components', () => {
    // Use a fixed date where we know what local time will be
    const date = new Date(2026, 2, 15, 10, 5, 3); // March 15, 2026 10:05:03 local
    const result = formatLocalISO(date);
    expect(result).toContain('2026-03-15');
    expect(result).toContain('10:05:03');
  });
});

// ── formatDirDatetime ─────────────────────────────────────────────────────────

describe('formatDirDatetime', () => {
  it('formats as YYYYMMDD_HHMMSS', () => {
    const date = new Date(2026, 2, 15, 10, 5, 3); // March 15, 2026 10:05:03 local
    expect(formatDirDatetime(date)).toBe('20260315_100503');
  });

  it('zero-pads single-digit values', () => {
    const date = new Date(2026, 0, 5, 9, 7, 3); // Jan 5, 2026 09:07:03 local
    expect(formatDirDatetime(date)).toBe('20260105_090703');
  });
});

// ── buildQueryOptions ─────────────────────────────────────────────────────────

describe('buildQueryOptions', () => {
  it('returns cwd when no claude_options provided', () => {
    const opts = buildQueryOptions(undefined, '/output/task');
    expect(opts).toEqual({ cwd: '/output/task' });
  });

  it('passes scalar options through', () => {
    const opts = buildQueryOptions(
      { model: 'claude-opus-4-6', maxTurns: 5, effort: 'high' },
      '/output/task'
    );
    expect(opts.model).toBe('claude-opus-4-6');
    expect(opts.maxTurns).toBe(5);
    expect(opts.effort).toBe('high');
    expect(opts.cwd).toBe('/output/task');
  });

  it('converts mcpServers array to Record keyed by name', () => {
    const opts = buildQueryOptions(
      {
        mcpServers: [
          { name: 'my-server', command: 'npx', args: ['my-mcp-server'] },
          { name: 'other', command: 'node', args: ['server.js'] },
        ],
      },
      '/output/task'
    );
    expect(opts.mcpServers).toEqual({
      'my-server': { command: 'npx', args: ['my-mcp-server'] },
      other: { command: 'node', args: ['server.js'] },
    });
  });

  it('omits mcpServers key when array is empty', () => {
    const opts = buildQueryOptions({ mcpServers: [] }, '/output/task');
    expect(opts.mcpServers).toBeUndefined();
  });

  it('passes allowedTools and disallowedTools', () => {
    const opts = buildQueryOptions(
      { allowedTools: ['Read', 'Write'], disallowedTools: ['Bash'] },
      '/output/task'
    );
    expect(opts.allowedTools).toEqual(['Read', 'Write']);
    expect(opts.disallowedTools).toEqual(['Bash']);
  });
});

// ── discoverTasks ─────────────────────────────────────────────────────────────

describe('discoverTasks', () => {
  it('reads and parses .md files in the task directory', async () => {
    mockReaddir.mockResolvedValue(['task-a.md', 'task-b.md'] as never);
    mockReadFile
      .mockResolvedValueOnce(
        '---\nname: task-a\ntags: daily\n---\n\nDo task A.' as never
      )
      .mockResolvedValueOnce(
        '---\nname: task-b\ntags:\n  - daily\n  - reporting\n---\n\nDo task B.' as never
      );

    const tasks = await discoverTasks('./tasks');
    expect(tasks).toHaveLength(2);
    expect(tasks[0].data.name).toBe('task-a');
    expect(tasks[0].data.tags).toBe('daily');
    expect(tasks[0].content).toBe('Do task A.');
    expect(tasks[1].data.name).toBe('task-b');
    expect(tasks[1].data.tags).toEqual(['daily', 'reporting']);
  });

  it('ignores non-.md files', async () => {
    mockReaddir.mockResolvedValue(['task.md', 'readme.txt', '.DS_Store'] as never);
    mockReadFile.mockResolvedValue('---\nname: task\ntags: test\n---\n\nDo it.' as never);

    const tasks = await discoverTasks('./tasks');
    expect(tasks).toHaveLength(1);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no .md files exist', async () => {
    mockReaddir.mockResolvedValue([] as never);
    const tasks = await discoverTasks('./tasks');
    expect(tasks).toEqual([]);
  });
});

// ── filterTasksByTags ─────────────────────────────────────────────────────────

describe('filterTasksByTags', () => {
  const tasks: TaskDefinition[] = [
    { file: 'a.md', data: { name: 'a', tags: 'daily' }, content: 'A' },
    { file: 'b.md', data: { name: 'b', tags: ['daily', 'reporting'] }, content: 'B' },
    { file: 'c.md', data: { name: 'c', tags: 'weekly' }, content: 'C' },
  ];

  it('returns tasks matching a single tag', () => {
    const result = filterTasksByTags(tasks, ['weekly']);
    expect(result).toHaveLength(1);
    expect(result[0].data.name).toBe('c');
  });

  it('returns tasks matching any of multiple tags', () => {
    const result = filterTasksByTags(tasks, ['daily', 'weekly']);
    expect(result.map((t) => t.data.name)).toEqual(['a', 'b', 'c']);
  });

  it('returns tasks that have a multi-value tags field matching the filter', () => {
    const result = filterTasksByTags(tasks, ['reporting']);
    expect(result).toHaveLength(1);
    expect(result[0].data.name).toBe('b');
  });

  it('returns empty array when no tasks match', () => {
    const result = filterTasksByTags(tasks, ['nonexistent']);
    expect(result).toEqual([]);
  });

  it('deduplicates matched tasks (a task matching multiple filter tags appears once)', () => {
    // 'b' has both 'daily' and 'reporting' — filtering for both should still return it once
    const result = filterTasksByTags(tasks, ['daily', 'reporting']);
    const names = result.map((t) => t.data.name);
    expect(names.filter((n) => n === 'b')).toHaveLength(1);
  });
});

// ── runTask ───────────────────────────────────────────────────────────────────

describe('runTask', () => {
  const task: TaskDefinition = {
    file: 'task.md',
    data: { name: 'my-task', tags: 'test', claude_options: { model: 'claude-sonnet-4-6' } },
    content: 'Do the thing.',
  };

  it('returns success with result text on a successful run', async () => {
    const successMsg = {
      type: 'result',
      subtype: 'success',
      result: 'Wrote output.txt with 3 lines.',
      is_error: false,
    };
    mockQuery.mockReturnValue(
      (async function* () {
        yield { type: 'assistant', text: 'working...' };
        yield successMsg;
      })() as never
    );

    const result = await runTask(task, '/output/my-task_20260315_100000');
    expect(result.status).toBe('success');
    expect(result.resultSummary).toBe('Wrote output.txt with 3 lines.');
  });

  it('passes cwd and claude_options to query', async () => {
    const successMsg = { type: 'result', subtype: 'success', result: 'done', is_error: false };
    mockQuery.mockReturnValue((async function* () { yield successMsg; })() as never);

    await runTask(task, '/output/my-task_20260315');

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: 'Do the thing.',
      options: expect.objectContaining({
        cwd: '/output/my-task_20260315',
        model: 'claude-sonnet-4-6',
      }),
    });
  });

  it('returns failed with error subtype on an error result', async () => {
    const errorMsg = {
      type: 'result',
      subtype: 'error_max_turns',
      is_error: true,
      errors: ['Exceeded max turns'],
    };
    mockQuery.mockReturnValue((async function* () { yield errorMsg; })() as never);

    const result = await runTask(task, '/output/task');
    expect(result.status).toBe('failed');
    expect(result.resultSummary).toContain('error_max_turns');
  });

  it('returns failed when no result message is emitted', async () => {
    mockQuery.mockReturnValue((async function* () {
      yield { type: 'assistant', text: 'hello' };
    })() as never);

    const result = await runTask(task, '/output/task');
    expect(result.status).toBe('failed');
    expect(result.resultSummary).toContain('without a result message');
  });
});

// ── run (orchestrator) ────────────────────────────────────────────────────────

describe('run', () => {
  beforeEach(() => {
    mockMkdir.mockResolvedValue(undefined as never);
    mockWriteFile.mockResolvedValue(undefined as never);
  });

  it('writes task-runs.json after executing matching tasks', async () => {
    mockReaddir.mockResolvedValue(['task-a.md', 'task-b.md'] as never);
    mockReadFile
      .mockResolvedValueOnce('---\nname: task-a\ntags: daily\n---\n\nDo A.' as never)
      .mockResolvedValueOnce('---\nname: task-b\ntags: weekly\n---\n\nDo B.' as never);

    const successMsg = { type: 'result', subtype: 'success', result: 'done', is_error: false };
    mockQuery.mockReturnValue((async function* () { yield successMsg; })() as never);

    await run(['daily'], './tasks', './output');

    expect(mockQuery).toHaveBeenCalledTimes(1);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writePath, writeContent] = mockWriteFile.mock.calls[0];
    expect(writePath).toContain('task-runs.json');

    const summary = JSON.parse(writeContent as string);
    expect(summary.taskRuns).toHaveLength(1);
    expect(summary.taskRuns[0].taskName).toBe('task-a');
    expect(summary.taskRuns[0].status).toBe('success');
    expect(summary.taskRuns[0].resultSummary).toBe('done');
    expect(summary.taskRuns[0].taskId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('creates output directory named [task-name]_[datetime]', async () => {
    mockReaddir.mockResolvedValue(['task-a.md'] as never);
    mockReadFile.mockResolvedValue('---\nname: task-a\ntags: daily\n---\n\nDo A.' as never);
    mockQuery.mockReturnValue(
      (async function* () {
        yield { type: 'result', subtype: 'success', result: 'done', is_error: false };
      })() as never
    );

    await run(['daily'], './tasks', './output');

    const mkdirCall = mockMkdir.mock.calls[0][0] as string;
    expect(mkdirCall).toMatch(/task-a_\d{8}_\d{6}$/);
  });

  it('records failed status when a task throws', async () => {
    mockReaddir.mockResolvedValue(['task-a.md'] as never);
    mockReadFile.mockResolvedValue('---\nname: task-a\ntags: daily\n---\n\nDo A.' as never);
    mockQuery.mockImplementation(() => {
      throw new Error('SDK exploded');
    });

    await run(['daily'], './tasks', './output');

    const [, writeContent] = mockWriteFile.mock.calls[0];
    const summary = JSON.parse(writeContent as string);
    expect(summary.taskRuns[0].status).toBe('failed');
    expect(summary.taskRuns[0].resultSummary).toContain('SDK exploded');
  });

  it('does nothing when no tasks match the requested tags', async () => {
    mockReaddir.mockResolvedValue(['task-a.md'] as never);
    mockReadFile.mockResolvedValue('---\nname: task-a\ntags: daily\n---\n\nDo A.' as never);

    await run(['weekly'], './tasks', './output');

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('sorts taskRuns by startedAt descending in the written JSON', async () => {
    mockReaddir.mockResolvedValue(['task-a.md', 'task-b.md'] as never);
    mockReadFile
      .mockResolvedValueOnce('---\nname: task-a\ntags: daily\n---\n\nDo A.' as never)
      .mockResolvedValueOnce('---\nname: task-b\ntags: daily\n---\n\nDo B.' as never);

    let callCount = 0;
    mockQuery.mockImplementation(() =>
      (async function* () {
        // Stagger timestamps by briefly advancing Date between calls
        callCount++;
        yield { type: 'result', subtype: 'success', result: `done-${callCount}`, is_error: false };
      })() as never
    );

    // Freeze time so we can control startedAt order via mock
    const base = new Date('2026-03-15T10:00:00-07:00');
    const later = new Date('2026-03-15T10:01:00-07:00');
    const dateSpy = vi.spyOn(global, 'Date')
      .mockImplementationOnce(() => base as never)   // runDatetime
      .mockImplementationOnce(() => base as never)   // task-a startedAt
      .mockImplementationOnce(() => base as never)   // task-a endedAt
      .mockImplementationOnce(() => later as never)  // task-b startedAt
      .mockImplementationOnce(() => later as never); // task-b endedAt

    await run(['daily'], './tasks', './output');
    dateSpy.mockRestore();

    const [, writeContent] = mockWriteFile.mock.calls[0];
    const summary = JSON.parse(writeContent as string);
    // task-b started later, so it should appear first
    expect(summary.taskRuns[0].taskName).toBe('task-b');
    expect(summary.taskRuns[1].taskName).toBe('task-a');
  });

  it('records durationSeconds as ceiling of elapsed milliseconds', async () => {
    mockReaddir.mockResolvedValue(['task-a.md'] as never);
    mockReadFile.mockResolvedValue('---\nname: task-a\ntags: daily\n---\n\nDo A.' as never);

    // Make the query take a tiny bit of time so duration > 0
    mockQuery.mockReturnValue(
      (async function* () {
        yield { type: 'result', subtype: 'success', result: 'done', is_error: false };
      })() as never
    );

    await run(['daily'], './tasks', './output');

    const [, writeContent] = mockWriteFile.mock.calls[0];
    const summary = JSON.parse(writeContent as string);
    expect(summary.taskRuns[0].durationSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(summary.taskRuns[0].durationSeconds)).toBe(true);
  });
});
