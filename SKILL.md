---
name: statsfm
description: Music data analysis tool for Spotify and Apple Music, powered by the stats.fm API. Explains what listening data means — computes shares, normalizes periods, and contextualizes every number. Look up album tracklists, artist discographies, and global charts without an account. With a stats.fm username, analyze personal Spotify listening history, trends, and patterns.
allowed-tools: Bash(node *)
---

# stats.fm Skill

Explain what a user's listening data means. You have unlimited API access to stats.fm for Spotify and Apple Music data. Your job is not retrieval — it is analysis. Every number you present must carry context: a share, a comparison, a denominator. Raw counts alone are never an answer.

```js
const { Api } = require('./js/statsfm.cjs');
const api = new Api();
```

**Path note:** The require path is `./js/statsfm.cjs` — relative to the skill directory, not `node_modules`. Always use `./js/`.

This is your primary tool. Write JS to fetch, compute, and combine data. The CLI (`node js/cli.cjs`) is a quick helper — search, now-playing, browsing a tracklist. Don't overuse it. If you're running more than 2-3 CLI calls in a row, you should be using the library instead. Any question that involves a number uses the library.

---

## Data Handling Rules

These are non-negotiable. Violating any of them produces wrong output that looks correct.

- **Every count needs a denominator.** Never present a play count without total streams for the same period. This applies to everything — artists, tracks, albums, genres. Entity plays / total streams = share %. The share is the answer. Always call `api.users.stats()` for the same period alongside whatever you're querying.
- **Only compare complete periods.** If today is the 21st, this month has 21 days of data while last month had 30. Never compare them directly. Exclude the incomplete period, normalize to a daily rate, or compare the same number of elapsed days. Always label projected figures explicitly.
- **Check total volume before attributing changes.** Any entity dropping in raw plays could be a volume change, not a preference change. 500 → 300 plays looks like a 40% decline, but if total listening also dropped from 5,000 to 3,000, the share went from 10% to 10% — unchanged. Always fetch `api.users.stats()` for every period you're comparing.
- **Normalization is step one, not a follow-up.** Compute the share, rate, or normalized value *before* writing anything. The user should never see an un-contextualized count.
- **Small samples break share math.** If someone has 30 streams in a week, one artist at 10 plays = 33% share — but that's 10 plays, not a pattern. When total volume is low, lead with raw counts and daily rate instead of share. Flag it: "Only 30 streams this week — too few to read share patterns into."
- **Lead with data when it contradicts the user.** When the data says something different from what the user believes, state what the data shows first, then address the discrepancy. Never agree with the user's premise and then quietly present contradicting data. The user came for truth, not validation.

---

## Listener Profiling

**Do this first, before any analysis.** The same number means completely different things depending on who you're looking at. 400 plays on an artist is background noise for a loyalist with 40K streams concentrated in 5 artists. It's a top-3 obsession for an explorer with 30K streams spread across 3,000 artists. You cannot interpret any number without knowing what kind of listener you're talking to.

### How to profile

Run `overview` on first interaction with a user. It computes everything automatically:

```bash
node js/cli.cjs overview -u USERNAME -r 4w
node js/cli.cjs overview -u USERNAME --start 2025 --end 2026
```

Output includes the `Profile:` line with all key ratios:
```
Profile: replay=25.2x top5=68.5% top20=91.4% #1=36.3%
```

Read these values:

**Replay rate** (streams / unique tracks) — how much they loop.
- ~3-5x: low replay, explorer/browser behavior
- ~10-15x: moderate, healthy mix of replay and discovery
- ~20x+: heavy replayer, small active rotation

**Concentration ratio** (top 20 share of total streams) — how focused their listening is.
- <30%: wide spread, no dominant artists, playlist/radio-driven
- 30-60%: moderate focus, clear favorites but still exploring
- 60%+: highly concentrated, a few artists dominate everything
- 90%+: extreme loyalist, almost all listening goes to a handful of artists

**Top artist share** — how dominant the #1 is.
- <3%: no standout, flat distribution
- 3-10%: clear favorite but not dominant
- 10-25%: major presence in their listening
- 25%+: obsession-level, defines their listening identity

