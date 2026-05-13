# statsfm-skill

A Claude Code skill for querying Spotify and Apple Music listening data through the [stats.fm](https://stats.fm) API. Includes a full CLI and a bundled JavaScript library for programmatic access.

Built on top of [@statsfm/statsfm.js](https://github.com/statsfm/statsfm.js).

## What it does

- **CLI** — search artists/tracks/albums, view top lists, listening history breakdowns, stream stats, currently playing, discovery timelines, global charts, and a full profile overview
- **Library** — bundled API client for custom analysis, data export, ratio calculations, and anything the CLI doesn't cover

## Quick start

```bash
npm install
npm run bundle
```

This produces `dist/` — the distributable skill:

```
dist/
├── SKILL.md        # Skill instructions
├── library.md      # Library API cheat sheet
└── js/
    ├── cli.cjs     # CLI (~222KB)
    └── statsfm.cjs # API library (~75KB)
```

## CLI usage

```bash
node dist/js/cli.cjs <command> [flags]

# Search (supports multiple queries in parallel)
node dist/js/cli.cjs search "sabrina carpenter" artist "espresso" track

# Profile overview
node dist/js/cli.cjs overview -u username

# Top artists/tracks/albums/genres
node dist/js/cli.cjs top artists -u username -r 4w -l 10

# Drill down into an artist's tracks
node dist/js/cli.cjs top tracks --from-artist 22369 -u username

# Listening history with breakdowns
node dist/js/cli.cjs artist-history 22369 -u username -g monthly

# Stream stats
node dist/js/cli.cjs stream-stats -u username -r all

# Currently playing
node dist/js/cli.cjs np -u username

# Global charts
node dist/js/cli.cjs charts tracks -r today
```

## Library usage

```javascript
const { Api } = require('./dist/js/statsfm.cjs');
const api = new Api();

const artists = await api.users.topArtists('username', { range: 'weeks', limit: 10 });
const stats = await api.users.stats('username', { range: 'lifetime' });
const perDay = await api.users.artistPerDayStats('username', 22369, 'America/Toronto');
```

See [library.md](library.md) for the full API cheat sheet with response shapes.

## Installing as a Claude skill

Copy the `dist/` folder into your Claude skills directory:

```bash
cp -r dist/ ~/.claude/skills/statsfm/
```

## Development

```bash
npm install
npm run bundle    # Build dist/
npx tsc --noEmit  # Type check
```

## Credits

- [stats.fm](https://stats.fm) — the platform and API
- [@statsfm/statsfm.js](https://github.com/statsfm/statsfm.js) — the official JavaScript client this project bundles

## License

MIT
