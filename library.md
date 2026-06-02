# stats.fm JavaScript Library Cheat Sheet

Bundled API client for custom analysis, data export, comparison tables, and ratio calculations.

```javascript
const { Api } = require('./js/statsfm.cjs');
const api = new Api();
```

All methods are async. Use `Promise.all()` for parallel calls.

**Do NOT use the search API in library code.** Use the CLI to search, pick the correct ID, then use that ID here.

**Note:** `externalIds` may not contain all providers — `spotify` and `appleMusic` arrays can be empty.

---

## Ranges

```javascript
// Predefined
{ range: 'today' }
{ range: 'weeks' }     // last 4 weeks
{ range: 'months' }    // last 6 months
{ range: 'lifetime' }  // all time

// Custom (Unix ms)
{ after: Date.parse('2024-01-01'), before: Date.parse('2025-01-01') }

// Most methods also accept limit and offset
{ range: 'weeks', limit: 10 }
```

---

## api.users.stats(userId, range)

Overall stream statistics with cardinality.

```javascript
await api.users.stats('username', { range: 'weeks' })
```
```json
{
  "durationMs": 583040148,
  "count": 3465,
  "playedMs": {
    "count": 3465,
    "min": 38333,
    "max": 448000,
    "avg": 168265.55
  },
  "cardinality": {
    "tracks": 524,
    "artists": 161,
    "albums": 307
  }
}
```

---

## api.users.topArtists(userId, range)

```javascript
await api.users.topArtists('username', { range: 'weeks', limit: 10 })
```
```json
[{
  "position": 1,
  "streams": 753,
  "playedMs": 106268511,
  "artist": {
    "id": 22369,
    "name": "Sabrina Carpenter",
    "genres": ["pop"],
    "followers": 30342762
  }
}]
```

Also: `topTracks`, `topAlbums`, `topGenres` — same shape with `track`, `album`, or `genre` instead of `artist`.

---

## api.users.topTracks(userId, range)

```javascript
await api.users.topTracks('username', { range: 'weeks', limit: 10 })
```
```json
[{
  "position": 1,
  "streams": 53,
  "playedMs": 9392904,
  "track": {
    "id": 272529471,
    "name": "Snap My Finger (feat. PinkPantheress)",
    "durationMs": 201371,
    "explicit": true,
    "artists": [{ "id": 38191, "name": "KAYTRANADA" }],
    "albums": [{ "id": 26554463, "name": "TIMELESS" }]
  }
}]
```

---

## api.users.topTracksFromArtist(userId, artistId, range)

Your most played tracks by a specific artist.

```javascript
await api.users.topTracksFromArtist('username', 39118, { range: 'lifetime', limit: 10 })
// → same shape as topTracks
```

Also: `topAlbumsFromArtist(userId, artistId, range)`, `topTracksFromAlbums(userId, albumId, range)`

---

## api.users.artistPerDayStats / trackPerDayStats / albumPerDayStats

Daily play counts for building monthly/weekly arcs. Works for artists, tracks, and albums — same signature, same response shape.

```javascript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
await api.users.artistPerDayStats('username', 22369, tz)
```
```json
{
  "average": { "count": 29.59, "durationMs": 6083756 },
  "days": {
    "2025-01-01T00:00:00.000Z": { "count": 18, "durationMs": 4131244 },
    "2025-01-02T00:00:00.000Z": { "count": 0, "durationMs": 0 },
    "2025-01-03T00:00:00.000Z": { "count": 5, "durationMs": 877000 }
  }
}
```

Group the `days` keys by month/week yourself. Omit the last arg for lifetime.

```javascript
api.users.artistPerDayStats(userId, artistId, tz, range?)
api.users.trackPerDayStats(userId, trackId, tz, range?)
api.users.albumPerDayStats(userId, albumId, tz, range?)
```

---

## api.users.artistStreams / trackStreams / albumStreams

Raw stream records. Works for artists, tracks, and albums. Use `order: 'asc'` for discovery (first plays), `'desc'` for most recent.

```javascript
await api.users.artistStreams('username', 22369, { limit: 5, order: 'asc' })
```
```json
[{
  "id": "1b6ba76ba6ff596e55b44b4a8a59092f",
  "endTime": "2024-09-01T14:41:00.000Z",
  "playedMs": 175459,
  "trackId": 188745898,
  "trackName": "Espresso",
  "albumId": 25631099,
  "artistIds": [22369]
}]
```