### Step 3: Calibrate your interpretation

These ratios set the scale for everything that follows. When presenting any number, frame it relative to the listener's profile:

- For a loyalist (90%+ concentration): "5% share" = minor presence. "0.5% share" = barely exists.
- For an explorer (<30% concentration): "5% share" = one of their biggest artists. "0.5% share" = normal listening level.

**The thresholds for "significant," "notable," and "noise" are different for every user.** Never use absolute play counts to judge importance. Always compare against their personal distribution.

### What cardinality does and doesn't tell you

**Unique tracks/albums/artists** = how many distinct entities had at least one play. This is breadth — how widely someone has reached. It does NOT measure depth.

- **Unique albums** counts albums where at least ONE track was played. Playing a single from an album = +1. Playing the whole album front-to-back = also +1. You cannot tell album listeners from cherry-pickers using this number alone — use `topTracksFromAlbums` on specific albums to see the track distribution within them.
- **Unique artists** can be misleading without the concentration ratio. A user with 700 unique artists sounds broad, but if 94% of streams go to 20 of them, the other 680 are noise — features, Discover Weekly, one-off curiosity. The *functional* artist count is the one that matters.

### Understanding the numbers

- **Streams** — one play of one track = one stream.
- **playedMs / durationMs** — actual listening time in ms. If playedMs is significantly lower than expected (streams x avg track length), they're skipping tracks early.
- **Position** — rank in a top list. Position 1 = most played.

**Numbers don't tell stories, ratios do.** 500 streams means nothing. 500 out of 600 total? Obsession. 500 out of 5,000? Background noise. Always compute: entity streams / total streams = share. This month / last month = momentum. The raw number is the ingredient — the ratio is the insight.

---

## Pre-Output Checklist

Before presenting any analysis, answer these questions. If any answer is "no," fix it before responding.

1. Did I profile this listener (stats + top artists, concentration ratio, replay rate)?
2. Does every count have its denominator and share percentage?
3. Are all compared periods complete (same number of days)?
4. Did I check total listening volume for the same period?
5. Is the sample size large enough for share % to be meaningful?
6. Are my interpretations calibrated to this listener's profile (not absolute thresholds)?
7. If the data contradicts the user's premise, am I leading with the data?
8. If this is a ranking, favorites, or engagement question, did I pull `PLATFORM` alongside `COUNT` and report the divergence? `COUNT` measures volume; it is blind to engagement depth.
9. Would someone who sees only my final output — not the raw data — reach the correct conclusion?

---

## Common Wrong Answers

These are the exact mistakes this skill produces when the rules above are ignored.

**Wrong: Raw counts without share**
User asks: "How much do I listen to Sabrina Carpenter?"
BAD: "You've played Sabrina Carpenter 1,247 times — she's clearly one of your favorites!"
WHY: 1,247 out of how many? If total streams are 45,000, that's 2.8% — hardly a favorite.
CORRECT: "Sabrina Carpenter: 1,247 plays out of 45,000 total (2.8% share). She's in your rotation but not dominant — your #1 artist holds 12% share."

**Wrong: Partial-month comparison**
User asks: "How's my Sabrina Carpenter listening trending this year?"
BAD: "Jan 180, Feb 210, Mar 195, Apr 220, May 140 — looks like May is a significant drop."
WHY: Today is May 21. May has 21 days; April had 30. May's daily rate is 6.7/day, projecting to ~207 — roughly flat.
CORRECT: "Jan–Apr averaged 201 plays/month. May is at 140 through 21 days (6.7/day), projecting to ~207 for the full month — on pace with prior months."

**Wrong: False decline from volume change**
User asks: "Am I losing interest in Artist X?"
BAD: "Artist X dropped from 400 to 250 plays — a 37% decline. They're fading."
WHY: Total listening also dropped (5,000 → 3,100). Share: March 8.0%, April 8.1% — unchanged.
CORRECT: "Artist X's raw plays dropped (400 → 250), but total listening dropped proportionally. Their share held steady at ~8%. You listened less to everything in April."

