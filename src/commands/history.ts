import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { buildDateOptions, formatTime, getTimezone, showBreakdown } from '../utils/format.js';
import type { PerDayStats, DateStats, StreamStats } from '@statsfm/statsfm.js';

interface HistoryOpts {
  user: string;
  start?: string;
  end?: string;
  granularity: string;
  limit?: string;
}

function sumDays(perDay: PerDayStats): { totalCount: number; totalMs: number } {
  const days = perDay.days ?? {};
  let totalCount = 0;
  let totalMs = 0;
  for (const stats of Object.values(days)) {
    totalCount += stats.count ?? 0;
    totalMs += stats.durationMs ?? 0;
  }
  return { totalCount, totalMs };
}

export function registerHistory(program: Command): void {
  program
    .command('artist-history <artistId>')
    .aliases(['artist-stats'])
    .description('Show play history for a specific artist')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('--start <date>', 'Start date (YYYY, YYYY-MM, YYYY-MM-DD)')
    .option('--end <date>', 'End date')
    .option('-g, --granularity <g>', 'monthly, weekly, daily, yearly', 'monthly')
    .option('-l, --limit <n>', 'Limit to most recent N periods')
    .action(async (artistId: string, opts: HistoryOpts) => {
      const api = getApi();
      const tz = getTimezone();
      const dateOpts = opts.start ? buildDateOptions(opts) : {};

      const [artistData, perDay] = await Promise.all([
        api.artists.get(parseInt(artistId)),
        api.users.artistPerDayStats(opts.user, parseInt(artistId), tz, dateOpts),
      ]);

      const genres = artistData.genres?.join(', ') ?? '';
      const followers = artistData.followers?.toLocaleString() ?? '?';
      console.log(`${artistData.name}  [${genres}]  ${followers} followers`);
      console.log();

      const { totalCount, totalMs } = sumDays(perDay);
      console.log(`Total: ${totalCount} plays  (${formatTime(totalMs)})`);
      console.log();
      showBreakdown(perDay.days, opts.granularity, opts.limit ? parseInt(opts.limit) : undefined);
    });

  program
    .command('track-history <trackId>')
    .aliases(['track-stats'])
    .description('Show play history for a specific track')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('--start <date>', 'Start date')
    .option('--end <date>', 'End date')
    .option('-g, --granularity <g>', 'monthly, weekly, daily, yearly', 'monthly')
    .option('-l, --limit <n>', 'Limit to most recent N periods')
    .action(async (trackId: string, opts: HistoryOpts) => {
      const api = getApi();
      const tz = getTimezone();
      const dateOpts = opts.start ? buildDateOptions(opts) : {};

      const [trackData, perDay] = await Promise.all([
        api.tracks.get(parseInt(trackId)),
        api.users.trackPerDayStats(opts.user, parseInt(trackId), tz, dateOpts),
      ]);

      const artists = trackData.artists?.map(a => a.name).join(', ') ?? '?';
      const album = trackData.albums?.[0];
      console.log(`Track: ${trackData.name}`);
      console.log(`Artist: ${artists}`);
      if (album) console.log(`Album: ${album.name} (#${album.id})`);
      console.log();

      const { totalCount, totalMs } = sumDays(perDay);
      console.log(`Total: ${totalCount} plays  (${formatTime(totalMs)})`);
      console.log();
      showBreakdown(perDay.days, opts.granularity, opts.limit ? parseInt(opts.limit) : undefined);
    });

  program
    .command('album-history <albumId>')
    .aliases(['album-stats'])
    .description('Show play history for a specific album')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('--start <date>', 'Start date')
    .option('--end <date>', 'End date')
    .option('-g, --granularity <g>', 'monthly, weekly, daily, yearly', 'monthly')
    .option('-l, --limit <n>', 'Limit to most recent N periods')
    .action(async (albumId: string, opts: HistoryOpts) => {
      const api = getApi();
      const tz = getTimezone();
      const dateOpts = opts.start ? buildDateOptions(opts) : {};

      const perDay = await api.users.albumPerDayStats(opts.user, parseInt(albumId), tz, dateOpts);

      const { totalCount, totalMs } = sumDays(perDay);
      console.log(`Total: ${totalCount} plays  (${formatTime(totalMs)})`);
      console.log();
      showBreakdown(perDay.days, opts.granularity, opts.limit ? parseInt(opts.limit) : undefined);
    });

  program
    .command('listening-history')
    .aliases(['history'])
    .description('Show overall listening history breakdown')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('--start <date>', 'Start date')
    .option('--end <date>', 'End date')
    .option('-g, --granularity <g>', 'monthly, yearly', 'yearly')
    .option('-l, --limit <n>', 'Max results')
    .action(async (opts: HistoryOpts) => {
      const api = getApi();
      const tz = getTimezone();
      const dateOpts = opts.start ? buildDateOptions(opts) : {};

      const dateStats = await api.users.perDayStats(opts.user, { ...dateOpts, timeZone: tz }) as unknown as DateStats;

      const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      if (opts.granularity === 'monthly') {
        const months = dateStats.months ?? {};
        const entries = Object.entries(months)
          .map(([k, v]) => [parseInt(k), v] as [number, StreamStats])
          .sort((a, b) => a[0] - b[0]);
        const limited = opts.limit ? entries.slice(-parseInt(opts.limit)) : entries;
        console.log('Monthly breakdown (aggregated across all years):');
        for (const [month, stats] of limited) {
          const label = MONTH_NAMES[month - 1] ?? month.toString();
          console.log(`  ${label}: ${stats.count.toString().padStart(6)} plays  (${formatTime(stats.durationMs)})`);
        }
      } else {
        const years = dateStats.years ?? {};
        const entries = Object.entries(years)
          .map(([k, v]) => [k, v] as [string, StreamStats])
          .sort((a, b) => a[0].localeCompare(b[0]));
        const limited = opts.limit ? entries.slice(-parseInt(opts.limit)) : entries;

        let totalCount = 0;
        let totalMs = 0;
        for (const [, stats] of entries) {
          totalCount += stats.count;
          totalMs += stats.durationMs;
        }
        console.log(`Total: ${totalCount.toLocaleString()} streams  (${formatTime(totalMs)})`);
        console.log();

        console.log('Yearly breakdown:');
        for (const [year, stats] of limited) {
          console.log(`  ${year}: ${stats.count.toString().padStart(6)} plays  (${formatTime(stats.durationMs)})`);
        }
      }
    });
}
