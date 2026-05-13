import { Command } from 'commander';
import { getApi } from '../utils/api.js';
import type { SearchTypes, v1 } from '@statsfm/statsfm.js';

const VALID_TYPES = ['artist', 'track', 'album'];

interface SearchQuery {
  query: string;
  type: SearchTypes;
}

function parseSearchArgs(args: string[]): SearchQuery[] {
  const queries: SearchQuery[] = [];
  for (let i = 0; i < args.length; i++) {
    const query = args[i];
    const next = args[i + 1];
    const type = (next && VALID_TYPES.includes(next)) ? args[++i] : 'artist';
    queries.push({ query, type: type as SearchTypes });
  }
  return queries;
}

function printResults(type: SearchTypes, results: { artists?: v1.Artist[]; tracks?: v1.Track[]; albums?: v1.Album[] }, limit: number): void {
  if (type === 'artist') {
    for (const a of (results.artists ?? []).slice(0, limit)) {
      const genres = a.genres?.length ? `  [${a.genres.slice(0, 2).join(', ')}]` : '';
      console.log(`  [${a.id}] ${a.name}${genres}`);
    }
  }

  if (type === 'track') {
    const tracks = [...(results.tracks ?? [])].sort((a, b) => b.spotifyPopularity - a.spotifyPopularity);
    for (const t of tracks.slice(0, limit)) {
      const artist = t.artists?.[0]?.name ?? '?';
      console.log(`  [${t.id}] ${t.name} by ${artist}`);
    }
  }

  if (type === 'album') {
    const albums = [...(results.albums ?? [])].sort((a, b) => b.spotifyPopularity - a.spotifyPopularity);
    for (const a of albums.slice(0, limit)) {
      const artist = a.artists?.[0]?.name ?? '?';
      console.log(`  [${a.id}] ${a.name} by ${artist}`);
    }
  }
}

export function registerSearch(program: Command): void {
  program
    .command('search')
    .description('Search for artists, tracks, or albums. Supports multiple queries: search "name" type "name2" type2')
    .argument('<args...>', 'Query/type pairs: "query" [artist|track|album] ...')
    .option('-l, --limit <n>', 'Results per query', '5')
    .action(async (args: string[], opts: { limit: string }) => {
      const api = getApi();
      const limit = parseInt(opts.limit);
      const queries = parseSearchArgs(args);

      const results = await Promise.all(
        queries.map(({ query, type }) =>
          api.search.searchElastic(query, [type], { limit })
            .then(r => ({ query, type, results: r }))
        )
      );

      for (const { query, type, results: r } of results) {
        const items = type === 'artist' ? r.artists : type === 'track' ? r.tracks : r.albums;
        console.log(`${type}: "${query}"${!items?.length ? ' — no results' : ''}`);
        printResults(type, r, limit);
      }
    });
}
