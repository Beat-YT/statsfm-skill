import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { printTable } from '../utils/format.js';
import { Range } from '@statsfm/statsfm.js';

const RANGE_MAP: Record<string, Range> = {
  today: Range.TODAY, '1d': Range.TODAY,
  '4w': Range.WEEKS, '4weeks': Range.WEEKS,
  '6m': Range.MONTHS, '6months': Range.MONTHS,
  all: Range.LIFETIME, lifetime: Range.LIFETIME,
};

export function registerCharts(program: Command): void {
  program
    .command('charts <type>')
    .description('Show global top charts (tracks, artists, albums)')
    .option('-r, --range <range>', 'Time range', 'today')
    .option('-l, --limit <n>', 'Number of results', '15')
    .action(async (type: string, opts: { range: string; limit: string }) => {
      const api = getApi();
      const limit = parseInt(opts.limit);
      const range = RANGE_MAP[opts.range.toLowerCase()];
      if (!range) {
        console.error(`Unknown range '${opts.range}'. Valid: ${Object.keys(RANGE_MAP).join(', ')}`);
        process.exit(1);
      }

      if (type === 'tracks') {
        const items = await api.charts.topTracks({ range });
        if (!items?.length) { console.log('No chart data found.'); return; }
        const rows = items.slice(0, limit).map(item => {
          const t = item.track;
          const artist = t.artists?.[0]?.name ?? '?';
          const album = t.albums?.[0]?.name ?? '?';
          return [`${item.position.toString().padStart(3)}.`, t.name, artist, album, `${item.streams} streams`];
        });
        printTable(rows);
      } else if (type === 'artists') {
        const items = await api.charts.topArtists({ range });
        if (!items?.length) { console.log('No chart data found.'); return; }
        const rows = items.slice(0, limit).map(item => {
          const a = item.artist;
          const genres = `[${(a.genres ?? []).slice(0, 2).join(', ')}]`;
          return [`${item.position.toString().padStart(3)}.`, a.name, `${item.streams} streams`, genres];
        });
        printTable(rows);
      } else if (type === 'albums') {
        const items = await api.charts.topAlbums({ range });
        if (!items?.length) { console.log('No chart data found.'); return; }
        const rows = items.slice(0, limit).map(item => {
          const a = item.album;
          const artist = a.artists?.[0]?.name ?? '?';
          return [`${item.position.toString().padStart(3)}.`, a.name, artist, `${item.streams} streams`];
        });
        printTable(rows);
      } else {
        console.error(`Unknown chart type: ${type}. Use: tracks, artists, albums`);
        process.exit(1);
      }
    });
}
