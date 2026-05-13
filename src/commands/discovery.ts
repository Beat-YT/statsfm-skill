import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { formatTime } from '../utils/format.js';
import type { Stream } from '@statsfm/statsfm.js';

interface FirstListenOpts {
  user: string;
  limit: string;
}

export function registerDiscovery(program: Command): void {
  program
    .command('first-listen <type> <entityId>')
    .aliases(['first'])
    .description('Show first streams for an artist, track, or album')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('-l, --limit <n>', 'Number of first streams', '5')
    .action(async (type: string, entityId: string, opts: FirstListenOpts) => {
      const api = getApi();
      const id = parseInt(entityId);
      const limit = parseInt(opts.limit);
      const user = opts.user;

      let items: Stream[];
      if (type === 'artist') {
        items = await api.users.artistStreams(user, id, { limit, order: 'asc' });
      } else if (type === 'track') {
        items = await api.users.trackStreams(user, id, { limit, order: 'asc' });
      } else if (type === 'album') {
        items = await api.users.albumStreams(user, id, { limit, order: 'asc' });
      } else {
        console.error(`Unknown type: ${type}. Use: artist, track, album`);
        process.exit(1);
      }

      if (!items?.length) {
        console.log('No streams found.');
        return;
      }

      let name: string;
      if (type === 'artist') {
        name = (await api.artists.get(id)).name;
      } else if (type === 'track') {
        const data = await api.tracks.get(id);
        const artists = data.artists?.map(a => a.name).join(', ') ?? '';
        name = artists ? `${data.name} by ${artists}` : data.name;
      } else {
        name = (await api.albums.get(id)).name;
      }

      console.log(`First streams: ${name}`);
      console.log();

      const albumNames = new Map<number, string>();
      if (type === 'artist') {
        const albumIds = [...new Set(items.map(s => s.albumId).filter(Boolean))];
        if (albumIds.length) {
          try {
            const albums = await api.albums.list(albumIds);
            for (const a of albums) albumNames.set(a.id, a.name);
          } catch { /* ignore */ }
        }
      }

      items.forEach((stream, i) => {
        const dt = new Date(stream.endTime);
        const timeStr = dt.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        });
        const duration = stream.playedMs ? formatTime(stream.playedMs) : '?';

        if (type === 'artist') {
          const albumStr = albumNames.get(stream.albumId) ? `  [${albumNames.get(stream.albumId)}]` : '';
          console.log(`  ${i + 1}. ${stream.trackName}${albumStr}  —  ${timeStr}  (${duration})  #${stream.trackId}`);
        } else if (type === 'album') {
          console.log(`  ${i + 1}. ${stream.trackName}  —  ${timeStr}  (${duration})  #${stream.trackId}`);
        } else {
          console.log(`  ${i + 1}. ${timeStr}  (${duration})`);
        }
      });
    });
}
