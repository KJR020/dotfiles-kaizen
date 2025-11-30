import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { logger } from './logger.js';

export async function readTargetFiles(targetPatterns: string[], basePath: string): Promise<string> {
  const cwd = path.resolve(basePath);
  const files = await fg(targetPatterns, { cwd, absolute: true, dot: false, onlyFiles: true });

  if (files.length === 0) {
    return 'No matching files found.';
  }

  const chunks: string[] = [];
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const relative = path.relative(cwd, file);
      chunks.push(`### File: ${relative}\n\n${content}`);
    } catch (error) {
      logger.warn('Failed to read file', { file, error: (error as Error).message });
    }
  }

  return chunks.join('\n\n---\n\n');
}
