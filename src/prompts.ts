import type { AnalysisOutput, DomainDefinition, ResearchOutput } from './types.js';

export const SYSTEM_PROMPT = `あなたはClaude Code Skillsドキュメントの改善を専門とする改善アドバイザーです。
最新の調査結果とベストプラクティスに基づいて、現在のSkillドキュメントを分析し、実行可能な推奨事項を提供してください。

改善に焦点を当てる領域:
- Skillドキュメントの品質と明確性
- サンプルコードの関連性と正確性
- ベストプラクティスガイダンス
- ユーザーエクスペリエンスと使いやすさ

以下のMarkdown形式で日本語で出力してください:

## ギャップ分析
(現在のSkillドキュメントと最新のベストプラクティス/トレンドとのギャップを分析)

## 推奨事項
### 高優先度
- [ ] (Skillドキュメントの改善アクションアイテム)

### 中優先度
- [ ] (Skillドキュメントの改善アクションアイテム)

### 低優先度
- [ ] (Skillドキュメントの改善アクションアイテム)

## 実装ガイド
(手順、サンプルコード、リスク考慮など)

## 参考資料
(使用したソースのリスト)`;

export function buildUserPrompt(domain: DomainDefinition, researchOutput: ResearchOutput, currentContent: string): string {
  const priority = domain.analysis_context.priority_aspects?.join(', ') ?? '未指定';
  return `以下のClaude Code Skillを分析してください: ${domain.name}

## コンテキスト
- 説明: ${domain.description}
- 現在のバージョン/状態: ${domain.analysis_context.current_version ?? '不明'}
- 優先事項: ${priority}

## 最新の調査結果サマリー (${new Date().getFullYear()})
${researchOutput.summary}

## 主要なソース
${formatSources(researchOutput.sources)}

## 現在のSkillドキュメント
${currentContent}

最新のトレンドとベストプラクティスに基づいて、現在のSkillドキュメントを分析し、改善のための推奨事項を提供してください。
必ず日本語で出力してください。`;
}

export function parseAnalysis(fullResponse: string): AnalysisOutput {
  return {
    gapAnalysis: extractSection(fullResponse, ['ギャップ分析', 'Gap Analysis']),
    recommendations: extractSection(fullResponse, ['推奨事項', 'Recommendations']),
    implementationGuide: extractSection(fullResponse, ['実装ガイド', 'Implementation Guide']),
    fullResponse
  };
}

function formatSources(sources: ResearchOutput['sources']): string {
  return sources
    .slice(0, 5)
    .map((source) => {
      const content = source.content.length > 200 ? `${source.content.slice(0, 200)}...` : source.content;
      return `- ${source.title}: ${content}`;
    })
    .join('\n');
}

function extractSection(text: string, headings: string[]): string {
  for (const heading of headings) {
    const pattern = new RegExp(`##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
