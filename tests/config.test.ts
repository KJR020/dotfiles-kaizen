import { describe, expect, it } from 'vitest';
import { findDomainById, loadConfig } from '../src/config.js';

const sampleConfig = {
  version: '1.0',
  domains: [
    {
      id: 'typescript-best-practices',
      name: 'TypeScript Best Practices',
      description: 'Ensure TS docs stay modern',
      day_of_week: 1,
      target_files: ['**/*.md'],
      search_hints: {
        primary_keywords: ['typescript', 'best practices'],
        focus_areas: ['doc', 'example'],
        exclude_terms: ['deprecated']
      },
      analysis_context: {
        current_version: '1.0',
        priority_aspects: ['clarity', 'accuracy']
      }
    }
  ],
  global_settings: {
    max_search_results: 5,
    analysis_temperature: 0.2,
    issue_labels: ['dotfiles-kaizen']
  }
};

it('loads and validates configuration', async () => {
  const fs = await import('node:fs/promises');
  const file = await fs.mkdtemp('/tmp/dk-config-');
  const path = `${file}/config.json`;
  await fs.writeFile(path, JSON.stringify(sampleConfig));

  const config = loadConfig(path);
  expect(config.domains).toHaveLength(1);
  expect(config.global_settings.max_search_results).toBe(5);
});

describe('findDomainById', () => {
  it('returns the matching domain', () => {
    const domain = findDomainById(sampleConfig as any, 'typescript-best-practices');
    expect(domain?.name).toBe('TypeScript Best Practices');
  });

  it('returns undefined for missing domain', () => {
    const domain = findDomainById(sampleConfig as any, 'missing');
    expect(domain).toBeUndefined();
  });
});
