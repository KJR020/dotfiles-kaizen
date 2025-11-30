import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const searchHintsSchema = z.object({
  primary_keywords: z.array(z.string()).min(1),
  focus_areas: z.array(z.string()).min(1),
  exclude_terms: z.array(z.string()).optional().default([]),
  exclude_domains: z.array(z.string()).optional().default([]),
  include_domains: z.array(z.string()).optional().default([])
});

export const domainSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  day_of_week: z.number().int().min(1).max(7),
  target_files: z.array(z.string()).min(1),
  search_hints: searchHintsSchema,
  analysis_context: z
    .object({
      current_version: z.string().optional(),
      priority_aspects: z.array(z.string()).optional().default([])
    })
    .default({ priority_aspects: [] })
});

export const globalSettingsSchema = z
  .object({
    max_search_results: z.number().int().positive().default(5),
    analysis_temperature: z.number().min(0).max(1).default(0.3),
    issue_labels: z.array(z.string()).optional().default(['dotfiles-kaizen'])
  })
  .default({ max_search_results: 5, analysis_temperature: 0.3, issue_labels: ['dotfiles-kaizen'] });

export const domainConfigSchema = z.object({
  version: z.string().optional(),
  domains: z.array(domainSchema),
  global_settings: globalSettingsSchema
});

export type DomainConfig = z.infer<typeof domainConfigSchema>;

export function loadConfig(configPath: string): DomainConfig {
  const resolved = path.resolve(configPath);
  const raw = readFileSync(resolved, 'utf-8');
  const parsed = JSON.parse(raw);
  const normalized = normalizeConfigShape(parsed);
  return domainConfigSchema.parse(normalized);
}

export function findDomainById(config: DomainConfig, domainId: string) {
  return config.domains.find((domain) => domain.id === domainId);
}

function normalizeConfigShape(raw: any): any {
  if (!raw) return raw;
  if (raw.globalSettings && !raw.global_settings) {
    return { ...raw, global_settings: raw.globalSettings };
  }
  return raw;
}
