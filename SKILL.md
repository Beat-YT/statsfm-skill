---
name: statsfm
description: Music data analysis tool for Spotify and Apple Music, powered by the stats.fm API. Explains what listening data means — computes shares, normalizes periods, and contextualizes every number. Look up album tracklists, artist discographies, and global charts without an account. With a stats.fm username, analyze personal Spotify listening history, trends, and patterns.
allowed-tools: Bash(node *)
---

# stats.fm Skill

Explain what a user's listening data means. Your job is analysis, not retrieval. Every number needs context — a share, a comparison, a denominator. Raw counts alone are never an answer.

```js
const { Api } = require('./js/statsfm.cjs');
const api = new Api();
```

**Path note:** Always use `./js/statsfm.cjs` — relative to the skill directory.

This is your primary tool. Write JS to fetch, compute, and combine data. The CLI (`node js/cli.cjs`) is a quick helper — search, now-playing, browsing a tracklist. Don't overuse it. If you're running more than 2-3 CLI calls in a row, you should be using the library instead.

---

## Know Your User (Before Any Metric)
You can’t interpret anything without a baseline for the listener. Before answering, establish who this user is and what the question actually means.

**Profile the user.** You don't know about this user, run `node js/cli.cjs overview -u USERNAME` before answering anything. This shows you the page of their Statsfm page with a few info about them, including timezone, name, recent plays, a few top entries. The `Profile:` line gives you replay rate, concentration (top 5/20 share), and #1 share. These set the scale — 5% share is obsession for an explorer, background noise for a loyalist. Calibrate every number against the listener's profile.

```bash
node js/cli.cjs overview -u USERNAME
```

**Get a denominator.** Pull overall listening volume for the same period you’ll discuss (this is the scale for every share and every “obsession” claim):

```js
const stats = await api.users.stats('username', { range: 'weeks' });
// stats.count (streams), stats.durationMs, stats.cardinality
```

**Clarify the intent.** “Favorites” (lifetime accumulation) and “into right now” (recent engagement) are different questions; choose ranges accordingly and use `PLATFORM` when the user is asking about current obsession.

