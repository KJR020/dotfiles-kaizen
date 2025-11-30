import { setTimeout as sleep } from 'node:timers/promises';
import { setTimeout as createTimeout } from 'node:timers';
import { logger } from '../utils/logger.js';
import type { SearchResult } from '../types.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface TavilyClientOptions {
  apiKey?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface TavilyResponse {
  answer?: string;
  results?: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

export class TavilyClient {
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(options: TavilyClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.TAVILY_API_KEY ?? '';
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!this.apiKey) {
      throw new Error('TAVILY_API_KEY environment variable is not set');
    }
  }

  async search(query: string, opts?: { maxResults?: number; excludeDomains?: string[]; includeDomains?: string[] }): Promise<{
    summary: string;
    sources: SearchResult[];
  }> {
    const payload = {
      api_key: this.apiKey,
      query,
      search_depth: 'advanced',
      include_answer: true,
      max_results: opts?.maxResults ?? 5,
      include_domains: opts?.includeDomains ?? [],
      exclude_domains: opts?.excludeDomains ?? []
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = createTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(TAVILY_API_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Tavily responded with ${response.status}: ${text}`);
        }

        const data = (await response.json()) as TavilyResponse;
        const sources: SearchResult[] =
          data.results?.map((result) => ({
            title: result.title,
            url: result.url,
            content: result.content,
            score: result.score
          })) ?? [];

        logger.info('Tavily search completed', { attempt, results: sources.length });
        return {
          summary: data.answer ?? 'No summary available.',
          sources
        };
      } catch (error) {
        lastError = error;
        logger.warn('Tavily search failed', {
          attempt,
          error: (error as Error).message
        });
        if (attempt === this.maxRetries) break;
        await sleep(500 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Tavily search failed');
  }
}
