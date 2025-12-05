import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { findDomainById, loadConfig } from './config.js';
import { KaizenWorkflow } from './workflow/kaizen-workflow.js';
import { logger } from './utils/logger.js';

loadEnv();

async function main() {
  const args = parseArgs({
    options: {
      'domain-id': { type: 'string', short: 'd' },
      config: { type: 'string', short: 'c', default: 'config/domains.json' },
      'content-base': { type: 'string', default: '.' },
      'issue-repo': { type: 'string' },
      'github-token': { type: 'string' },
      'dry-run': { type: 'boolean', default: false }
    },
    strict: true
  }).values;

  if (!args['domain-id']) {
    throw new Error('Missing required flag: --domain-id');
  }

  const configPath = args.config ?? 'config/domains.json';
  const config = loadConfig(configPath);
  const domain = findDomainById(config, args['domain-id']);

  if (!domain) {
    throw new Error(`Domain not found: ${args['domain-id']}`);
  }

  if (!process.env.GITHUB_REPOSITORY && args['issue-repo']) {
    process.env.GITHUB_REPOSITORY = args['issue-repo'];
  }

  const workflow = new KaizenWorkflow();
  const result = await workflow.run({
    domain,
    config,
    context: {
      contentBase: args['content-base'],
      githubToken: args['github-token'],
      issueRepoOverride: args['issue-repo']
    },
    dryRun: args['dry-run'] ?? false
  });

  logger.info('Analysis completed', { issueUrl: result.issueUrl });
  // eslint-disable-next-line no-console
  console.log(result.analysis.fullResponse);
}

main().catch((error) => {
  const err = error as Error & { cause?: Error };
  logger.error('Failed to run dotfiles-kaizen', {
    error: err.message,
    cause: err.cause?.message,
    stack: err.cause?.stack ?? err.stack
  });
  process.exitCode = 1;
});
