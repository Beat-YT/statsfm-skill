export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatTime(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return `${hours.toLocaleString()}h ${remaining}m`;
  }
  return `${mins.toLocaleString()} min`;
}

export function formatArtists(artists: { name: string }[]): string {
  if (!artists?.length) return '?';
  return artists.map(a => a.name ?? '?').join(', ');
}

export function getAlbumName(track: { albums?: { name: string }[] }): string {
  return track.albums?.[0]?.name ?? '?';
}

export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function printTable(rows: string[][], maxWidth = 40): void {
  if (!rows.length) return;
  const widths = rows[0].map((_, i) =>
    Math.min(Math.max(...rows.map(r => (r[i] ?? '').length)), maxWidth)
  );
  for (const row of rows) {
    const parts = row.map((cell, i) => {
      const truncated = cell.length > widths[i] ? cell.slice(0, widths[i]) : cell;
      return i === row.length - 1 ? truncated : truncated.padEnd(widths[i]);
    });
    console.log(parts.join('  '));
  }
}

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function sparkline(values: number[]): string {
  if (!values.length) return '';
  const max = Math.max(...values);
  if (max <= 0) return ' '.repeat(values.length);
  return values
    .map(v => {
      if (v <= 0) return ' ';
      const idx = Math.min(SPARK_CHARS.length - 1, Math.round((v / max) * (SPARK_CHARS.length - 1)));
      return SPARK_CHARS[idx];
    })
    .join('');
}

export function parseDate(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 1) return Date.UTC(parts[0], 0, 1);
  if (parts.length === 2) return Date.UTC(parts[0], parts[1] - 1, 1);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

const RANGE_MAP: Record<string, string> = {
  today: 'today', '1d': 'today',
  '4w': 'weeks', '4weeks': 'weeks',
  '6m': 'months', '6months': 'months',
  all: 'lifetime', lifetime: 'lifetime',
};

const DURATION_DAYS: Record<string, number> = {
  '7d': 7, '14d': 14, '30d': 30, '90d': 90,
};

import { Range, type QueryWithRange, type QueryWithDates } from '@statsfm/statsfm.js';

export function buildDateOptions(opts: {
  range?: string;
  start?: string;
  end?: string;
}): QueryWithRange | QueryWithDates {
  if (opts.start) {
    const result: QueryWithDates = { after: parseDate(opts.start) };
    if (opts.end) result.before = parseDate(opts.end);
    return result;
  }

  const range = opts.range ?? '4w';
  const lower = range.toLowerCase();

  if (DURATION_DAYS[lower]) {
    const now = Date.now();
    return { after: now - DURATION_DAYS[lower] * 86400000, before: now } as QueryWithDates;
  }

  const mapped = RANGE_MAP[lower];
  if (!mapped) {
    const valid = [...Object.keys(RANGE_MAP), ...Object.keys(DURATION_DAYS)].sort();
    console.error(`Unknown range '${range}'. Valid: ${valid.join(', ')}`);
    process.exit(1);
  }
  return { range: mapped as Range };
}

export function describeRange(dateOpts: QueryWithRange | QueryWithDates): string {
  if ('range' in dateOpts && dateOpts.range) {
    return dateOpts.range;
  }
  const dates = dateOpts as QueryWithDates;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const after = dates.after !== undefined ? fmt(dates.after) : '?';
  const before = dates.before !== undefined ? fmt(dates.before) : 'now';
  return `${after} → ${before}`;
}

export function groupByMonth(days: Record<string, { count: number; durationMs: number }>): Map<string, { count: number; durationMs: number }> {
  const monthly = new Map<string, { count: number; durationMs: number }>();
  for (const [dateStr, stats] of Object.entries(days)) {
    if (!stats.count) continue;
    const key = dateStr.slice(0, 7);
    const existing = monthly.get(key) ?? { count: 0, durationMs: 0 };
    existing.count += stats.count;
    existing.durationMs += stats.durationMs;
    monthly.set(key, existing);
  }
  return new Map([...monthly.entries()].sort());
}

