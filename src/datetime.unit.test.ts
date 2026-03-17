import { describe, it, expect } from 'vitest';
import { formatLocalISO, formatDirDatetime } from './datetime.js';

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
