---
name: statsfm
description: Comprehensive Music data tool for Spotify and Apple Music, powered by the stats.fm API. Look up album tracklists, artist discographies, and global charts without an account. With a stats.fm username, query personal Spotify listening history, play counts, top artists/tracks/albums, monthly breakdowns, and currently playing.
allowed-tools: Bash(node *)
---

# stats.fm Skill

Query Spotify listening data through the stats.fm API. Personal stats, artist deep dives, discovery timelines, discographies, and global charts.

**CLI:** `node js/cli.cjs <command> [flags]`
**Library:** `require('js/statsfm.cjs')` — for custom analysis, data export, and anything the CLI doesn't cover. See [library.md](library.md).

### When to use what

- **CLI** — simple questions, quick lookups, anything that doesn't need precise numbers or data manipulation. "Who am I listening to?" "Show me my top tracks." "When did I discover this artist?"
- **Library** — building charts, comparison tables, ratio calculations, data export, cross-referencing multiple queries, or anything that needs structured data. Write JS code, import the library, process the results.
- **Search** — prefer the CLI for search (`search "query" -t artist`). Search results contain duplicates and fakes — you need to evaluate which result is correct before using the ID. The CLI naturally forces you to read the output first. If you use the search API in JS, never just grab `results[0]` — always inspect the results.

## Setup

Check memory for a stats.fm username. If you don't have one, ask — all personal commands need `--user USERNAME` (`-u`). Public commands (search, album, artist, charts) work without a username.

Note the user's timezone if you don't know it — history commands need it for accurate daily breakdowns. You can get it from their stats.fm profile (`profile -u USERNAME` shows their timezone), or just ask them. **Save both the username and timezone to memory** the first time you get them so future sessions don't have to look them up again.

## How to Be Good at This

This skill is worthless if you call one command and dump the output. Music is personal. Your job is to investigate, find the story in the data, and tell it back. You're a music analyst with unlimited API calls — act like it.

### Understanding the data

Before you interpret anything, know what the numbers mean:

- **Streams** — number of times a song was played. One stream = one play of one track.
- **Unique tracks** — number of distinct songs played in a given period. High streams with low unique tracks = looping the same songs. High unique tracks with relatively low streams = exploring.
- **Unique albums** — number of albums where at least ONE track was played. This does NOT mean full album listens. 50 unique albums and 200 streams = touching one or two songs per album. 5 unique albums and 200 streams = deep-diving albums front to back.
- **Unique artists** — same logic. Low unique artists + high streams = loyalist. High unique artists = explorer or playlist-driven.
- **playedMs / durationMs** — actual listening time in milliseconds. If playedMs is significantly lower than expected (streams × avg track length), they're skipping tracks early.
- **Position** — rank in a top list. Position 1 = most played.

**Numbers don't tell stories, ratios do.** 500 streams means nothing. 500 streams out of 600 total that month? That's obsession. 500 out of 5,000? Background noise. Always divide: artist streams ÷ total streams = share. Unique tracks ÷ total streams = variety ratio. This month's plays ÷ last month's plays = momentum. The raw number is the ingredient — the ratio is the insight.

**Reading listener profiles from cardinality:**

| Pattern | Interpretation |
|---------|----------------|
| Low unique albums, high streams | Album listener — plays albums front to back repeatedly |
| High unique albums, high streams | Shuffle/playlist listener — touching lots of albums but not deep-diving |
| Low unique artists, high streams | Loyalist — small rotation of favorites |
| High unique artists, low streams each | Explorer — sampling widely, not committing |
| High streams, low playedMs per stream | Skipper — starting tracks but not finishing them |

### Core principles

**1. Never stop at one call.** ALWAYS check recent first (`-r 4w`). Lifetime alone is accumulation, not what's happening now. If the first result doesn't match what the user is saying, check another range before responding.

**2. `artist-history` first for any single-artist question.** The monthly breakdown shows when they blew up, when they faded, where they are right now. `top artists` gives you a rank. `artist-history` gives you the arc. Never answer a single-artist question with only `top artists` output.

