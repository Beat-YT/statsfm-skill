import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { buildDateOptions, formatDuration, formatTime } from '../utils/format.js';

interface StatsOpts {
  user: string;
  range: string;
  start?: string;
  end?: string;
}

export function registerStats(program: Command): void {
  program
    .command('stream-stats')
    .description('Show overall stream statistics')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('-r, --range <range>', 'Time range', '4w')
    .option('--start <date>', 'Start date')
    .option('--end <date>', 'End date')
    .action(async (opts: StatsOpts) => {
      const api = getApi();
      const dateOpts = buildDateOptions(opts);
      const stats = await api.users.stats(opts.user, dateOpts);

      const count = stats.count ?? 0;
      const ms = stats.durationMs ?? 0;

      console.log(`Streams: ${count.toLocaleString()}`);
      console.log(`Total time: ${formatTime(ms)}`);

      const card = stats.cardinality;
      if (card) {
        const parts: string[] = [];
        if (card.tracks) parts.push(`${card.tracks.toLocaleString()} tracks`);
        if (card.artists) parts.push(`${card.artists.toLocaleString()} artists`);
        if (card.albums) parts.push(`${card.albums.toLocaleString()} albums`);
        if (parts.length) console.log(`Unique: ${parts.join(', ')}`);
      }
    });
}