**Wrong: Ignoring the listener's profile**
User asks: "Do I listen to Drake a lot?"
BAD: "You've played Drake 521 times this year — he's your #15 artist!"
WHY: Without the listener profile, 521 plays and #15 sounds notable. But this user's top 20 holds 94% of their streams and their #1 has 15,323 plays. Drake at 521 / 42,193 = 1.2% share. For a listener this concentrated, 1.2% is the noise floor — barely registers. For an explorer whose #1 is at 1.1%, that same 1.2% would make Drake their top artist.
CORRECT: "Drake: 521 plays (1.2% share). For context, your top artist holds 36% and your top 20 account for 94% of your listening. Drake is at the far edge of your rotation — present but not a significant part of your listening identity."

---

## Library SDK

The library is the skill. Every analysis question — shares, trends, comparisons, breakdowns — runs through JS code using the API client.

```js
const { Api } = require('./js/statsfm.cjs');
const api = new Api();
// All methods are async. Use Promise.all() for parallel calls.
```

### Key Patterns

**Computing share — applies to artists, tracks, albums, genres:**
```js
// Always pair any top-list query with stats() for the same period
const [topArtists, totalStats] = await Promise.all([
  api.users.topArtists(user, { range: 'weeks', limit: 5 }),
  api.users.stats(user, { range: 'weeks' }),
]);
for (const item of topArtists) {
  const share = (item.streams / totalStats.count * 100).toFixed(1);
  console.log(`${item.position}. ${item.artist.name}: ${item.streams} plays (${share}% share)`);
}
// Same pattern for topTracks, topAlbums, topGenres — always divide by totalStats.count
```

**Period-over-period with normalization:**
```js
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const [perDay, stats4w, statsAll] = await Promise.all([
  api.users.artistPerDayStats(user, artistId, tz),
  api.users.stats(user, { range: 'weeks' }),
  api.users.stats(user, { range: 'lifetime' }),
]);

// Group perDay.days by month, then normalize
const months = {};
for (const [dateStr, day] of Object.entries(perDay.days)) {
  const key = dateStr.slice(0, 7);
  if (!months[key]) months[key] = { count: 0, ms: 0, days: 0 };
  months[key].count += day.count;
  months[key].ms += day.durationMs;
  months[key].days++;
}

// Normalize to daily rate — never compare raw monthly totals
for (const [month, data] of Object.entries(months)) {
  data.dailyRate = data.count / data.days;
}

// Project incomplete current month to a full-month estimate
// Use calendar date for daysElapsed, not array length (zero-play days may be missing from data)
const now = new Date();
const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const current = months[currentKey];
if (current) {
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  current.projected = Math.round(current.count / daysElapsed * daysInMonth);
  // Label projected figures explicitly: "~549 projected" not "549"
}
```

**First listen / discovery timeline:**
```js
const firstStreams = await api.users.artistStreams(user, artistId, { limit: 5, order: 'asc' });
// firstStreams[0].endTime = first ever play
// firstStreams[0].trackName = gateway track
```

**Checking total volume before attributing a change:**
```js
const marchRange = { after: Date.parse('2026-03-01'), before: Date.parse('2026-04-01') };
const aprilRange = { after: Date.parse('2026-04-01'), before: Date.parse('2026-05-01') };

const [marchArtist, aprilArtist, marchTotal, aprilTotal] = await Promise.all([
  api.users.topArtists(user, { ...marchRange, limit: 50 }),
  api.users.topArtists(user, { ...aprilRange, limit: 50 }),
  api.users.stats(user, marchRange),
  api.users.stats(user, aprilRange),
]);

const marchPlays = marchArtist.find(a => a.artist.id === artistId)?.streams ?? 0;
const aprilPlays = aprilArtist.find(a => a.artist.id === artistId)?.streams ?? 0;
const marchShare = (marchPlays / marchTotal.count * 100).toFixed(1);
const aprilShare = (aprilPlays / aprilTotal.count * 100).toFixed(1);
// Compare shares, not raw counts
```

### API Reference

All methods are async. Use `Promise.all()` for parallel calls.

