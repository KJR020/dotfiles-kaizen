import { z } from 'zod';
import { Flow } from '@mastra/core';
import { AnthropicClientWrapper } from '../clients/anthropic.js';
import { GitHubClient } from '../clients/github.js';
import { TavilyClient } from '../clients/tavily.js';
import { domainConfigSchema, domainSchema } from '../config.js';
import type { AnalysisOutput, DomainDefinition, DomainConfig, ResearchOutput, WorkflowContext } from '../types.js';
import { logger } from '../utils/logger.js';
import { readTargetFiles } from '../utils/file-reader.js';

export interface KaizenRunInput {
  domain: DomainDefinition;
  config: DomainConfig;
  context: WorkflowContext;
  dryRun?: boolean;
}

export class KaizenWorkflow {
  private readonly flow: Flow<KaizenRunInput, WorkflowContext, { research: ResearchOutput; analysis: AnalysisOutput; issueUrl?: string }>; // eslint-disable-line max-len

  constructor(private readonly clients?: {
    tavily?: TavilyClient;
    anthropic?: AnthropicClientWrapper;
    github?: GitHubClient;
  }) {
    this.flow = this.createFlow();
  }

  async run(input: KaizenRunInput) {
    const { output } = await this.flow.run(input, input.context);
    return output;
  }

  private createFlow() {
    return new Flow<KaizenRunInput, WorkflowContext, { research: ResearchOutput; analysis: AnalysisOutput; issueUrl?: string }>({
      id: 'dotfiles-kaizen',
      inputSchema: z.object({
        domain: domainSchema,
        config: domainConfigSchema,
        context: z.object({
          contentBase: z.string(),
          githubToken: z.string().optional(),
          issueRepoOverride: z.string().optional()
        }),
        dryRun: z.boolean().optional()
      }),
      steps: {
        research: {
          run: async ({ input }) => {
            const tavily = this.clients?.tavily ?? new TavilyClient();
            const maxResults = input.config.global_settings.max_search_results;
            logger.info('Starting trend collection', { domain: input.domain.name });
            const query = buildSearchQuery(input.domain);
            const { summary, sources } = await tavily.search(query, {
              maxResults,
              excludeDomains: input.domain.search_hints.exclude_domains,
              includeDomains: input.domain.search_hints.include_domains
            });
            const filtered = filterSourcesByExclusions(sources, input.domain.search_hints.exclude_terms);
            return {
              summary,
              sources: filtered,
              searchQuery: query
            } satisfies ResearchOutput;
          }
        },
        collectContent: {
          dependsOn: ['research'],
          run: async ({ input }) => {
            logger.info('Reading target files', { base: input.context.contentBase });
            return readTargetFiles(input.domain.target_files, input.context.contentBase);
          }
        },
        analyze: {
          dependsOn: ['research', 'collectContent'],
          run: async ({ input, stepResults }) => {
            const researchOutput = stepResults.research as ResearchOutput;
            const currentContent = stepResults.collectContent as string;
            const anthropic = this.clients?.anthropic ??
              new AnthropicClientWrapper({ temperature: input.config.global_settings.analysis_temperature });
            logger.info('Starting analysis', { domain: input.domain.name });
            return anthropic.analyze(input.domain, researchOutput, currentContent);
          }
        },
        report: {
          dependsOn: ['research', 'analyze'],
          run: async ({ input, stepResults }) => {
            const github =
              this.clients?.github ??
              new GitHubClient({ token: input.context.githubToken, repository: input.context.issueRepoOverride });

            const researchOutput = stepResults.research as ResearchOutput;
            const analysisOutput = stepResults.analyze as AnalysisOutput;

            const { title, body, labels } = buildIssuePayload(input.domain, input.config, researchOutput, analysisOutput);
            logger.info('Preparing issue payload', { title });

            if (input.dryRun) {
              logger.info('Dry run enabled; skipping GitHub call');
              return `DRY-RUN: ${title}`;
            }

            const existing = await github.findExistingIssue(`[Dotfiles Kaizen] ${input.domain.name}`);
            if (existing) {
              const commentBody = buildCommentBody(researchOutput, analysisOutput);
              await github.addComment(existing.number, commentBody);
              return existing.html_url;
            }

            const issue = await github.createIssue({ title, body, labels });
            return issue.html_url;
          }
        }
      },
      buildOutput: (steps) => ({
        research: steps.research as ResearchOutput,
        analysis: steps.analyze as AnalysisOutput,
        issueUrl: steps.report as string | undefined
      })
    });
  }
}

function buildSearchQuery(domain: DomainDefinition) {
  const keywords = domain.search_hints.primary_keywords.join(' ');
  const focus = domain.search_hints.focus_areas.join(' ');
  return `${keywords} ${focus} ${new Date().getFullYear()}`.trim();
}

function filterSourcesByExclusions(sources: ResearchOutput['sources'], excludeTerms: string[] = []): ResearchOutput['sources'] {
  if (!excludeTerms.length) return sources;
  const lower = excludeTerms.map((term) => term.toLowerCase());
  return sources.filter((source) => {
    const title = source.title.toLowerCase();
    const content = source.content.toLowerCase();
    return !lower.some((term) => title.includes(term) || content.includes(term));
  });
}

function buildIssuePayload(domain: DomainDefinition, config: DomainConfig, research: ResearchOutput, analysis: AnalysisOutput) {
  const today = new Date().toISOString().slice(0, 10);
  const title = `[Dotfiles Kaizen] ${domain.name} - ${today}`;
  const labels = [
    ...(config.global_settings.issue_labels ?? ['dotfiles-kaizen']),
    domain.id
  ];
  const body = `## 🔍 Analysis Overview
- **Domain**: ${domain.name}
- **Date**: ${new Date().toISOString()}
- **Search Query**: \`${research.searchQuery}\`

## 📊 Research Summary
${research.summary}

## 💡 Analysis & Recommendations
${analysis.fullResponse}

## 📚 Top Sources
${formatSourcesList(research.sources)}

---
*This issue was automatically generated by the Dotfiles Kaizen Workflow.*`;
  return { title, body, labels };
}

function buildCommentBody(research: ResearchOutput, analysis: AnalysisOutput) {
  const today = new Date().toISOString().slice(0, 10);
  return `### Update: ${today}

**Research Summary:**
${research.summary}

**New Recommendations:**
${analysis.fullResponse}`;
}

function formatSourcesList(sources: ResearchOutput['sources']) {
  return sources
    .slice(0, 5)
    .map((source) => `- [${source.title}](${source.url})`)
    .join('\n');
}