## Ordering: COUNT vs PLATFORM
Top lists can be ordered two ways: `COUNT` (play counts) and `PLATFORM` (Spotify's engagement-based ranking). `COUNT` is raw volume; `PLATFORM` is closer to “current obsession.”

`PLATFORM` is Spotify's composite model — downstream of skip rate, seek behavior, saves, loops, session position, and dozens of signals that play counts are blind to. Don’t try to decompose it; treat it as a separate lens. When `PLATFORM` and `COUNT` disagree, the divergence itself is the finding.

Play counts are the default and often sufficient, but check `PLATFORM` when the user is asking “what am I into right now?” For free users, `PLATFORM` is the only ranking available.

`PLATFORM` is only supported for the top artists / tracks / albums endpoints (not genres or drill-downs). It only supports predefined ranges (`weeks`, `months`, `lifetime`) — It returns no play counts (`streams: null`), but it does return rank position and movement indicators (`NEW`/`UP`/`SAME`/`DOWN`). Compare positions between `PLATFORM` and `COUNT`: a track at #3 on `PLATFORM` but #12 on `COUNT` has engagement depth that accumulated plays can miss; the reverse (high on `COUNT`, lower on `PLATFORM`) can mean the play count is coasting while active engagement is fading. The position gap in either direction is the signal, not the indicator.

## How to Think About Stream Counts (COUNT ordering)

**Share is the answer, not the count.** 500 plays alone means nothing. 500 out of 600 total? Obsession. 500 out of 5,000? Background noise. Always pair any query with `api.users.stats()` for the same period and compute entity plays / total streams.

**Incomplete periods will fool you.** If today is May 21, this month has 21 days vs last month's 30. Never compare them raw. Normalize to daily rate, project the full month (`count / daysElapsed * daysInMonth`), or exclude the incomplete period. Use calendar date for days elapsed, not array length — zero-play days may be missing from data.

**Volume changes masquerade as preference changes.** An artist dropping from 500 to 300 plays looks like decline. But if total listening also dropped proportionally, their share is unchanged. Always check total volume for the same period.

**Small samples break everything.** 30 streams in a week? Don't compute shares. Lead with raw counts, flag the low volume.

**Cardinality is breadth, not depth.** Unique albums = albums with at least one track played, not albums listened to deeply. Unique artists can be misleading — a user with 700 unique artists where 94% of streams go to 20 of them has a functional artist count of 20. Use `topTracksFromAlbums` to tell album listeners from cherry-pickers.

**Lead with data when it contradicts the user.** State what the data shows first, then address the discrepancy. The user came for truth, not validation.

**Always check multiple ranges.** Never answer from a single range. Pull the relevant periods (4w, 7d, lifetime, a custom range) AND another range (often lifetime or 4w depending on the context) AND the relevant stream stats for the period. Lifetime alone is accumulation — it buries what's happening now. Recent alone has no context. Even when it seems like one range is enough, it isn't. The full picture requires at least two ranges every time and stream stats. no exceptions.

---

## Traps

These produce confident, plausible, wrong output:

- Presenting "1,247 plays" without saying out of how many total → misleading magnitude
- Comparing May (21 days) against April (30 days) → false decline
- Calling a raw count drop a "decline" without checking if total volume also dropped → false attribution
- Treating cardinality as depth ("700 unique artists = broad listener") without checking concentration → wrong profile
- Using `PLATFORM` ranking to compute shares (it has no play counts) → type error
- Only using `COUNT` for current engagement questions without checking `PLATFORM` → missing the obsession signal that counts can't capture

---

## Library SDK

```js
const { Api } = require('./js/statsfm.cjs');
const api = new Api();
```

All methods are async. Use `Promise.all()` for parallel calls. `externalIds` may not contain all providers.

### Ranges

```js
{ range: 'today' }
{ range: 'weeks' }     // last 4 weeks
{ range: 'months' }    // last 6 months
{ range: 'lifetime' }  // all time
{ after: Date.parse('2026-01-01'), before: Date.parse('2027-01-01') }  // custom (Unix ms)
{ range: 'weeks', limit: 10 }  // most methods accept limit and offset
```

| User says | You use |
|-----------|---------|
| "this year" | `{ after: Date.parse('2026-01-01'), before: Date.parse('2027-01-01') }` |
| "last year" | `{ after: Date.parse('2025-01-01'), before: Date.parse('2026-01-01') }` |
| "this month" | `{ range: 'weeks' }`  |
| "lately" | `{ range: 'weeks' }` + `{ range: 'months' }` |
| "all time" | `{ range: 'lifetime' }` |

### api.users.stats(userId, range)

Your denominator for every share calculation.

```js
await api.users.stats('username', { range: 'weeks' })
```
```json
{
  "durationMs": 1234567890,
  "count": 1234,
  "playedMs": { "count": 1234, "min": 34567, "max": 567890, "avg": 5000.00 },
  "cardinality": { "tracks": 456, "artists": 123, "albums": 100 }
}
```

### api.users.topArtists / topTracks / topAlbums / topGenres

```js
await api.users.topArtists('username', { range: 'weeks', orderBy: 'COUNT', limit: 10 })
```
```json
[{
  "position": 1, "streams": 753, "playedMs": 106268511,
  "artist": { "id": 22369, "name": "Sabrina Carpenter", "genres": ["pop"], "followers": 30342762 }
}]
```

`topTracks` → same shape with `track: { id, name, durationMs, explicit, artists, albums }`.
`topAlbums` → same shape with `album`. `topGenres` → same shape with `genre: { tag }`.

All accept `orderBy`: `'COUNT'` (default), `'TIME'`, `'PLATFORM'` (Spotify ranking, `streams: null`, adds `indicator`).

### api.users.topTracksFromArtist / topAlbumsFromArtist / topTracksFromAlbums

```js
await api.users.topTracksFromArtist('username', 39118, { range: 'lifetime', limit: 10 })
// → same shape as topTracks
```

### api.users.artistPerDayStats / trackPerDayStats / albumPerDayStats

Daily play counts. Group by month/week yourself.
Use the time-zone from the user's profile or 'UTC' for easier calendar alignment.
Date format are timezone offset ISO strings with the timezone offset (e.g. `2025-01-01T00:00:00.000Z` for UTC, `2025-01-01T00:00:00.000-05:00` for EST).

```js
await api.users.artistPerDayStats('username', 22369, tz)
```
```json
{
  "average": { "count": 29.59, "durationMs": 6083756 },
  "days": {
    "2025-01-01T00:00:00.000Z": { "count": 18, "durationMs": 4131244 },
    "2025-01-02T00:00:00.000Z": { "count": 0, "durationMs": 0 }
  }
}
```

Same signature for `trackPerDayStats(userId, trackId, tz, range?)` and `albumPerDayStats`.

### api.users.artistStats / trackStats / albumStats

Total plays + listening time for one entity. Your numerator for "what share of this user is X". Same signature for tracks and albums.

```js
await api.users.artistStats('username', 22369, { range: 'lifetime' })
// → { count: 21114, durationMs: 3732360164 }   (no cardinality, no rank)
```

To get an artist's **rank** among the user's artists, fetch `topArtists` (caps at ~500) and find the matching `position`:

```js
const all = await api.users.topArtists('username', { range: 'lifetime', limit: 500 });
const rank = all.find(a => a.artist.id === 22369)?.position; // undefined ⇒ outside top 500
```

### api.users.artistStreams / trackStreams / albumStreams

Raw stream records. `order: 'asc'` for first plays, `'desc'` for most recent. You can also use this endpoint with `limit: 1` and `order: 'asc'`/`'desc'` to get the first and last time the user played an entity.

```js
await api.users.artistStreams('username', 22369, { limit: 5, order: 'asc' })
```
```json
[{
  "endTime": "2024-09-01T14:41:00.000Z", "playedMs": 175459,
  "trackId": 188745898, "trackName": "Espresso", "albumId": 25631099, "artistIds": [22369]
}]
```

### api.users.artistDateStats / trackDateStats / albumDateStats

Listening aggregated by clock-hour, weekday, month-day, month, and year — for one entity. Use `hours` (keys `0`–`23`) to build a listening clock.

```js
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
await api.users.artistDateStats('username', 22369, tz, { range: 'lifetime' })
```
```json
{
  "hours":   { "0": { "count": 1203, "durationMs": 213117744 }, "17": { "count": 1463, "durationMs": 254997499 } },
  "weekDays":{ "0": { "count": 0, "durationMs": 0 } },
  "months":  { "1": { "count": 908, "durationMs": 153474947 } },
  "years":   { "2024": { "count": 0, "durationMs": 0 } }
}
```

### api.users.currentlyStreaming(userId)

```js
await api.users.currentlyStreaming('username')
```
```json
{
  "isPlaying": true,
  "progressMs": 36340,
  "deviceName": "iPhone",
  "platform": "SPOTIFY",
  "track": {
    "id": 188745898,
    "name": "Espresso",
    "durationMs": 175459,
    "artists": [{ "id": 22369, "name": "Sabrina Carpenter" }],
    "albums": [{ "id": 25631099, "name": "Espresso - Single" }]
  }
}
```

Returns `null` if nothing is playing.

### api.users.recentlyStreamed(userId)

```js
await api.users.recentlyStreamed('username')
// always returns ~50 regardless of limit parameter
```
```json
[{
  "platform": "SPOTIFY",
  "endTime": "2025-01-15T14:41:00.000Z",
  "track": {
    "id": 9323381,
    "name": "Blue",
    "durationMs": 229881,
    "explicit": false,
    "artists": [{ "id": 39118, "name": "Madison Beer" }],
    "albums": [{ "id": 1365235, "name": "Life Support" }],
    "spotifyPopularity": 52,
    "externalIds": { "spotify": ["..."], "appleMusic": ["..."] }
  },
  "durationMs": 229881
}]
```

### api.users.get(userId) / api.users.friends(userId)

```js
await api.users.get('username')
// → { id, customId, displayName, isPlus, isPro, timezone, profile: { bio, pronouns }, spotifyAuth }

await api.users.friends('username')
```
```json
[{
  "id": "abc123",
  "customId": "johndoe",
  "displayName": "John",
  "isPlus": false,
  "isPro": false,
  "timezone": "America/New_York"
}]
```

### api.artists.get(id) / api.artists.albums(id)

```js
await api.artists.get(39118)
```
```json
{
  "id": 39118,
  "name": "Madison Beer",
  "genres": ["pop"],
  "followers": 9312656,
  "spotifyPopularity": 77,
  "image": "https://i.scdn.co/image/...",
  "externalIds": { "spotify": ["..."], "appleMusic": ["..."] }
}
```

```js
await api.artists.albums(22369)
```
```json
[{
  "id": 56735245,
  "name": "Man's Best Friend",
  "totalTracks": 12,
  "releaseDate": 1759104000000,
  "type": "album",
  "label": "Island Records",
  "genres": ["Pop"],
  "artists": [{ "id": 22369, "name": "Sabrina Carpenter" }]
}]
```

`api.artists.albums(id)` is paginated (~50 results, mostly `type: 'single'`); it does NOT return the artist's full catalog. For a user's actual most-played albums by an artist, use `api.users.topAlbumsFromArtist` instead.

### api.artists.tracks / topTracks / topAlbums / related / topListeners

Global, account-free artist context (no user needed). `related` can return `[]`. `topListeners` requires an authenticated token — it returns **403 Forbidden** here, so wrap it in `.catch(() => [])`.

```js
await api.artists.tracks(22369)        // → Track[] (the artist's tracks)
await api.artists.topTracks(22369)     // → Track[] (the artist's most popular tracks)
await api.artists.topAlbums(22369)     // → Album[]
await api.artists.related(22369)       // → Artist[] (similar artists; may be empty)
await api.artists.topListeners(22369)            // → TopUser[]  (403 without auth)
await api.artists.topListeners(22369, true)      // friends only  (403 without auth)
```

### api.albums.get(id) / api.albums.tracks(id)

```js
await api.albums.get(56735245)
// → same shape as artists.albums() entry

await api.albums.tracks(56735245)
```
```json
[{
  "id": 319880636,
  "name": "Manchild",
  "durationMs": 213000,
  "explicit": true,
  "artists": [{ "id": 22369, "name": "Sabrina Carpenter" }]
}]
```

Also: `api.albums.topListeners(id[, friendsOnly])` (→ `TopUser[]`, **403 without auth** — guard it).

### api.tracks.get(id)

```js
await api.tracks.get(188745898)
```
```json
{
  "id": 188745898,
  "name": "Espresso",
  "durationMs": 175459,
  "explicit": true,
  "artists": [{ "id": 22369, "name": "Sabrina Carpenter" }],
  "albums": [{ "id": 25631099, "name": "Espresso - Single" }],
  "externalIds": { "spotify": ["..."], "appleMusic": ["..."] }
}
```

Also: `api.tracks.topListeners(id[, friendsOnly])` (→ `TopUser[]`, **403 without auth** — guard it) and `api.tracks.audioFeature(spotifyId)` / `audioFeatures(spotifyIds[])` for tempo/energy/danceability.

### api.charts.topTracks / topArtists / topAlbums

Global charts, no account needed.

```js
await api.charts.topTracks({ range: 'today' })
// → same shape as user top tracks/artists/albums, but global

await api.charts.topArtists({ range: 'today' })
await api.charts.topAlbums({ range: 'today' })
```

---

## Setup

Check memory for a stats.fm username. If you don't have one, ask. Public methods (lookups, charts, search) work without one.

Save username and timezone to memory on first use. Get timezone from `api.users.get(user).timezone` or ask.

## Finding IDs

Use the CLI for search — keyword-based, not semantic. `"espresso"` works, `"sabrina espresso"` won't.

```bash
node js/cli.cjs search "sabrina carpenter" artist
node js/cli.cjs search "sabrina carpenter" artist "olivia rodrigo" artist "espresso" track
```

Search returns duplicates. Prefer results with genre tags for artists. When ambiguous, search the artist first, then browse their discography.

## Edge Cases

- **Empty results?** Retry with `{ range: 'lifetime' }`. If still empty, profile might be private.
- **Free (non-Plus) users:** No play counts. Use `orderBy: 'PLATFORM'` — movement indicators are the best available data.
- **Long-tail artists are often noise, not taste.** Artists with few streams frequently appear only because they're *featured* on a track the user actually played for the main artist — the feature credit gets logged against them. Treat low-count artists in the tail with skepticism: they may not reflect genuine listening of that artist at all. Before calling someone a "listener" of a low-stream artist, sanity-check whether those streams come from collaborations/features rather than the artist's own tracks (e.g. cross-reference the tracks driving the count, or the artist's discography).
- **Rate limiting:** Don't hold back. Deep dives take as many calls as they take.

---

## CLI Reference, Use the CLI for quick lookups, not deep analysis. If you find yourself running more than 2-3 CLI calls in a row, switch to the library.

`node js/cli.cjs <command> [args] [flags]` — global flag: `-u USERNAME`

**Profile & Activity:** `profile`, `overview`, `now-playing` / `np`, `recent`, `stream-stats`

**Top Lists:** `top artists|tracks|albums|genres` — flags: `--range`, `--start/--end`, `--limit`

**History:** `artist-history <id>`, `track-history <id>`, `album-history <id>`, `listening-history` — flags: `--start/--end`, `--granularity monthly|weekly|daily|yearly`. Does NOT support `--range`.

**Lookups:** `search <query>` (`-t artist|track|album`), `artist <id>`, `track <id>`, `album <id>`

**Artist page:** `artist <id> -u USERNAME` — full personal artist page in one call: lifetime totals (streams/min/hours/days), avg per day, rank among your artists (all-time / 6mo / 4wk), presence (top-250 tracks 4w, last-50 streams), first & last stream, a by-hour listening clock, and your top tracks & albums by that artist. Flags: `-r/--range` (default `all`), `--start/--end`, `--born YYYY-MM-DD` (adds % of your life listened), `-l/--limit`. Without `-u` it shows discography + related artists.

**Track page:** `track <id> -u USERNAME` — full personal track page: lifetime totals (streams/min/hours), avg per day, rank among your tracks (all-time / 6mo / 4wk), presence in your last-50 streams, first & last stream, and a by-hour listening clock. Flags: `-r/--range` (default `all`), `--start/--end`. Without `-u` it shows track info only.

**Album page:** `album <id> -u USERNAME` — full personal album page: lifetime totals (streams/min/hours/days), avg per day, how many of the album's tracks land in your top tracks (all-time / 6mo / 4wk), first & last stream (with which track), and a by-hour listening clock. Flags: `-r/--range` (default `all`), `--start/--end`. Without `-u` it shows the tracklist.

**Drill-Downs:** `top tracks --from-artist ID`, `top tracks --from-album ID`, `top albums --from-artist ID`

**Discovery:** `first-listen <artist|track|album> <id>` — flags: `--limit`

**Charts:** `charts tracks|artists|albums` — flags: `--range today|4w|6m|all`, `--limit`

**Ranges:** `--range today`, `4w` (default), `6m`, `all`, `7d`, `14d`, `30d`, `90d`. Custom: `--start YYYY[-MM[-DD]]`, `--end YYYY[-MM[-DD]]`.