**Note:** `externalIds` may not contain all providers — `spotify` and `appleMusic` arrays can be empty.

#### Ranges

```js
// Predefined
{ range: 'today' }
{ range: 'weeks' }     // last 4 weeks
{ range: 'months' }    // last 6 months
{ range: 'lifetime' }  // all time

// Custom (Unix ms)
{ after: Date.parse('2026-01-01'), before: Date.parse('2027-01-01') }

// Most methods also accept limit and offset
{ range: 'weeks', limit: 10 }
```

#### api.users.stats(userId, range)

Overall stream statistics with cardinality. **This is your denominator for every share calculation.**

```js
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

#### api.users.topArtists(userId, range)

```js
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

#### api.users.topTracks(userId, range)

```js
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

Also: `topAlbums`, `topGenres` — same shape with `album` or `genre` instead of `track`.

All top methods accept `orderBy`: `'COUNT'` (default, by play count), `'TIME'` (by listening time), `'PLATFORM'` (Spotify's algorithm ranking). `PLATFORM` is downstream of everything Spotify instruments — skip rate, seek/rewind behavior, how the user navigated to the track, playlist adds, save actions, loop behavior, session position, and dozens of other signals. It's a composite measure of engagement quality that play count is structurally blind to. Don't try to decompose it into named axes — it's a model output, not a formula. `PLATFORM` returns no play counts (`streams: null`) but includes movement indicators (`indicator: 'NEW'|'UP'|'SAME'|'DOWN'`). It is not a substitute for count data when computing shares — the denominator rules don't apply to it. It also tilts toward recent behavior, so don't anchor a lifetime claim on a 4-week `PLATFORM` ranking. Treat `PLATFORM` as a core analytical metric, not a novelty: for free users it is the only ranking available, and for everyone else the `COUNT`-vs-`PLATFORM` divergence is a primary engagement signal — see the Pre-Output Checklist. When a track over-indexes on `PLATFORM` vs `COUNT`, the interpretation is: "there's engagement depth that play count doesn't capture." The magnitude of the divergence is the insight — don't try to explain *why* it diverges by decomposing the score into named factors, because the cause is a blend of signals you can't observe from the outside. One carve-out: if the user volunteers what they did with a track — "I looped it," "I read the lyrics," "I always start sessions from it" — that is first-party evidence, not speculation. Use it, and let it override the metric: the user knows what they did, the model output is only inferring it.

```js
await api.users.topTracks('username', { range: 'weeks', orderBy: 'PLATFORM' })
// → streams: null, but indicator: "NEW" / "UP" / "SAME" / "DOWN"
```

#### api.users.topTracksFromArtist(userId, artistId, range)

Your most played tracks by a specific artist.

```js
await api.users.topTracksFromArtist('username', 39118, { range: 'lifetime', limit: 10 })
// → same shape as topTracks
```

Also: `topAlbumsFromArtist(userId, artistId, range)`, `topTracksFromAlbums(userId, albumId, range)`

#### api.users.artistPerDayStats / trackPerDayStats / albumPerDayStats

Daily play counts for building monthly/weekly arcs. Same signature and response shape for artists, tracks, and albums.

```js
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

Group the `days` keys by month/week yourself. Omit the range arg for lifetime.

```js
api.users.artistPerDayStats(userId, artistId, tz, range?)
api.users.trackPerDayStats(userId, trackId, tz, range?)
api.users.albumPerDayStats(userId, albumId, tz, range?)
```

#### api.users.artistStreams / trackStreams / albumStreams

Raw stream records. Use `order: 'asc'` for discovery (first plays), `'desc'` for most recent.

```js
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

```js
api.users.artistStreams(userId, artistId, { limit?, order? })
api.users.trackStreams(userId, trackId, { limit?, order? })
api.users.albumStreams(userId, albumId, { limit?, order? })
```

#### api.users.currentlyStreaming(userId)

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

#### api.users.recentlyStreamed(userId)

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
    "artists": [{ "id": 39118, "name": "Madison Beer", "image": "https://..." }],
    "albums": [{ "id": 1365235, "name": "Life Support", "image": "https://..." }],
    "spotifyPopularity": 52,
    "externalIds": { "spotify": ["..."], "appleMusic": ["..."] }
  },
  "durationMs": 229881,
  "contextId": "spotify:album:..."
}]
```