**3. Always check total streams as context.** Raw play counts mean nothing without the denominator. An artist dropping from 1,560 to 937 plays looks like a 40% decline, but if total listening also dropped that month, their share barely moved. Run `stream-stats` for the same period before calling anything a decline or surge.

**4. Go wide, then narrow.** Always pull more context than you think you need — the monthly arc, the weekly zoom, the daily granularity, the surrounding artists, the track-level breakdown, the total stream context. You can always ignore what's not interesting — you can't find what you didn't pull. When you spot something interesting (a spike, a gap, a transition), zoom in immediately with daily granularity.

**5. First play ≠ fandom.** The first time someone plays an artist means nothing — it might be a smash hit everyone heard. The real question is always: what happened between the first casual listen and the obsession? Investigate the gap. Find the bridge song. Don't stop at "September 8 was the first play" when the real conversion happened 5 months later.

> **Note:** The `top` command is unified — use `top artists`, `top tracks`, `top albums`, `top genres`. For drill-downs, use `top tracks --from-artist ID` or `top tracks --from-album ID`. Charts are also unified: `charts tracks`, `charts artists`, `charts albums`.

### How to investigate

When someone asks about an artist, a phase, or a discovery moment, think like an investigator:

**Start broad:** `artist-history` (defaults to lifetime) gives the monthly arc. Where are the spikes? Where are the gaps? Where did it start, peak, and (if applicable) decline?

**Zoom into transitions:** The interesting story is always at the inflection points — the week before an explosion, the month an artist went from casual to obsessive, the period where two artists overlapped. Use `--granularity daily` on these windows.

**Get the full context:** What else was playing that day? (`top artists`, `top tracks` for the same date range.) What tracks appeared as breadcrumbs before the explosion? (`top tracks --from-artist` for the pre-explosion period.) How big was the total pie? (`stream-stats` for the same period.)

**Track the breadcrumbs:** Artists don't go from 0 to obsession overnight. There's usually a gateway track, then a second song from a different album, then a third that triggers the deep dive. Map these out with `top tracks --from-artist` across the transition period.

**Calculate share when comparing periods.** Artist plays ÷ total streams = share. Share changes tell you whether someone's listening habits actually shifted or whether total volume just fluctuated.

### Workflow patterns

**"Tell me about my [artist] phase"** — the deep dive
1. `artist-history ID` lifetime → find the arc (start, peak, current)
2. `artist-history ID --start YYYY-MM --end YYYY-MM` this month → where are they right now?
3. `artist-history ID -g weekly --start YYYY-MM --end YYYY-MM` on the hot period → zoom in on the peak
4. `top tracks --from-artist ID -r all` → which songs define the phase
5. `top tracks --from-artist ID -r 4w` → which songs are active now vs. then?
6. `top albums --from-artist ID` → album-level view
7. `stream-stats` for peak month and current month → total context and share comparison
8. `top artists` for peak month → who else was competing for attention?

*Goal: When did this start, what peaked, what's the signature track, who else was in the picture, is it still going or fading?*

**"When did I discover [artist]?"** — the origin story
1. `artist-history ID` lifetime → find first appearance AND explosion month
2. `artist-history ID -g daily --start YYYY-MM --end YYYY-MM` on the transition → find the exact conversion day
3. `first-listen artist ID` → the actual first plays with dates
4. `top tracks --from-artist ID --start YYYY-MM --end YYYY-MM` for pre-explosion period → what tracks were breadcrumbs
5. `top tracks --from-artist ID --start YYYY-MM-DD --end YYYY-MM-DD` for explosion week → what track triggered it
6. `top artists --start YYYY-MM-DD --end YYYY-MM-DD` for the first day → what world were they listening in?
7. `top tracks --start YYYY-MM-DD --end YYYY-MM-DD` for the explosion day → full picture of the conversion moment
8. `track-history TRACKID` on the gateway track → how did it spread from there?
9. `stream-stats --start YYYY-MM --end YYYY-MM` for the transition month → total listening context

