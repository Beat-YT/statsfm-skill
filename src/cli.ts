import { Command } from 'commander';
import { registerSearch } from './commands/search.js';
import { registerProfile } from './commands/profile.js';
import { registerTop } from './commands/top.js';
import { registerHistory } from './commands/history.js';
import { registerStats } from './commands/stats.js';
import { registerLookup } from './commands/lookup.js';
import { registerCharts } from './commands/charts.js';
import { registerDiscovery } from './commands/discovery.js';
import { registerOverview } from './commands/overview.js';

const program = new Command();

program
  .name('statsfm')
  .description('stats.fm CLI — Query Spotify listening statistics')
  .version('1.0.0');

registerSearch(program);
registerProfile(program);
registerTop(program);
registerHistory(program);
registerStats(program);
registerLookup(program);
registerCharts(program);
registerDiscovery(program);
registerOverview(program);

program.parseAsync(process.argv);