#### api.users.get(userId) / api.users.friends(userId)

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

#### api.artists.get(id) / api.artists.albums(id)

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
  "externalIds": {
    "spotify": ["..."],
    "appleMusic": ["..."]
  }
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

#### api.albums.get(id) / api.albums.tracks(id)

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

#### api.tracks.get(id)

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

#### api.charts.topTracks / topArtists / topAlbums

Global charts, no account needed.

```js
await api.charts.topTracks({ range: 'today' })
// → same shape as user top tracks/artists/albums, but global

await api.charts.topArtists({ range: 'today' })
await api.charts.topAlbums({ range: 'today' })
```

#### api.search.searchElastic(query, types, opts)

Prefer the CLI for search — results contain duplicates and need manual evaluation.

```js
await api.search.searchElastic('Sabrina Carpenter', ['artist'], { limit: 5 })
// → { artists?: Artist[], tracks?: Track[], albums?: Album[] }
```

---

## Setup

Check memory for a stats.fm username. If you don't have one, ask — all personal methods need a username. Public methods (entity lookups, charts, search) work without one.

Note the user's timezone — per-day stats need it for accurate daily breakdowns. Get it from their profile (`api.users.get(user)` returns `.timezone`) or ask. **Save username and timezone to memory** so future sessions don't repeat this.

### Investigation Workflows

Every workflow assumes you've already profiled the listener (stats + topArtists, concentration ratio, replay rate). If you haven't, do that first — it's the lens for interpreting everything below.

**"Tell me about my [artist] phase"** — the deep dive
1. `artistPerDayStats` lifetime → group by month, find the arc (start, peak, current)
2. Zoom into peak month with daily granularity → find the hot week
3. `topTracksFromArtist` lifetime → which songs define the phase
4. `topTracksFromArtist` last 4 weeks → which songs are active now?
5. `topAlbumsFromArtist` → album-level view
6. **[REQUIRED]** `stats` for peak month AND current month → compute share both periods. Lead with share change, not raw count change.
7. `topArtists` for peak month → who else was competing for attention?

*Goal: When did this start, what peaked, what's the signature track, who else was in the picture, is it still going or fading? Frame the artist's share relative to the listener's concentration profile — a 5% share means obsession for an explorer, background for a loyalist.*

**"When did I discover [artist]?"** — the origin story
1. `artistPerDayStats` lifetime → find first appearance AND explosion month
2. Zoom into transition with daily granularity → exact conversion day
3. `artistStreams` with `order: 'asc'` → first plays with dates and track names
4. `topTracksFromArtist` for pre-explosion period → breadcrumbs
5. `topTracksFromArtist` for explosion week → trigger track
6. `topArtists` for the first day → what world were they listening in?
7. `trackPerDayStats` on the gateway track → how did it spread?
8. **[REQUIRED]** `stats` for the transition month → total listening context and share

*Goal: Gateway track, bridge track, conversion moment, trigger. The gap between first listen and obsession IS the story.*

**"What's my [artist] breakdown this year?"** — the status check
1. `artistPerDayStats` with start/end for this year → group by month
2. `topTracksFromArtist` for this year → current favorites
3. `topTracksFromArtist` last 4 weeks → what's playing right now?
4. `artistPerDayStats` lifetime → compare to history
5. **[REQUIRED]** `stats` for this month and same month last year → share comparison. If current month is incomplete, normalize to daily rate.

*Goal: Where does this year rank vs. history? Is share growing, stable, or shrinking?*

**"How do I listen to [album]?"** — the album autopsy
1. `albums.get` + `albums.tracks` → tracklist
2. `albumPerDayStats` lifetime → total plays and arc
3. `albumPerDayStats` recent → is it still active?
4. `topTracksFromAlbums` lifetime → track ranking by play count. Look at the distribution: flat = album runner, steep = favorite-picker. A 10:1 ratio between most and least played track means they cherry-pick. A 2:1 ratio means they play most of the album.
5. `topTracksFromAlbums` last 4 weeks → has the favorite track shifted?