```javascript
api.users.artistStreams(userId, artistId, { limit?, order? })
api.users.trackStreams(userId, trackId, { limit?, order? })
api.users.albumStreams(userId, albumId, { limit?, order? })
```

Pair `limit: 1` with `order: 'asc'` / `'desc'` to get the first and last time a user played an entity.

---

## api.users.artistStats / trackStats / albumStats

Total plays + listening time for a single entity (no cardinality, no rank). Same signature for tracks and albums.

```javascript
await api.users.artistStats('username', 22369, { range: 'lifetime' })
```
```json
{ "count": 21114, "durationMs": 3732360164 }
```

There is no rank field. To find an entity's rank among a user's artists, fetch `topArtists` (caps at ~500) and match `position`:

```javascript
const all = await api.users.topArtists('username', { range: 'lifetime', limit: 500 });
const rank = all.find(a => a.artist.id === 22369)?.position; // undefined ⇒ outside top 500
```

---

## api.users.artistDateStats / trackDateStats / albumDateStats

Listening aggregated by clock-hour, weekday, month-day, month, and year for one entity. `hours` (keys `0`–`23`) builds a listening clock.

```javascript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
await api.users.artistDateStats('username', 22369, tz, { range: 'lifetime' })
```
```json
{
  "hours":    { "0": { "count": 1203, "durationMs": 213117744 }, "17": { "count": 1463, "durationMs": 254997499 } },
  "weekDays": { "0": { "count": 0, "durationMs": 0 } },
  "months":   { "1": { "count": 908, "durationMs": 153474947 } },
  "years":    { "2024": { "count": 0, "durationMs": 0 } }
}
```

---

## api.artists.tracks / topTracks / topAlbums / related / topListeners

Global, account-free artist context. `related` can be `[]`. `topListeners` needs an authenticated token — it returns **403 Forbidden** here, so guard it with `.catch(() => [])`.

```javascript
await api.artists.tracks(22369)              // → Track[]
await api.artists.topTracks(22369)           // → Track[] (most popular)
await api.artists.topAlbums(22369)           // → Album[]
await api.artists.related(22369)             // → Artist[] (may be empty)
await api.artists.topListeners(22369)        // → TopUser[]  (403 without auth)
await api.artists.topListeners(22369, true)  // friends only (403 without auth)
```

---

## api.users.currentlyStreaming(userId)

```javascript
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

---

## api.users.recentlyStreamed(userId, { limit? })

```javascript
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
    "artists": [{ "id": 39118, "name": "Madison Beer", "image": "https://..." }],
    "albums": [{ "id": 1365235, "name": "Life Support", "image": "https://..." }],
    "spotifyPopularity": 52,
    "externalIds": { "spotify": ["..."], "appleMusic": ["..."] }
  },
  "durationMs": 229881,
  "contextId": "spotify:album:..."
}]
```

---

## api.artists.get(id)

```javascript
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
  "externalIds": {
    "spotify": ["..."],
    "appleMusic": ["..."]
  }
}
```

---

## api.artists.albums(id)

```javascript
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

Paginated (~50, mostly `type: 'single'`) — not the full catalog. For a user's most-played albums by an artist, use `api.users.topAlbumsFromArtist`.

---

## api.albums.get(id) / api.albums.tracks(id)

```javascript
await api.albums.get(56735245)
// → same shape as above

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

---

## api.tracks.get(id)

```javascript
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

---

## api.charts.topTracks / topArtists / topAlbums

Global charts, no account needed.

```javascript
await api.charts.topTracks({ range: 'today' })
// → TopTrack[] (same shape as user top tracks, but global)

await api.charts.topArtists({ range: 'today' })
await api.charts.topAlbums({ range: 'today' })
```

---

## api.users.friends(userId)

```javascript
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

---

## Full API

This cheat sheet covers the most useful methods. The library exposes more (user profiles, related artists, batch lookups, audio features, etc.). For the full API surface, install the typings and explore:

```bash
npm i -D @statsfm/statsfm.js
```

Then look into `node_modules/@statsfm/statsfm.js/dist/` — the `.d.ts` files are the complete documentation.
