import { Command } from 'commander';
import { getApi } from '../utils/api.js';

export function registerProfile(program: Command): void {
  program
    .command('profile')
    .description('Show user profile')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .action(async (opts: { user: string }) => {
      const api = getApi();
      const u = await api.users.get(opts.user);

      const badges: string[] = [];
      if (u.isPlus) badges.push('Plus');
      if (u.isPro) badges.push('Pro');
      if (!u.isPlus && !u.isPro) badges.push('Free');
      const badgeStr = badges.length ? `  [${badges.join(' | ')}]` : '';
      

      const handle = u.customId && u.customId !== u.displayName ? ` / ${u.customId}` : '';
      const pronouns = u.profile?.pronouns ? ` (${u.profile.pronouns})` : '';
      console.log(`${u.displayName}${handle}${pronouns}${badgeStr}`);

      if (u.profile?.bio) console.log(`Bio: ${u.profile.bio}`);

      const tz = u.timezone ?? '?';
      console.log(`Timezone: ${tz}`);

      if (u.spotifyAuth) {
        const sp = u.spotifyAuth;
        const sync = sp.sync ? 'yes' : 'no';
        const imported = sp.imported ? 'yes' : 'no';
        const name = sp.displayName ?? '';
        const product = sp.product ?? '?';
        console.log(`Spotify: ${name}  (${product})  sync=${sync}  imported=${imported}`);
      }
    });

  program
    .command('now-playing')
    .aliases(['now', 'np'])
    .description('Show currently playing track')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .action(async (opts: { user: string }) => {
      const api = getApi();
      const item = await api.users.currentlyStreaming(opts.user);

      if (!item) {
        console.log('Nothing playing.');
        return;
      }

      const track = item.track;
      const artists = track.artists?.map(a => a.name).join(', ') ?? '?';
      const album = track.albums?.[0];
      const progress = Math.floor(item.progressMs / 1000);
      const duration = Math.floor(track.durationMs / 1000);
      const status = item.isPlaying ? 'playing' : 'paused';
      const artistId = track.artists?.[0]?.id ?? '?';

      console.log(`Status: ${status}`);
      console.log(`Track: ${track.name} (#${track.id})`);
      console.log(`Artist: ${artists} (#${artistId})`);
      if (album) console.log(`Album: ${album.name} (#${album.id})`);
      console.log(`Progress: ${Math.floor(progress / 60)}:${(progress % 60).toString().padStart(2, '0')} / ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`);
      if (item.deviceName) console.log(`Device: ${item.deviceName}`);
    });

  program
    .command('recent')
    .description('Show recently played tracks')
    .requiredOption('-u, --user <username>', 'stats.fm username')
    .option('-l, --limit <n>', 'Number of results (max 50)', '15')
    .action(async (opts: { user: string; limit: string }) => {
      const api = getApi();
      const limit = parseInt(opts.limit);

      if (limit > 50) {
        console.error('Error: limit cannot exceed 50 (API restriction)');
        process.exit(1);
      }

      const allItems = await api.users.recentlyStreamed(opts.user);

      if (!allItems?.length) {
        console.log('No recent streams found.');
        return;
      }

      const items = allItems.slice(0, limit);

      for (const stream of items) {
        const track = stream.track;
        const dt = new Date(stream.endTime);
        const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const artist = track.artists?.[0]?.name ?? '?';
        const album = track.albums?.[0]?.name ?? '?';
        console.log(`  ${time}  ${track.name}  ${artist}  ${album}  #${track.id}`);
      }

      const remaining = allItems.length - limit;
      if (remaining > 0) console.log(`  (${remaining} more)`);
    });
}