export function groupByWeek(days: Record<string, { count: number; durationMs: number }>): Map<string, { count: number; durationMs: number; start: Date }> {
  const weekly = new Map<string, { count: number; durationMs: number; start: Date }>();
  for (const [dateStr, stats] of Object.entries(days)) {
    if (!stats.count) continue;
    const dt = new Date(dateStr);
    const day = dt.getDay();
    const weekStart = new Date(dt);
    weekStart.setDate(dt.getDate() - ((day + 6) % 7));
    const isoYear = dt.getFullYear();
    const weekNum = getISOWeek(dt);
    const key = `${isoYear}-W${weekNum.toString().padStart(2, '0')}`;
    const existing = weekly.get(key) ?? { count: 0, durationMs: 0, start: weekStart };
    existing.count += stats.count;
    existing.durationMs += stats.durationMs;
    if (weekStart < existing.start) existing.start = weekStart;
    weekly.set(key, existing);
  }
  return new Map([...weekly.entries()].sort());
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function groupByDay(days: Record<string, { count: number; durationMs: number }>): Map<string, { count: number; durationMs: number }> {
  const daily = new Map<string, { count: number; durationMs: number }>();
  for (const [dateStr, stats] of Object.entries(days)) {
    if (!stats.count) continue;
    const key = dateStr.slice(0, 10);
    daily.set(key, stats);
  }
  return new Map([...daily.entries()].sort());
}

export function groupByYear(days: Record<string, { count: number; durationMs: number }>): Map<string, { count: number; durationMs: number }> {
  const yearly = new Map<string, { count: number; durationMs: number }>();
  for (const [dateStr, stats] of Object.entries(days)) {
    if (!stats.count) continue;
    const key = dateStr.slice(0, 4);
    const existing = yearly.get(key) ?? { count: 0, durationMs: 0 };
    existing.count += stats.count;
    existing.durationMs += stats.durationMs;
    yearly.set(key, existing);
  }
  return new Map([...yearly.entries()].sort());
}

export function showBreakdown(
  days: Record<string, { count: number; durationMs: number }>,
  granularity: string,
  limit?: number
): void {
  if (granularity === 'daily') {
    const grouped = groupByDay(days);
    let entries = [...grouped.entries()];
    if (limit) entries = entries.slice(-limit);
    console.log('Daily breakdown:');
    for (const [date, stats] of entries) {
      const day = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
      console.log(`  ${date} (${day}): ${stats.count.toString().padStart(4)} plays  (${formatTime(stats.durationMs)})`);
    }
  } else if (granularity === 'weekly') {
    const grouped = groupByWeek(days);
    let entries = [...grouped.entries()];
    if (limit) entries = entries.slice(-limit);
    console.log('Weekly breakdown:');
    for (const [week, stats] of entries) {
      const startStr = stats.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      console.log(`  ${week} (${startStr}): ${stats.count.toString().padStart(4)} plays  (${formatTime(stats.durationMs)})`);
    }
  } else if (granularity === 'yearly') {
    const grouped = groupByYear(days);
    let entries = [...grouped.entries()];
    if (limit) entries = entries.slice(-limit);
    console.log('Yearly breakdown:');
    for (const [year, stats] of entries) {
      console.log(`  ${year}: ${stats.count.toString().padStart(6)} plays (${formatTime(stats.durationMs)})`);
    }
  } else {
    const grouped = groupByMonth(days);
    let entries = [...grouped.entries()];
    if (limit) entries = entries.slice(-limit);
    console.log('Monthly breakdown:');
    for (const [month, stats] of entries) {
      console.log(`  ${month}: ${stats.count.toString().padStart(4)} plays  (${formatTime(stats.durationMs)})`);
    }
  }
}
