import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import { buildDateOptions, describeRange } from '../utils/format.js';

function compact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timed out: ${label}`)), 15000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
        withTimeout(api.users.get(user), 'profile'),
        withTimeout(api.users.currentlyStreaming(user), 'now-playing').catch(() => null),
        withTimeout(api.users.stats(user, dateOpts), 'stats'),
        withTimeout(api.users.topGenres(user, dateOpts), 'genres'),
        withTimeout(api.users.topArtists(user, dateOpts), 'artists'),
        withTimeout(api.users.topTracks(user, dateOpts), 'tracks'),
        withTimeout(api.users.topAlbums(user, dateOpts), 'albums'),
        withTimeout(api.users.recentlyStreamed(user), 'recent').catch(() => null),
      ]);

      // Profile
      const tier = profile.isPlus ? 'Plus' : profile.isPro ? 'Pro' : 'Free';
      const pronouns = profile.profile?.pronouns ? ` (${profile.profile.pronouns})` : '';
      const tz = profile.timezone ?? '?';
      console.log(`${profile.displayName}${pronouns} [${tier}] tz=${tz}`);
      console.log(`Range: ${describeRange(dateOpts)}`);

      // Now playing
      if (np) {
        const t = np.track;
        const artist = t.artists?.[0]?.name ?? '?';
        const status = np.isPlaying ? 'playing' : 'paused';
        console.log(`Now Playing: ${t.name} — ${artist} (${status}) #${t.id}`);
      }

      // Stats + listener profile
      const count = stats.count ?? 0;
      const ms = stats.durationMs ?? 0;
      const card = stats.cardinality;
      const mins = Math.floor(ms / 60000);
      console.log(`Streams: ${count} / ${mins}min / ${card?.tracks ?? 0} unique tracks / ${card?.artists ?? 0} unique artists / ${card?.albums ?? 0} unique albums`);

      if (count > 0 && card && artists?.length) {
        const replayRate = (count / card.tracks).toFixed(1);
        const top5 = artists.slice(0, 5).reduce((s, a) => s + a.streams, 0);
        const top20 = artists.slice(0, 20).reduce((s, a) => s + a.streams, 0);
        const conc5 = (top5 / count * 100).toFixed(1);
        const conc20 = (top20 / count * 100).toFixed(1);
        const topShare = (artists[0].streams / count * 100).toFixed(1);
        console.log(`Profile: replay=${replayRate}x top5=${conc5}% top20=${conc20}% #1=${topShare}%`);
      }

      if (genres?.length) {
        console.log(`Genres: ${genres.slice(0, 5).map(g => g.genre.tag).join(', ')}`);
      }

      // Top artists
      if (artists?.length) {
        console.log('Top Artists:');
        for (const item of artists.slice(0, 5)) {
          const share = count > 0 ? `(${(item.streams / count * 100).toFixed(1)}%)` : '';
          const plays = item.playedMs ? `${item.streams} ${share}` : '';
          console.log(`  ${item.position}. ${item.artist.name}  ${plays}  #${item.artist.id}`);
        }
      }

      // Top tracks
      if (tracks?.length) {
        console.log('Top Tracks:');
        for (const item of tracks.slice(0, 5)) {
          const artist = item.track.artists?.[0]?.name ?? '?';
          const share = count > 0 ? `(${(item.streams / count * 100).toFixed(1)}%)` : '';
          const plays = item.playedMs ? `${item.streams} ${share}` : '';
          console.log(`  ${item.position}. ${item.track.name} — ${artist}  ${plays}  #${item.track.id}`);
        }
      }

      // Top albums
      if (albums?.length) {
        console.log('Top Albums:');
        for (const item of albums.slice(0, 5)) {
          const artist = item.album.artists?.[0]?.name ?? '?';
          const share = count > 0 ? `(${(item.streams / count * 100).toFixed(1)}%)` : '';
          const plays = item.playedMs ? `${item.streams} ${share}` : '';
          console.log(`  ${item.position}. ${item.album.name} — ${artist}  ${plays}  #${item.album.id}`);
        }
      }

      // Recent
      if (recent?.length) {
        console.log('Recent:');
        for (const stream of recent.slice(0, 5)) {
          const t = stream.track;
          const artist = t.artists?.[0]?.name ?? '?';
          const dt = new Date(stream.endTime);
          const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          console.log(`  ${time}  ${t.name} — ${artist}  #${t.id}`);
        }
      }

      process.exit(0);
    });
}