*Goal: Find the gateway track, the bridge track, the conversion moment, and what triggered the deep dive. The gap between first listen and obsession IS the story.*

**"What's my [artist] breakdown look like this year?"** — the status check
1. `artist-history ID --start 2025 --end 2026` → monthly totals
2. `artist-history ID --start YYYY-MM --end YYYY-MM` this month → current trajectory
3. `top tracks --from-artist ID --start 2025 --end 2026` → current favorites
4. `top tracks --from-artist ID -r 4w` → what's actually playing right now?
5. `artist-history ID` lifetime → compare to history
6. `stream-stats --start YYYY-MM --end YYYY-MM` for this month and same month last year → share comparison

*Goal: Where does this year rank vs. history? Is the artist's share growing, stable, or shrinking?*

**"How do I listen to [album]?"** — the album autopsy
1. `album ID` → full tracklist
2. `album-history ID` lifetime → total plays and arc
3. `album-history ID --start YYYY-MM --end YYYY-MM` → is it still active?
4. `top tracks --from-album ID -r all` → track ranking by play count
5. `top tracks --from-album ID -r 4w` → has the favorite track shifted?

*Goal: Which tracks carry the album? Front-to-back or cherry-pick? Which tracks get skipped? Still active or nostalgia?*

**"What have I been into lately?"** — the snapshot
1. `top artists -r 4w` → right now
2. `top artists -r 6m` → broader view
3. `top artists -r all` → for comparison only
4. `now-playing` → anchor to what's playing right now
5. `stream-stats -r 4w` and `stream-stats -r 6m` → total volume context and trend

*Goal: Paint the current moment. What's dominating? What's surprising? Who's rising, who's falling?*

### Voice and tone

- **Be specific.** "You've averaged 4 plays a day of this track for two weeks straight" tells a story. "You really like this artist" tells nothing.
- **Notice patterns.** Spikes, drop-offs, seasonal rhythms, transitions — call them out.
- **Numbers are scaffolding.** Don't list every month. Pick the interesting ones and weave them into observations.
- **Compare things.** A number alone means nothing. 200 plays means different things depending on whether total streams that month were 2,000 or 5,000. Always contextualize.
- **Editorialize lightly.** You're having a music conversation, not filing a report.
- **Don't narrate your process.** Never say "I'll now run artist-history." Just do it.

## Finding IDs

**Always use the search CLI first** to find IDs. Search is keyword-based, NOT semantic — search for the exact name, don't combine artist + track in one query. `"espresso"` works, `"sabrina espresso"` won't.

```bash
# Single search
node js/cli.cjs search "sabrina carpenter" artist

# Multiple searches in one call (runs in parallel)
node js/cli.cjs search "sabrina carpenter" artist "olivia rodrigo" artist "espresso" track
```

**Search returns duplicates.** For artists, prefer results with genre tags — they're more likely the real one. For tracks/albums, results are sorted by Spotify popularity. Use the first result unless something looks obviously wrong. When still ambiguous, search the artist first, get their ID, then use `artist ID` to browse their discography.

## Time Range Translations

| User says | You use |
|-----------|---------|
| "this year" / "in 2025" | `--start 2025 --end 2026` |
| "last year" | `--start 2024 --end 2025` |
| "this month" | `--start 2025-05 --end 2025-06` (adjust to current month) |
| "last summer" | `--start 2025-06 --end 2025-09` |
| "lately" / "recently" | `-r 30d` (and maybe compare to `-r all`) |
| "ever" / "all time" | `-r all` |
| "this week" | `-r 7d` |
| "when did I start" | `-r all` then read the monthly breakdown |

## Edge Cases

- **Empty results?** Retry with `-r all` automatically. If still empty, the profile might be private.
- **Free (non-Plus) users:** Play counts won't appear in top lists. Rankings and monthly breakdowns still work — lead with those.
- **Rate limiting:** Don't hold back. Deep dives take as many calls as they take. That's what this skill is for.
- **Search duplicates:** Use the first result unless something looks obviously wrong.
- **No username in memory:** Ask once, remember it.

---

## CLI Reference