*Goal: Which tracks carry the album? Front-to-back or cherry-pick? Still active or nostalgia?*

**"What have I been into lately?"** — the snapshot
1. `topArtists` last 4 weeks → right now
2. `topArtists` last 6 months → broader view
3. `topArtists` lifetime → for comparison only
4. `currentlyStreaming` → anchor to what's playing
5. **[REQUIRED]** `stats` for 4 weeks and 6 months → total volume context and trend. Compute shares for top artists both periods.

*Goal: What's dominating? What's surprising? Who's rising, who's falling? Lead with shares. Interpret movement relative to the listener's concentration profile.*

### Staying Creative in Long Conversations

Don't just answer questions — notice things the user didn't ask about. The longer the conversation, the more context you have to work with. Use it. **But pick one or two threads that connect to what the user actually asked, not all of them.** An unprompted observation should feel like a sharp catch, not a data dump.

**Cross-reference `PLATFORM` against `COUNT`.** This is a core step for any ranking or favorites question — it's in the Pre-Output Checklist, not an optional flourish. After count-based analysis, pull Spotify's ranking and compare. When they disagree, that's the finding — "by play count this is #7 but Spotify ranks it #2, meaning there's engagement depth the count doesn't capture." Don't explain the divergence by decomposing the score into factors. But if the user tells you what they did with a track — looped it, read the lyrics, always starts sessions from it — that is first-party evidence, and it overrides the metric. Flag the divergence, its magnitude, and anything the user has told you. The `NEW`/`UP`/`DOWN` indicators tell a momentum story that raw counts miss.

**Ideas for going deeper:**
- **Build a chart.** Use `artistPerDayStats` grouped by week or month, normalize to daily rates, and lay out a table showing the trajectory. A visual arc is worth more than a paragraph of description.
- **Week-over-week comparisons.** Pull the last few weeks of data, compute shares for each, and show the movement. "Sabrina Carpenter: 38% → 34% → 31% over the last 3 weeks — gradual fade" is immediately clear.
- **Cross-reference what's playing now.** If `currentlyStreaming` shows an artist you've been analyzing, call it out. If it shows someone unexpected, that's a thread to pull.
- **Spot genre shifts.** Compare `topGenres` across periods. Did they go from 80% pop to 40% pop / 30% hip-hop? That's a story.
- **Find the bridge artist.** When someone transitions from one artist to another, there's often an artist in between who shares traits with both. Look at who was rising while the old favorite was fading.
- **Check if their top track is the popular one.** Compare their #1 track from an artist against `spotifyPopularity`. If their favorite is a deep cut, that says something different than if it's the biggest hit.
- **Album completion rate.** Pull `albums.tracks` to get the total count, then `topTracksFromAlbums` to see how many they actually played. 12/12 tracks played = album listener. 3/12 = cherry-picker.
- **Time-of-day patterns.** `recentlyStreamed` has timestamps — but it only returns ~50 records, so don't over-read a single night's cluster. Only call out a time pattern if it holds across multiple days of recent data.
- **Compare against global charts.** Are their top artists also charting globally, or are they in a niche? `charts.topArtists` gives the baseline.
- **First listen anniversaries.** If you pulled `artistStreams` with `order: 'asc'` earlier, you know when they discovered an artist. If the date is within a few days of today's date from a prior year, mention it.
- **The "what changed" question.** When you notice a shift between periods, don't just report it — hypothesize. New album drop? Tour? A track going viral? Check the artist's `albums` for release dates near the spike.
- **Loyalty score.** For any artist, compute streams-per-unique-track. High ratio = looping a few songs. Low ratio = exploring the catalog evenly. Compare this across their top artists to find who they're deepest into vs just casually listening to.

**Keep up with the user:** As the conversation progresses, the user will reveal what they care about — certain artists, certain periods, certain kinds of questions. Track these implicitly. If they asked about three different artists, unprompted compare those three. If they keep asking about recent data, they care about what's happening now, not history. Match your depth to their energy.

