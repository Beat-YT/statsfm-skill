import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { formatDuration, formatArtists, printTable } from '../utils/format.js';

export function registerLookup(program: Command): void {
  program
    .command('artist <artistId>')
    .description('Show artist info and discography')
    .option('-t, --type <type>', 'album, single, or all', 'album')
    .option('-l, --limit <n>', 'Items per section', '15')
    .action(async (artistId: string, opts: { type: string; limit: string }) => {
      const api = getApi();
      const id = parseInt(artistId);
      const [artist, allAlbums] = await Promise.all([
        api.artists.get(id),
        api.artists.albums(id),
      ]);

      const genres = artist.genres?.join(', ') ?? '';
      const followers = artist.followers?.toLocaleString() ?? '?';

      console.log(`${artist.name}  #${id}`);
      if (genres) console.log(`Genre: ${genres}`);
      console.log(`Followers: ${followers}`);

      if (!allAlbums?.length) {
        console.log('\nNo albums found.');
        return;
      }

      const seen = new Set<number>();
      const unique = allAlbums.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      }).sort((a, b) => ((b.releaseDate as number) ?? 0) - ((a.releaseDate as number) ?? 0));

      const groups = new Map<string, typeof unique>();
      for (const a of unique) {
        const t = a.type ?? 'other';
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t)!.push(a);
      }

      const limit = parseInt(opts.limit);
      const typeOrder: [string, string][] = [
        ['album', 'Albums'],
        ['single', 'Singles & EPs'],
        ['compilation', 'Compilations'],
      ];
      const showTypes = opts.type === 'all' ? typeOrder : typeOrder.filter(([k]) => k === opts.type);

      for (const [key, label] of showTypes) {
        const section = groups.get(key);
        if (!section?.length) continue;
        console.log(`\n${label}:`);
        const rows = section.slice(0, limit).map(album => {
          const releaseMs = album.releaseDate as number;
          const year = releaseMs ? new Date(releaseMs).getFullYear().toString() : '?';
          return [year, album.name, `${album.totalTracks ?? '?'} tracks`, `#${album.id}`];
        });
        printTable(rows);
        const remaining = section.length - limit;
        if (remaining > 0) console.log(`  (${remaining} more)`);
      }
    });

  program
    .command('album <albumId>')
    .description('Show album info and tracklist')
    .action(async (albumId: string) => {
      const api = getApi();
      const id = parseInt(albumId);
      const [album, tracks] = await Promise.all([
        api.albums.get(id),
        api.albums.tracks(id),
      ]);

      console.log(`${album.name}  #${id}`);
      for (const a of album.artists ?? []) {
        console.log(`Artist: ${a.name}  #${a.id}`);
      }
      const releaseMs = album.releaseDate as number;
      const releaseDate = releaseMs ? new Date(releaseMs).toISOString().slice(0, 10) : '?';
      console.log(`Released: ${releaseDate}  ${album.totalTracks ?? '?'} tracks`);
      if (album.label) console.log(`Label: ${album.label}`);
      if (album.genres?.length) console.log(`Genre: ${album.genres.join(', ')}`);
      console.log();

      if (!tracks?.length) {
        console.log('No tracks found.');
        return;
      }

      const rows = tracks.map((t, i) => {
        const tag = t.explicit ? ' [E]' : '';
        return [
          `${(i + 1).toString().padStart(2)}.`,
          t.name + tag,
          formatDuration(t.durationMs),
          `#${t.id}`,
        ];
      });
      printTable(rows);
    });

  program
    .command('track <trackId>')
    .description('Show track info')
    .action(async (trackId: string) => {
      const api = getApi();
      const track = await api.tracks.get(parseInt(trackId));

      const album = track.albums?.[0];
      const explicit = track.explicit ? ' [E]' : '';
      const spotifyIds = track.externalIds?.spotify as string[] | undefined;
      const spotifyUrl = spotifyIds?.length ? `https://open.spotify.com/track/${spotifyIds[0]}` : null;

      console.log(`${track.name}${explicit}  #${trackId}`);
      for (const a of track.artists ?? []) {
        console.log(`Artist: ${a.name}  #${a.id}`);
      }
      if (album) console.log(`Album: ${album.name}  #${album.id}`);
      console.log(`Duration: ${formatDuration(track.durationMs)}`);
      if (spotifyUrl) console.log(`Spotify: ${spotifyUrl}`);
    });
}
