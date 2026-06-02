import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import {
  formatDuration,
  formatTime,
  printTable,
  buildDateOptions,
  describeRange,
  getTimezone,
  parseDate,
  sparkline,
} from '../utils/format.js';
import { Range } from '@statsfm/statsfm.js';
import type { v1, Stream, PerDayStats, DateStats, StreamStats, TopUser, UserPublic } from '@statsfm/statsfm.js';

interface ArtistOpts {
  user?: string;
  range: string;
  start?: string;
  end?: string;
  born?: string;
  type: string;
  limit: string;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

// Run a promise, falling back to a default value if it rejects (private profile, 403, etc.).
const opt = <T, F>(p: Promise<T>, fallback: F): Promise<T | F> => p.catch(() => fallback);
const empty = <T>(): T[] => [];

// "#N" if the entity is found in the ranked list, ">N" if it ranks below the fetched depth,
// "n/a" if the list is empty (private/free profile).
function positionIn<T extends { position: number }>(list: T[], match: (x: T) => boolean): string {
  if (!list?.length) return 'n/a';
  const hit = list.find(match);
  return hit ? `#${hit.position}` : `>${list.length}`;
}

// Renders a 24-hour listening clock as a sparkline with an hour axis underneath.
function printClock(hours: Record<number, StreamStats>): void {
  const vals = Array.from({ length: 24 }, (_, h) => hours[h]?.count ?? 0);
  if (vals.every(v => v === 0)) return;

  const axis = Array(24).fill(' ');
  const place = (i: number, s: string) => {
    for (let k = 0; k < s.length && i + k < 24; k++) axis[i + k] = s[k];
  };
  place(0, '0');
  place(6, '6');
  place(12, '12');
  place(18, '18');
  place(22, '23');

  let peakH = 0, peakV = -1;
  let quietH = -1, quietV = Infinity;
  vals.forEach((v, h) => {
    if (v > peakV) { peakV = v; peakH = h; }
    if (v > 0 && v < quietV) { quietV = v; quietH = h; }
  });

  console.log('\nListening clock (streams by hour, local time):');
  console.log(`  ${sparkline(vals)}`);
  console.log(`  ${axis.join('')}`);
  const pad = (h: number) => `${h.toString().padStart(2, '0')}:00`;
  let line = `  Peak ${pad(peakH)} (${peakV.toLocaleString()} plays)`;
  if (quietH >= 0 && quietH !== peakH) line += ` · quietest ${pad(quietH)} (${quietV.toLocaleString()})`;
  console.log(line);
}

function printTopTracks(items: v1.TopTrack[], label: string): void {
  if (!items?.length) return;
  console.log(`\n${label}:`);
  const rows = items.map(t => {
    const row = [`${t.position}.`, t.track.name];
    if (t.streams != null) row.push(`${t.streams.toLocaleString()} plays`);
    if (t.playedMs) row.push(`(${formatTime(t.playedMs)})`);
    row.push(`#${t.track.id}`);
    return row;
  });
  printTable(rows);
}

function printTopAlbums(items: v1.TopAlbum[], label: string): void {
  if (!items?.length) return;
  console.log(`\n${label}:`);
  const rows = items.map(a => {
    const row = [`${a.position}.`, a.album.name];
    if (a.streams != null) row.push(`${a.streams.toLocaleString()} plays`);
    if (a.playedMs) row.push(`(${formatTime(a.playedMs)})`);
    row.push(`#${a.album.id}`);
    return row;
  });
  printTable(rows);
}

function artistHeader(artist: v1.Artist): void {
  const parts: string[] = [];
  if (artist.genres?.length) parts.push(artist.genres.slice(0, 3).join(', '));
  if (artist.followers != null) parts.push(`${artist.followers.toLocaleString()} followers`);
  if (artist.spotifyPopularity) parts.push(`popularity ${artist.spotifyPopularity}`);
  console.log(`${artist.name}  #${artist.id}`);
  if (parts.length) console.log(parts.join(' · '));
}

// Personalized artist page — mirrors what stats.fm shows when you open an artist while logged in.
async function showPersonalArtist(id: number, opts: ArtistOpts): Promise<void> {
  const api = getApi();
  const user = opts.user!;
  const tz = getTimezone();
  const dateOpts = buildDateOptions(opts);
  const trackLimit = parseInt(opts.limit);

  const [
    artist, profile, stats, dateStats, perDay, firstS, lastS, topTracks, topAlbums,
    rankAll, rankMonths, rankWeeks, top250, recent, related, listeners, friendListeners,
  ] = await Promise.all([
    api.artists.get(id),
    opt(api.users.get(user), null as UserPublic | null),
    api.users.artistStats(user, id, dateOpts),
    opt(api.users.artistDateStats(user, id, tz, dateOpts), null as DateStats | null),
    opt(api.users.artistPerDayStats(user, id, tz, dateOpts), null as PerDayStats | null),
    opt(api.users.artistStreams(user, id, { limit: 1, order: 'asc' }), empty<Stream>()),
    opt(api.users.artistStreams(user, id, { limit: 1, order: 'desc' }), empty<Stream>()),
    opt(api.users.topTracksFromArtist(user, id, { ...dateOpts, limit: trackLimit } as never), empty<v1.TopTrack>()),
    opt(api.users.topAlbumsFromArtist(user, id, { ...dateOpts, limit: trackLimit } as never), empty<v1.TopAlbum>()),
    opt(api.users.topArtists(user, { range: Range.LIFETIME, limit: 500 } as never), empty<v1.TopArtist>()),
    opt(api.users.topArtists(user, { range: Range.MONTHS, limit: 500 } as never), empty<v1.TopArtist>()),
    opt(api.users.topArtists(user, { range: Range.WEEKS, limit: 500 } as never), empty<v1.TopArtist>()),
    opt(api.users.topTracks(user, { range: Range.WEEKS, limit: 250 } as never), empty<v1.TopTrack>()),
    opt(api.users.recentlyStreamed(user), empty<v1.RecentlyPlayedTrack>()),
    opt(api.artists.related(id), empty<v1.Artist>()),
    opt(api.artists.topListeners(id), empty<TopUser>()),
    opt(api.artists.topListeners(id, true), empty<TopUser>()),
  ]);

  const who = profile?.displayName ?? user;

  artistHeader(artist);
  console.log(`\n═══ ${who} · ${describeRange(dateOpts)} ═══`);

  // Hero totals
  const count = stats.count ?? 0;
  const ms = stats.durationMs ?? 0;
  console.log(
    `\n${count.toLocaleString()} streams · ${Math.round(ms / 60000).toLocaleString()} min · ` +
    `${(ms / 3600000).toFixed(1)} h · ${(ms / 86400000).toFixed(1)} days`,
  );

  if (perDay?.average) {
    const a = perDay.average;
    console.log(`Avg/day: ${(a.count ?? 0).toFixed(1)} streams · ${Math.round((a.durationMs ?? 0) / 60000)} min`);
  }

  // Percentage of your life (needs --born)
  if (opts.born) {
    const bornMs = parseDate(opts.born);
    const ageMs = Date.now() - bornMs;
    if (ageMs > 0) {
      const pct = (ms / ageMs) * 100;
      console.log(`${pct.toFixed(3)}% of your life spent listening to ${artist.name}`);
    }
  }

  // Ranks among the user's artists (fixed windows, independent of --range)
  const aRank = (l: v1.TopArtist[]) => positionIn(l, x => x.artist.id === id);
  console.log(
    `\nRank among your artists:  all-time ${aRank(rankAll)} · ` +
    `6-months ${aRank(rankMonths)} · 4-weeks ${aRank(rankWeeks)}`,
  );

  // Presence
  const inTop250 = top250.filter(t => t.track.artists?.some(a => a.id === id)).length;
  const inRecent = recent.filter(s => s.track.artists?.some(a => a.id === id)).length;
  console.log(`Presence: ${inTop250} of your top 250 tracks (4w) · ${inRecent} of your last 50 streams`);

  // First & last stream
  if (firstS[0]) console.log(`\nFirst stream: ${firstS[0].trackName}  (${fmtDate(firstS[0].endTime)})`);
  if (lastS[0]) console.log(`Last stream:  ${lastS[0].trackName}  (${fmtDate(lastS[0].endTime)})`);

  // Listening clock
  if (dateStats?.hours) printClock(dateStats.hours);

  // Your top tracks / albums by this artist (the from-artist endpoints ignore `limit`, so slice here)
  printTopTracks(topTracks.slice(0, trackLimit), `Your top tracks (${describeRange(dateOpts)})`);
  printTopAlbums(topAlbums.slice(0, trackLimit), `Your top albums (${describeRange(dateOpts)})`);

  // Global context
  if (related.length) {
    console.log(`\nRelated artists: ${related.slice(0, 8).map(a => `${a.name} (#${a.id})`).join(', ')}`);
  }
  printListeners(listeners, 'Top listeners');
  printListeners(friendListeners, 'Top listeners (friends)');
}

function printListeners(listeners: TopUser[], label: string): void {
  if (!listeners?.length) return;
  console.log(`\n${label}:`);
  for (const l of listeners.slice(0, 5)) {
    const plays = l.streams != null ? `  ${l.streams.toLocaleString()} plays` : '';
    console.log(`  ${l.position}. ${l.user.displayName}${plays}  (@${l.user.customId})`);
  }
}

// Account-free artist view: info + discography + related artists.
async function showArtistDiscography(id: number, opts: ArtistOpts): Promise<void> {
  const api = getApi();
  const [artist, allAlbums, related] = await Promise.all([
    api.artists.get(id),
    api.artists.albums(id),
    api.artists.related(id).catch(() => [] as v1.Artist[]),
  ]);

  artistHeader(artist);

  if (allAlbums?.length) {
    const seen = new Set<number>();
    const unique = allAlbums
      .filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      })
      .sort((a, b) => ((b.releaseDate as number) ?? 0) - ((a.releaseDate as number) ?? 0));

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
  } else {
    console.log('\nNo albums found.');
  }

  if (related.length) {
    console.log(`\nRelated artists: ${related.slice(0, 8).map(a => `${a.name} (#${a.id})`).join(', ')}`);
  }
}

function trackHeader(track: v1.Track): void {
  const explicit = track.explicit ? ' [E]' : '';
  console.log(`${track.name}${explicit}  #${track.id}`);
  const artists = (track.artists ?? []).map(a => `${a.name} (#${a.id})`).join(', ');
  if (artists) console.log(`Artist: ${artists}`);
  const album = track.albums?.[0];
  if (album) console.log(`Album: ${album.name}  #${album.id}`);
  const meta: string[] = [];
  if (track.durationMs) meta.push(formatDuration(track.durationMs));
  if (track.spotifyPopularity) meta.push(`popularity ${track.spotifyPopularity}`);
  if (meta.length) console.log(meta.join(' · '));
}

// Personalized track page — mirrors what stats.fm shows when you open a track while logged in.
async function showPersonalTrack(id: number, opts: ArtistOpts): Promise<void> {
  const api = getApi();
  const user = opts.user!;
  const tz = getTimezone();
  const dateOpts = buildDateOptions(opts);

  const [
    track, profile, stats, dateStats, perDay, firstS, lastS,
    rankAll, rankMonths, rankWeeks, recent, listeners, friendListeners,
  ] = await Promise.all([
    api.tracks.get(id),
    opt(api.users.get(user), null as UserPublic | null),
    api.users.trackStats(user, id, dateOpts),
    opt(api.users.trackDateStats(user, id, tz, dateOpts), null as DateStats | null),
    opt(api.users.trackPerDayStats(user, id, tz, dateOpts), null as PerDayStats | null),
    opt(api.users.trackStreams(user, id, { limit: 1, order: 'asc' }), empty<Stream>()),
    opt(api.users.trackStreams(user, id, { limit: 1, order: 'desc' }), empty<Stream>()),
    opt(api.users.topTracks(user, { range: Range.LIFETIME, limit: 1000 } as never), empty<v1.TopTrack>()),
    opt(api.users.topTracks(user, { range: Range.MONTHS, limit: 1000 } as never), empty<v1.TopTrack>()),
    opt(api.users.topTracks(user, { range: Range.WEEKS, limit: 1000 } as never), empty<v1.TopTrack>()),
    opt(api.users.recentlyStreamed(user), empty<v1.RecentlyPlayedTrack>()),
    opt(api.tracks.topListeners(id), empty<TopUser>()),
    opt(api.tracks.topListeners(id, true), empty<TopUser>()),
  ]);

  const who = profile?.displayName ?? user;

  trackHeader(track);
  console.log(`\n═══ ${who} · ${describeRange(dateOpts)} ═══`);

  // Hero totals
  const count = stats.count ?? 0;
  const ms = stats.durationMs ?? 0;
  console.log(
    `\n${count.toLocaleString()} streams · ${Math.round(ms / 60000).toLocaleString()} min · ${(ms / 3600000).toFixed(1)} h`,
  );

  if (perDay?.average) {
    const a = perDay.average;
    console.log(`Avg/day: ${(a.count ?? 0).toFixed(2)} streams · ${(((a.durationMs ?? 0) / 60000)).toFixed(1)} min`);
  }

  // Ranks among the user's tracks (fixed windows, independent of --range)
  const tRank = (l: v1.TopTrack[]) => positionIn(l, x => x.track.id === id);
  console.log(
    `\nRank among your tracks:  all-time ${tRank(rankAll)} · ` +
    `6-months ${tRank(rankMonths)} · 4-weeks ${tRank(rankWeeks)}`,
  );

  // Presence in recent listening
  const inRecent = recent.filter(s => s.track.id === id).length;
  console.log(`Presence: ${inRecent} of your last 50 streams`);

  // First & last stream
  if (firstS[0]) console.log(`\nFirst stream: ${fmtDate(firstS[0].endTime)}`);
  if (lastS[0]) console.log(`Last stream:  ${fmtDate(lastS[0].endTime)}`);

  // Listening clock
  if (dateStats?.hours) printClock(dateStats.hours);

  // Global context
  printListeners(listeners, 'Top listeners');
  printListeners(friendListeners, 'Top listeners (friends)');
}

function albumHeader(album: v1.Album): void {
  console.log(`${album.name}  #${album.id}`);
  const artists = (album.artists ?? []).map(a => `${a.name} (#${a.id})`).join(', ');
  if (artists) console.log(`Artist: ${artists}`);
  const meta: string[] = [];
  const releaseMs = album.releaseDate as number;
  if (releaseMs) meta.push(new Date(releaseMs).toISOString().slice(0, 10));
  if (album.totalTracks != null) meta.push(`${album.totalTracks} tracks`);
  if (album.label) meta.push(album.label);
  if (album.genres?.length) meta.push(album.genres.slice(0, 2).join(', '));
  if (meta.length) console.log(meta.join(' · '));
}

// Personalized album page — mirrors what stats.fm shows when you open an album while logged in.
async function showPersonalAlbum(id: number, opts: ArtistOpts): Promise<void> {
  const api = getApi();
  const user = opts.user!;
  const tz = getTimezone();
  const dateOpts = buildDateOptions(opts);

  const [
    album, profile, stats, dateStats, perDay, firstS, lastS,
    topAll, topMonths, topWeeks, listeners, friendListeners,
  ] = await Promise.all([
    api.albums.get(id),
    opt(api.users.get(user), null as UserPublic | null),
    api.users.albumStats(user, id, dateOpts),
    opt(api.users.albumDateStats(user, id, tz, dateOpts), null as DateStats | null),
    opt(api.users.albumPerDayStats(user, id, tz, dateOpts), null as PerDayStats | null),
    opt(api.users.albumStreams(user, id, { limit: 1, order: 'asc' }), empty<Stream>()),
    opt(api.users.albumStreams(user, id, { limit: 1, order: 'desc' }), empty<Stream>()),
    opt(api.users.topTracks(user, { range: Range.LIFETIME, limit: 1000 } as never), empty<v1.TopTrack>()),
    opt(api.users.topTracks(user, { range: Range.MONTHS, limit: 1000 } as never), empty<v1.TopTrack>()),
    opt(api.users.topTracks(user, { range: Range.WEEKS, limit: 1000 } as never), empty<v1.TopTrack>()),
    opt(api.albums.topListeners(id), empty<TopUser>()),
    opt(api.albums.topListeners(id, true), empty<TopUser>()),
  ]);

  const who = profile?.displayName ?? user;

  albumHeader(album);
  console.log(`\n═══ ${who} · ${describeRange(dateOpts)} ═══`);

  // Hero totals
  const count = stats.count ?? 0;
  const ms = stats.durationMs ?? 0;
  console.log(
    `\n${count.toLocaleString()} streams · ${Math.round(ms / 60000).toLocaleString()} min · ` +
    `${(ms / 3600000).toFixed(1)} h · ${(ms / 86400000).toFixed(1)} days`,
  );

  if (perDay?.average) {
    const a = perDay.average;
    console.log(`Avg/day: ${(a.count ?? 0).toFixed(2)} streams · ${((a.durationMs ?? 0) / 60000).toFixed(1)} min`);
  }

  // How many of this album's tracks land in your top tracks, per window (fixed, independent of --range)
  const onAlbum = (l: v1.TopTrack[]) => l.filter(t => t.track.albums?.some(al => al.id === id)).length;
  console.log(
    `\nTracks in your top tracks:  all-time ${onAlbum(topAll)} · ` +
    `6-months ${onAlbum(topMonths)} · 4-weeks ${onAlbum(topWeeks)}`,
  );

  // First & last stream (which track of the album, and when)
  if (firstS[0]) console.log(`\nFirst stream: ${firstS[0].trackName}  (${fmtDate(firstS[0].endTime)})`);
  if (lastS[0]) console.log(`Last stream:  ${lastS[0].trackName}  (${fmtDate(lastS[0].endTime)})`);

  // Listening clock
  if (dateStats?.hours) printClock(dateStats.hours);

  // Global context
  printListeners(listeners, 'Top listeners');
  printListeners(friendListeners, 'Top listeners (friends)');
}

export function registerLookup(program: Command): void {
  program
    .command('artist <artistId>')
    .description('Artist info & discography — or a full personal artist page with -u')
    .option('-u, --user <username>', 'stats.fm username — show your personal stats for this artist')
    .option('-r, --range <range>', 'Time range for personal stats', 'all')
    .option('--start <date>', 'Start date (YYYY, YYYY-MM, YYYY-MM-DD)')
    .option('--end <date>', 'End date')
    .option('--born <date>', 'Your birth date (YYYY-MM-DD) — adds % of your life listened')
    .option('-t, --type <type>', 'Discography: album, single, or all', 'album')
    .option('-l, --limit <n>', 'Items per section', '15')
    .action(async (artistId: string, opts: ArtistOpts) => {
      const id = parseInt(artistId);
      if (opts.user) {
        await showPersonalArtist(id, opts);
      } else {
        await showArtistDiscography(id, opts);
      }
    });

  program
    .command('album <albumId>')
    .description('Album info & tracklist — or a full personal album page with -u')
    .option('-u, --user <username>', 'stats.fm username — show your personal stats for this album')
    .option('-r, --range <range>', 'Time range for personal stats', 'all')
    .option('--start <date>', 'Start date (YYYY, YYYY-MM, YYYY-MM-DD)')
    .option('--end <date>', 'End date')
    .action(async (albumId: string, opts: ArtistOpts) => {
      const id = parseInt(albumId);
      if (opts.user) {
        await showPersonalAlbum(id, opts);
        return;
      }

      const api = getApi();
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
    .description('Track info — or a full personal track page with -u')
    .option('-u, --user <username>', 'stats.fm username — show your personal stats for this track')
    .option('-r, --range <range>', 'Time range for personal stats', 'all')
    .option('--start <date>', 'Start date (YYYY, YYYY-MM, YYYY-MM-DD)')
    .option('--end <date>', 'End date')
    .action(async (trackId: string, opts: ArtistOpts) => {
      const id = parseInt(trackId);
      if (opts.user) {
        await showPersonalTrack(id, opts);
        return;
      }

      const api = getApi();
      const track = await api.tracks.get(id);

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
