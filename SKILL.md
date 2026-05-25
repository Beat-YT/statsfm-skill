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

## How to Think About the Data

**Share is the answer, not the count.** 500 plays means nothing. 500 out of 600 total? Obsession. 500 out of 5,000? Background noise. Always pair any query with `api.users.stats()` for the same period and compute entity plays / total streams. If current, check `PLATFORM` ordering for engagement depth beyond counts.

**Profile the listener first.** Run `node js/cli.cjs overview -u USERNAME` before answering anything. The `Profile:` line gives you replay rate, concentration (top 5/20 share), and #1 share. These set the scale — 5% share is obsession for an explorer, background noise for a loyalist. Calibrate every number against the listener's profile.

**Incomplete periods will fool you.** If today is May 21, this month has 21 days vs last month's 30. Never compare them raw. Normalize to daily rate, project the full month (`count / daysElapsed * daysInMonth`), or exclude the incomplete period. Use calendar date for days elapsed, not array length — zero-play days may be missing from data.

**Volume changes masquerade as preference changes.** An artist dropping from 500 to 300 plays looks like decline. But if total listening also dropped proportionally, their share is unchanged. Always check total volume for the same period.

**Small samples break everything.** 30 streams in a week? Don't compute shares. Lead with raw counts, flag the low volume.

**Cardinality is breadth, not depth.** Unique albums = albums with at least one track played, not albums listened to deeply. Unique artists can be misleading — a user with 700 unique artists where 94% of streams go to 20 of them has a functional artist count of 20. Use `topTracksFromAlbums` to tell album listeners from cherry-pickers.

**`PLATFORM` ordering — what the user is actually obsessed with.**

`COUNT` tallies plays. `PLATFORM` captures obsession. It's Spotify's composite model — downstream of skip rate, seek behavior, saves, loops, session position, and dozens of signals play count is blind to. Not decomposable; don't try. When `PLATFORM` and `COUNT` disagree, the divergence itself is the finding. If the user tells you what they did with a track, that's first-party evidence — it overrides the metric.

`PLATFORM` returns no play counts (`streams: null`) but adds movement indicators (`NEW`/`UP`/`SAME`/`DOWN`) and — critically — position. Compare positions between `PLATFORM` and `COUNT`: a track at #3 on PLATFORM but #12 on COUNT has engagement depth the play count misses. The reverse matters too — #2 on COUNT but #5 on PLATFORM means the count is coasting on accumulated plays but active engagement is fading. The position gap in both directions is the signal, not just the indicator. Only takes predefined ranges (`weeks`, `months`, `lifetime`) — no custom dates, no historical rankings. For free users, it's the only ranking available.

**Lead with data when it contradicts the user.** State what the data shows first, then address the discrepancy. The user came for truth, not validation.

**Don't be lazy. Always check multiple ranges.** Never answer from a single range. Pull recent (4w or 7d) AND lifetime AND the relevant custom period. Lifetime alone is accumulation — it buries what's happening now. Recent alone has no context. Even when it seems like one range is enough, it isn't. The full picture requires at least two ranges every time, no exceptions. If current, add a `PLATFORM` check — it shows what's active in a way counts can't.

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
| "this month" | `{ after: Date.parse('2026-05-01'), before: Date.parse('2026-06-01') }` (adjust) |
| "lately" | `{ range: 'weeks' }` + `{ range: 'lifetime' }` for comparison |
| "all time" | `{ range: 'lifetime' }` |

### api.users.stats(userId, range)

Your denominator for every share calculation.

```js
await api.users.stats('username', { range: 'weeks' })
```
```json
{
  "durationMs": 583040148,
  "count": 3465,
  "playedMs": { "count": 3465, "min": 38333, "max": 448000, "avg": 168265.55 },
  "cardinality": { "tracks": 524, "artists": 161, "albums": 307 }
}
```

### api.users.topArtists / topTracks / topAlbums / topGenres

```js
await api.users.topArtists('username', { range: 'weeks', limit: 10 })
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

```js
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
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

### api.users.artistStreams / trackStreams / albumStreams

Raw stream records. `order: 'asc'` for first plays, `'desc'` for most recent.

```js
await api.users.artistStreams('username', 22369, { limit: 5, order: 'asc' })
```
```json
[{
  "endTime": "2024-09-01T14:41:00.000Z", "playedMs": 175459,
  "trackId": 188745898, "trackName": "Espresso", "albumId": 25631099, "artistIds": [22369]
}]
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
// limit param exists but API always returns ~50 regardless
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

### api.charts.topTracks / topArtists / topAlbums

Global charts, no account needed.

```js
await api.charts.topTracks({ range: 'today' })
// → same shape as user top tracks/artists/albums, but global

await api.charts.topArtists({ range: 'today' })
await api.charts.topAlbums({ range: 'today' })
```

### api.search.searchElastic(query, types, opts)

Prefer the CLI for search — results contain duplicates and need manual evaluation.

```js
await api.search.searchElastic('Sabrina Carpenter', ['artist'], { limit: 5 })
// → { artists?, tracks?, albums? }
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
- **Rate limiting:** Don't hold back. Deep dives take as many calls as they take.

---

## CLI Reference

`node js/cli.cjs <command> [args] [flags]` — global flag: `-u USERNAME`

**Profile & Activity:** `profile`, `overview`, `now-playing` / `np`, `recent`, `stream-stats`

**Top Lists:** `top artists|tracks|albums|genres` — flags: `--range`, `--start/--end`, `--limit`

**History:** `artist-history <id>`, `track-history <id>`, `album-history <id>`, `listening-history` — flags: `--start/--end`, `--granularity monthly|weekly|daily|yearly`. Does NOT support `--range`.

**Lookups:** `search <query>` (`-t artist|track|album`), `artist <id>`, `track <id>`, `album <id>`

**Drill-Downs:** `top tracks --from-artist ID`, `top tracks --from-album ID`, `top albums --from-artist ID`

**Discovery:** `first-listen <artist|track|album> <id>` — flags: `--limit`

**Charts:** `charts tracks|artists|albums` — flags: `--range today|4w|6m|all`, `--limit`

**Ranges:** `--range today`, `4w` (default), `6m`, `all`, `7d`, `14d`, `30d`, `90d`. Custom: `--start YYYY[-MM[-DD]]`, `--end YYYY[-MM[-DD]]`.