Everything below is command-level documentation. The workflows above are how you *should* use these — this section is for looking up flags and syntax when you need them.

All commands: `node js/cli.cjs <command> [args] [flags]`

Global flags for all personal commands: `--user USERNAME` / `-u USERNAME`

### Commands

**Profile & Activity**

| Command | Description |
|---------|-------------|
| `profile` | Username, pronouns, bio, Plus status, Spotify sync info |
| `now-playing` / `np` | Currently playing track |
| `recent` | Recently played tracks |
| `stream-stats` | Overall summary: total streams, time, unique counts |

**Your Top Lists**

| Command | Description | Key flags |
|---------|-------------|-----------|
| `top artists` | Most played artists | `--range`, `--start/--end`, `--limit` |
| `top tracks` | Most played tracks | `--range`, `--start/--end`, `--limit` |
| `top albums` | Most played albums | `--range`, `--start/--end`, `--limit` |
| `top genres` | Top genres | `--range`, `--start/--end`, `--limit` |

**History (with breakdowns)**

| Command | Description | Key flags |
|---------|-------------|-----------|
| `artist-history <id>` | Play count, time, breakdown for an artist | `--start/--end`, `--granularity` |
| `track-history <id>` | Play count, time, breakdown for a track | `--start/--end`, `--granularity` |
| `album-history <id>` | Play count, time, breakdown for an album | `--start/--end`, `--granularity` |
| `listening-history` | Total listening breakdown over time | `--start/--end`, `--granularity` |

> **Note:** History commands do NOT support `--range`. Use `--start/--end` for custom windows, or omit both to get lifetime.

**Lookups (no account needed)**

| Command | Description | Key flags |
|---------|-------------|-----------|
| `search <query>` | Find artists, tracks, or albums | `--type artist\|track\|album` |
| `artist <id>` | Artist profile + albums (use --type all for singles) | `--type`, `--limit` |
| `track <id>` | Track info: name, artists, album, duration | |
| `album <id>` | Album info and full tracklist | |

**Drill-Down (your stats within an artist/album)**

| Command | Description | Key flags |
|---------|-------------|-----------|
| `top tracks --from-artist ID` | Your most played tracks by this artist | `--range`, `--limit` |
| `top tracks --from-album ID` | Your most played tracks on this album | `--range`, `--limit` |
| `top albums --from-artist ID` | Your most played albums by this artist | `--range`, `--limit` |

**Discovery**

| Command | Description | Key flags |
|---------|-------------|-----------|
| `first-listen <type> <id>` / `first` | Show first N streams for an artist, track, or album | `--limit` |

**Global Charts (no account needed)**

| Command | Description | Key flags |
|---------|-------------|-----------|
| `charts tracks` | Global top tracks | `--range`, `--limit` |
| `charts artists` | Global top artists | `--range`, `--limit` |
| `charts albums` | Global top albums | `--range`, `--limit` |

### Date Range Flags

**Predefined:** `--range today`, `4w` (default), `6m`, `all`

**Duration:** `--range 7d`, `14d`, `30d`, `90d`

**Custom:** `--start YYYY[-MM[-DD]]` and `--end YYYY[-MM[-DD]]`

### Granularity

`--granularity monthly` (default) | `weekly` | `daily` | `yearly`

Works with `artist-history`, `track-history`, `album-history`, `listening-history`.

### Other Flags

| Flag | Description |
|------|-------------|
| `--limit N` / `-l N` | Limit results (default: 15) |
| `--raw` | Disable table formatting (tab-separated output) |

---

## Programmatic Library Access

For custom analysis, data export, cross-referencing, ratio calculations, or anything the CLI doesn't cover — use the bundled JavaScript library directly.

```javascript
const { Api } = require('js/statsfm.cjs');
const api = new Api();

// All methods are async
const topArtists = await api.users.topArtists('username', { range: 'weeks' });
```

This gives you raw structured data to manipulate, combine, and calculate with. Use it when you need to compute ratios, cross-reference multiple queries, export data, or build custom views the CLI can't produce.

Full library API documentation: [library.md](library.md)
