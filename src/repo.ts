import { execFile } from 'node:child_process';

export type Visibility = 'PUBLIC' | 'PRIVATE' | 'UNKNOWN';
export type Exec = typeof execFile;

/** Visibility of the GitHub repo behind cwd, via `gh`. Any failure (no remote, not logged in) is UNKNOWN. */
export function repoVisibility(cwd: string, exec: Exec = execFile): Promise<Visibility> {
  return new Promise((resolve) => {
    exec('gh', ['repo', 'view', '--json', 'visibility'], { cwd }, (err, stdout) => {
      if (err) return resolve('UNKNOWN');
      try {
        const v = JSON.parse(String(stdout)).visibility;
        resolve(v === 'PUBLIC' ? 'PUBLIC' : v === 'PRIVATE' ? 'PRIVATE' : 'UNKNOWN');
      } catch {
        resolve('UNKNOWN');
      }
    });
  });
}

/** The repo name shown on screen (owner/name), or null. */
export function repoName(cwd: string, exec: Exec = execFile): Promise<string | null> {
  return new Promise((resolve) => {
    exec('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(String(stdout)).nameWithOwner ?? null);
      } catch {
        resolve(null);
      }
    });
  });
}
