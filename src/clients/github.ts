import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger.js';

export interface GitHubClientOptions {
  token?: string;
  repository?: string;
}

export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly repository: string;

  constructor(options: GitHubClientOptions = {}) {
    const token = options.token ?? process.env.GITHUB_TOKEN;
    const repository = options.repository ?? process.env.GITHUB_REPOSITORY;

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is not set');
    }
    if (!repository) {
      throw new Error('GITHUB_REPOSITORY environment variable is not set');
    }

    this.octokit = new Octokit({ auth: token });
    this.repository = repository;
  }

  async findExistingIssue(titlePrefix: string) {
    const query = `repo:${this.repository} is:issue is:open in:title "${titlePrefix}"`;
    const response = await this.octokit.search.issuesAndPullRequests({ q: query, per_page: 1 });
    const item = response.data.items.at(0);
    if (item) {
      logger.info('Found existing issue', { number: item.number });
    }
    return item;
  }

  async createIssue(payload: { title: string; body: string; labels?: string[] }) {
    const [owner, repo] = this.repository.split('/');
    const response = await this.octokit.issues.create({ owner, repo, ...payload });
    logger.info('Created GitHub issue', { number: response.data.number });
    return response.data;
  }

  async addComment(issueNumber: number, body: string) {
    const [owner, repo] = this.repository.split('/');
    const response = await this.octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
    logger.info('Added GitHub comment', { number: issueNumber });
    return response.data;
  }
}
