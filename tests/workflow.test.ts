import { describe, expect, it } from 'vitest';
import { KaizenWorkflow } from '../src/workflow/kaizen-workflow.js';
import type { AnalysisOutput } from '../src/types.js';

const domain = {
  id: 'sample',
  name: 'Sample Domain',
  description: 'Testing domain',
  day_of_week: 1,
  target_files: ['**/*.md'],
  search_hints: {
    primary_keywords: ['sample'],
    focus_areas: ['testing'],
    exclude_terms: ['ignore'],
    exclude_domains: []
  },
  analysis_context: {
    current_version: '1.0',
    priority_aspects: ['quality']
  }
};

const config = {
  domains: [domain],
  global_settings: {
    max_search_results: 5,
    analysis_temperature: 0.1,
    issue_labels: ['dotfiles-kaizen']
  }
};

describe('KaizenWorkflow', () => {
  it('runs flow with injected clients and dry-run', async () => {
    const tavily = {
      search: async () => ({
        summary: 'summary',
        sources: [
          { title: 'A', url: 'https://example.com', content: 'content', score: 0.9 },
          { title: 'Ignore', url: 'https://example.com/2', content: 'ignore me', score: 0.1 }
        ]
      })
    } as any;

    const anthropic = {
      analyze: async () => ({
        gapAnalysis: 'gap',
        recommendations: 'recs',
        implementationGuide: 'impl',
        fullResponse: 'full-text'
      } satisfies AnalysisOutput)
    } as any;

    const github = {
      findExistingIssue: async () => undefined,
      createIssue: async () => ({ html_url: 'https://github.com/issue/1' }),
      addComment: async () => ({})
    } as any;

    const workflow = new KaizenWorkflow({ tavily, anthropic, github });
    const result = await workflow.run({
      domain,
      config: config as any,
      context: { contentBase: '.', githubToken: 'token', issueRepoOverride: 'owner/repo' },
      dryRun: true
    });

    expect(result.research.sources).toHaveLength(1);
    expect(result.analysis.fullResponse).toBe('full-text');
    expect(result.issueUrl).toContain('DRY-RUN');
  });
});
