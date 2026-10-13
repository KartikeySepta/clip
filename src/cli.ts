import { version } from '../package.json';

export function main(argv: string[]): number {
  if (argv.includes('--version')) {
    console.log(version);
    return 0;
  }
  console.error('clip: nothing to do yet');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
