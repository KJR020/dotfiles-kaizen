import { expect, it } from 'vitest';
import { readTargetFiles } from '../src/utils/file-reader.js';

it('reads and formats markdown files', async () => {
  const fs = await import('node:fs/promises');
  const dir = await fs.mkdtemp('/tmp/dk-files-');
  await fs.writeFile(`${dir}/a.md`, '# Alpha');
  await fs.writeFile(`${dir}/b.md`, '# Beta');

  const result = await readTargetFiles(['*.md'], dir);
  expect(result).toContain('### File: a.md');
  expect(result).toContain('# Beta');
  expect(result.split('---').length).toBeGreaterThan(1);
});

it('handles missing matches', async () => {
  const fs = await import('node:fs/promises');
  const dir = await fs.mkdtemp('/tmp/dk-files-');
  const result = await readTargetFiles(['*.md'], dir);
  expect(result).toBe('No matching files found.');
});