### Voice and Tone

- **Be specific.** "4 plays a day of this track for two weeks straight" tells a story. "You really like this artist" tells nothing.
- **Numbers are scaffolding.** Don't list every month. Pick the interesting ones and weave them into observations.
- **Compare things.** A number alone means nothing. 200 plays means different things at 2,000 vs. 5,000 total streams. Always contextualize.

## Finding IDs

**Use the CLI for search** — it's the one thing the CLI is best at. Search is keyword-based, NOT semantic — search for the exact name. `"espresso"` works, `"sabrina espresso"` won't.

```bash
# Single search
node js/cli.cjs search "sabrina carpenter" artist

# Multiple searches in one call (parallel)
node js/cli.cjs search "sabrina carpenter" artist "olivia rodrigo" artist "espresso" track
```

**Search returns duplicates.** For artists, prefer results with genre tags. For tracks/albums, results sort by Spotify popularity. When ambiguous, search the artist first, get their ID, then browse their discography with the `artist` CLI command.

## Time Ranges

**Library ranges:**
```js
{ range: 'today' }     // today
{ range: 'weeks' }     // last 4 weeks
{ range: 'months' }    // last 6 months
{ range: 'lifetime' }  // all time
{ after: Date.parse('2026-01-01'), before: Date.parse('2026-06-01') }  // custom
```

**Translating user language:**

| User says | You use |
|-----------|---------|
| "this year" / "in 2026" | `{ after: Date.parse('2026-01-01'), before: Date.parse('2027-01-01') }` |
| "last year" | `{ after: Date.parse('2025-01-01'), before: Date.parse('2026-01-01') }` |
| "this month" | `{ after: Date.parse('2026-05-01'), before: Date.parse('2026-06-01') }` (adjust) |
| "last summer" | `{ after: Date.parse('2026-06-01'), before: Date.parse('2026-09-01') }` |
| "lately" / "recently" | `{ range: 'weeks' }` (and compare to `{ range: 'lifetime' }`) |
| "ever" / "all time" | `{ range: 'lifetime' }` |

## Edge Cases

- **Empty results?** Retry with `{ range: 'lifetime' }` automatically. If still empty, profile might be private.
- **Free (non-Plus) users:** Play counts won't appear in top lists. Use `orderBy: 'PLATFORM'` to get Spotify's ranking with movement indicators (`NEW`/`UP`/`SAME`/`DOWN`) — this works without play counts and is the best data available for free users.
- **Rate limiting:** Don't hold back. Deep dives take as many calls as they take.

---

## CLI Reference

The CLI (`node js/cli.cjs`) is a quick helper — search, now-playing, browsing a tracklist. Don't overuse it. If you're running more than 2-3 CLI calls in a row, you should be using the library instead. Any question that involves a number uses the library.

All commands: `node js/cli.cjs <command> [args] [flags]`

Global flags for personal commands: `-u USERNAME`

**Profile & Activity:** `profile`, `now-playing` / `np`, `recent`, `stream-stats`

**Top Lists:** `top artists|tracks|albums|genres` — flags: `--range`, `--start/--end`, `--limit`

**History:** `artist-history <id>`, `track-history <id>`, `album-history <id>`, `listening-history` — flags: `--start/--end`, `--granularity monthly|weekly|daily|yearly`. History does NOT support `--range`.

**Lookups:** `search <query>` (`-t artist|track|album`), `artist <id>` (`--type album|single|all`), `track <id>`, `album <id>`

**Drill-Downs:** `top tracks --from-artist ID`, `top tracks --from-album ID`, `top albums --from-artist ID`

**Discovery:** `first-listen <artist|track|album> <id>` — flags: `--limit`

**Charts:** `charts tracks|artists|albums` — flags: `--range today|4w|6m|all`, `--limit`

**Ranges:** `--range today`, `4w` (default), `6m`, `all`, `7d`, `14d`, `30d`, `90d`. Custom: `--start YYYY[-MM[-DD]]`, `--end YYYY[-MM[-DD]]`.

**Other:** `--limit N` / `-l N` (default 15), `--raw` (tab-separated output)