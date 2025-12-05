import type { z } from 'zod';
import type { domainConfigSchema } from './config.js';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface ResearchOutput {
  sources: SearchResult[];
  summary: string;
  searchQuery: string;
}

export interface AnalysisOutput {
  gapAnalysis: string;
  recommendations: string;
  implementationGuide: string;
  fullResponse: string;
}

export type DomainConfig = z.infer<typeof domainConfigSchema>;
export type DomainDefinition = DomainConfig['domains'][number];
export type GlobalSettings = DomainConfig['global_settings'];

export interface WorkflowContext {
  contentBase: string;
  githubToken?: string;
  issueRepoOverride?: string;
}
