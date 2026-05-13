import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { buildDateOptions, formatTime, printTable } from '../utils/format.js';
import type { v1 } from '@statsfm/statsfm.js';

interface TopOpts {
  user: string;
  range: string;
  start?: string;
  end?: string;
  limit: string;
  fromArtist?: string;
  fromAlbum?: string;
  raw?: boolean;
}

export function registerTop(program: Command): void {
  program
    .command('top <type>')
    .description('Show top artists/tracks/albums/genres')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('-r, --range <range>', 'Time range', '4w')
    .option('--start <date>', 'Start date (YYYY, YYYY-MM, YYYY-MM-DD)')
    .option('--end <date>', 'End date')
    .option('-l, --limit <n>', 'Number of results', '15')
    .option('--from-artist <id>', 'Top tracks/albums from a specific artist')
    .option('--from-album <id>', 'Top tracks from a specific album')
    .option('--raw', 'Disable table formatting')
    .action(async (type: string, opts: TopOpts) => {
      const api = getApi();
      const user = opts.user;
      const limit = parseInt(opts.limit);
      const dateOpts = buildDateOptions(opts);

      if (opts.fromArtist) {
        const artistId = parseInt(opts.fromArtist);
        if (type === 'tracks') {
          const items = await api.users.topTracksFromArtist(user, artistId, dateOpts);
          showTopTracks(items.slice(0, limit), opts.raw);
        } else if (type === 'albums') {
          const items = await api.users.topAlbumsFromArtist(user, artistId, dateOpts);
          showTopAlbums(items.slice(0, limit), opts.raw);
        } else {
          console.error(`--from-artist not supported for '${type}'`);
          process.exit(1);
        }
        return;
      }

      if (opts.fromAlbum) {
        const albumId = parseInt(opts.fromAlbum);
        if (type === 'tracks') {
          const items = await api.users.topTracksFromAlbums(user, albumId, dateOpts);
          showTopTracks(items.slice(0, limit), opts.raw);
        } else {
          console.error(`--from-album not supported for '${type}'`);
          process.exit(1);
        }
        return;
      }

      if (type === 'artists') {
        const items = await api.users.topArtists(user, dateOpts);
        if (!items?.length) { console.log('No data found.'); return; }
        const rows = items.slice(0, limit).map(item => {
          const a = item.artist;
          const genres = `[${(a.genres ?? []).slice(0, 2).join(', ')}]`;
          const row = [`${item.position.toString().padStart(3)}.`, a.name];
          if (item.playedMs) row.push(`${item.streams} plays`, `(${formatTime(item.playedMs)})`);
          row.push(genres, `#${a.id}`);
          return row;
        });
        if (opts.raw) {
          for (const row of rows) console.log(row.join('\t'));
        } else {
          printTable(rows);
        }
      } else if (type === 'tracks') {
        const items = await api.users.topTracks(user, dateOpts);
        showTopTracks(items?.slice(0, limit) ?? [], opts.raw);
      } else if (type === 'albums') {
        const items = await api.users.topAlbums(user, dateOpts);
        showTopAlbums(items?.slice(0, limit) ?? [], opts.raw);
      } else if (type === 'genres') {
        const items = await api.users.topGenres(user, dateOpts);
        if (!items?.length) { console.log('No data found.'); return; }
        const rows = items.slice(0, limit).map(item => {
          const row = [`${item.position.toString().padStart(3)}.`, item.genre.tag];
          if (item.playedMs) row.push(`${item.streams} plays`, `(${formatTime(item.playedMs)})`);
          return row;
        });
        if (opts.raw) {
          for (const row of rows) console.log(row.join('\t'));
        } else {
          printTable(rows);
        }
      } else {
        console.error(`Unknown type: ${type}. Use: artists, tracks, albums, genres`);
        process.exit(1);
      }
    });
}

function showTopTracks(items: v1.TopTrack[], raw?: boolean): void {
  if (!items?.length) { console.log('No data found.'); return; }
  const rows = items.map(item => {
    const t = item.track;
    const artist = t.artists?.[0]?.name ?? '?';
    const album = t.albums?.[0]?.name ?? '?';
    const row = [`${item.position.toString().padStart(3)}.`, t.name, artist, album];
    if (item.playedMs) row.push(`${item.streams} plays`, `(${formatTime(item.playedMs)})`);
    row.push(`#${t.id}`);
    return row;
  });
  if (raw) {
    for (const row of rows) console.log(row.join('\t'));
  } else {
    printTable(rows);
  }
}

function showTopAlbums(items: v1.TopAlbum[], raw?: boolean): void {
  if (!items?.length) { console.log('No data found.'); return; }
  const rows = items.map(item => {
    const a = item.album;
    const row = [`${item.position.toString().padStart(3)}.`, a.name];
    if (item.playedMs) row.push(`${item.streams} plays`, `(${formatTime(item.playedMs)})`);
    row.push(`#${a.id}`);
    return row;
  });
  if (raw) {
    for (const row of rows) console.log(row.join('\t'));
  } else {
    printTable(rows);
  }
}
