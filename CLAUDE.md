# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

This repo is a skill: `statsfm`. It queries Spotify and Apple
Music listening data through the [stats.fm](https://stats.fm) API. It ships two
things:

- **A CLI** (`src/cli.ts` → bundled to `dist/js/cli.cjs`) — quick lookups:
  search, top lists, history breakdowns, stream stats, now-playing, charts,
  profile overview.
- **A library** (`src/index.ts` → bundled to `dist/js/statsfm.cjs`) — the API
  client for custom analysis and anything the CLI doesn't cover.

It's built on top of [@statsfm/statsfm.js](https://github.com/statsfm/statsfm.js).

The skill's actual instructions live in **`SKILL.md`** (with a YAML frontmatter
header). `library.md` is the API cheat sheet. `README.md` is for human readers.

## Repo layout

```
SKILL.md            # The skill instructions Claude follows when the skill runs
library.md          # Library API cheat sheet (response shapes, methods)
README.md           # Human-facing project readme
src/
  cli.ts            # CLI entrypoint (commander)
  index.ts          # Library entrypoint (exports Api)
  commands/         # One file per CLI command group
  utils/            # api.ts (client), format.ts (output formatting)
shims/              # esbuild shims (fetch, file-type) for bundling
esbuild.config.ts   # Bundles src → dist/js/*.cjs, copies SKILL.md + library.md
```

## Build & check

```bash
npm install
npm run bundle    # esbuild → dist/js/cli.cjs + dist/js/statsfm.cjs
npx tsc --noEmit  # type check
```

There is no test suite. Type-check with `tsc --noEmit` and, when relevant,
run the built CLI against a real username to confirm behavior.

## Documentation discipline

- **Always document new features in `SKILL.md`** after making changes — new CLI
  commands, new flags, new library methods, and interpretation caveats all
  belong there so the skill actually knows about them. `library.md` may also
  need updating for library-level changes.
- **But discuss it with the user first.** Don't unilaterally decide how a
  feature gets documented or worded — propose the doc change and confirm with
  the user before writing it. SKILL.md wording shapes how the skill behaves, so
  it's the user's call.

## Git discipline — READ THIS

**Commit is not the same as push.** They are two separate actions and neither is
implied by making a change.

- **Never commit and never push after a change unless the user explicitly says
  so**, for that specific change. A change being finished is not permission to
  commit it.
- Permission is **per-request, not standing.** "Commit this" authorizes one
  commit of the change at hand — it does **not** authorize pushing, and it does
  **not** carry over to the next change. Ask/wait again each time.
- "Commit" means commit only. "Push" means push. If the user says "commit,"
  do not push. If they want both, they'll say both (or say push).
- Default branch is `master`. Develop on the branch you're told to use; never
  push to a different branch without explicit permission.

## Style

- Match the surrounding code's idiom, naming, and comment density.
- SKILL.md is terse and analysis-focused on purpose — keep additions in that
  voice. The skill's job is interpreting data (shares, denominators, context),
  not just retrieving it.
