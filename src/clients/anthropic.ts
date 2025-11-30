import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserPrompt, parseAnalysis } from '../prompts.js';
import type { AnalysisOutput, DomainDefinition, ResearchOutput } from '../types.js';
import { logger } from '../utils/logger.js';

export interface AnthropicClientOptions {
  apiKey?: string;
  temperature?: number;
}

export class AnthropicClientWrapper {
  private readonly client: Anthropic;
  private readonly temperature: number;

  constructor(options: AnthropicClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    this.client = new Anthropic({ apiKey });
    this.temperature = options.temperature ?? 0.3;
  }

  async analyze(domain: DomainDefinition, researchOutput: ResearchOutput, currentContent: string): Promise<AnalysisOutput> {
    const userPrompt = buildUserPrompt(domain, researchOutput, currentContent);
    logger.info('Sending prompt to Anthropic', { temperature: this.temperature });

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-latest',
      system: SYSTEM_PROMPT,
      max_tokens: 4000,
      temperature: this.temperature,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const contentBlock = response.content[0];
    const text = contentBlock?.type === 'text' ? contentBlock.text : '';
    logger.debug('Received response from Anthropic', { tokens: response.usage?.output_tokens });
    return parseAnalysis(text);
  }
}
