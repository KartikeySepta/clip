// Bundle the CLI into a committed bin/ file so `npx @atpes/clip` needs no install step.
import { build } from 'esbuild';

await build({
  entryPoints: { clip: 'src/cli.ts' },
  outdir: 'bin',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
});
console.log('built bin/clip.cjs');
