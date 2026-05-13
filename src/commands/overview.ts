import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { buildDateOptions } from '../utils/format.js';

function compact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function registerOverview(program: Command): void {
  program
    .command('overview')
    .description('Full profile overview at a glance')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('-r, --range <range>', 'Time range', '4w')
    .option('--start <date>', 'Start date')
    .option('--end <date>', 'End date')
    .action(async (opts: { user: string; range: string; start?: string; end?: string }) => {
      const api = getApi();
      const user = opts.user;
      const dateOpts = buildDateOptions(opts);

      const [profile, np, stats, genres, artists, tracks, albums, recent] = await Promise.all([
        api.users.get(user),
        api.users.currentlyStreaming(user).catch(() => null),
        api.users.stats(user, dateOpts),
        api.users.topGenres(user, dateOpts),
        api.users.topArtists(user, dateOpts),
        api.users.topTracks(user, dateOpts),
        api.users.topAlbums(user, dateOpts),
        api.users.recentlyStreamed(user),
      ]);

      // Profile
      const badges: string[] = [];
      if (profile.isPlus) badges.push('Plus');
      if (profile.isPro) badges.push('Pro');
      if (!profile.isPlus && !profile.isPro) badges.push('Free');
      const pronouns = profile.profile?.pronouns ? ` (${profile.profile.pronouns})` : '';
      console.log(`${profile.displayName}${pronouns}  [${badges.join(' | ')}]`);
      if (profile.profile?.bio) console.log(`  ${profile.profile.bio}`);
      console.log();

      // Now playing
      if (np) {
        const t = np.track;
        const artist = t.artists?.[0]?.name ?? '?';
        const status = np.isPlaying ? '▶' : '⏸';
        const progress = Math.floor(np.progressMs / 1000);
        const duration = Math.floor(t.durationMs / 1000);
        const pStr = `${Math.floor(progress / 60)}:${(progress % 60).toString().padStart(2, '0')}`;
        const dStr = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
        console.log(`${status} ${t.name} — ${artist}  (${pStr}/${dStr})`);
      } else {
        console.log('Nothing playing.');
      }
      console.log();

      // Stats
      const count = stats.count ?? 0;
      const ms = stats.durationMs ?? 0;
      const card = stats.cardinality;
      const mins = Math.floor(ms / 60000);
      const parts = [`${compact(count)} streams`, `${compact(mins)} min`];
      if (card) {
        parts.push(`${compact(card.tracks)} tracks`, `${compact(card.artists)} artists`, `${compact(card.albums)} albums`);
      }
      console.log(parts.join('  •  '));
      console.log();

      // Genres
      if (genres?.length) {
        console.log('Genres: ' + genres.slice(0, 5).map(g => g.genre.tag).join(', '));
        console.log();
      }

      // Top artists
      if (artists?.length) {
        console.log('Top Artists:');
        for (const item of artists.slice(0, 5)) {
          const plays = item.playedMs ? `  ${item.streams} plays` : '';
          console.log(`  ${item.position}. ${item.artist.name}${plays}`);
        }
        console.log();
      }

      // Top tracks
      if (tracks?.length) {
        console.log('Top Tracks:');
        for (const item of tracks.slice(0, 5)) {
          const artist = item.track.artists?.[0]?.name ?? '?';
          const plays = item.playedMs ? `  ${item.streams} plays` : '';
          console.log(`  ${item.position}. ${item.track.name} — ${artist}${plays}`);
        }
        console.log();
      }

      // Top albums
      if (albums?.length) {
        console.log('Top Albums:');
        for (const item of albums.slice(0, 5)) {
          const artist = item.album.artists?.[0]?.name ?? '?';
          const plays = item.playedMs ? `  ${item.streams} plays` : '';
          console.log(`  ${item.position}. ${item.album.name} — ${artist}${plays}`);
        }
        console.log();
      }

      // Recent
      if (recent?.length) {
        console.log('Recently Played:');
        for (const stream of recent.slice(0, 5)) {
          const t = stream.track;
          const artist = t.artists?.[0]?.name ?? '?';
          const dt = new Date(stream.endTime);
          const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          console.log(`  ${time}  ${t.name} — ${artist}`);
        }
      }
    });
}
