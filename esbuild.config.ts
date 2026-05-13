import { build } from 'esbuild';
import { cpSync } from 'node:fs';

const shared = {
  bundle: true,
  platform: 'node' as const,
  format: 'cjs' as const,
  external: ['node:*'],
  alias: {
    'isomorphic-unfetch': './shims/fetch.ts',
    'file-type/browser': './shims/file-type.ts',
  },
  minify: false,
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ['src/cli.ts'],
    outfile: 'dist/js/cli.cjs',
    banner: { js: '#!/usr/bin/env node' },
  }),
  build({
    ...shared,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/js/statsfm.cjs',
  }),
]);

cpSync('SKILL.md', 'dist/SKILL.md');
cpSync('library.md', 'dist/library.md', { force: false });
