import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    score: float


@dataclass
class ResearchOutput:
    sources: list[SearchResult]
    summary: str
    search_query: str


@dataclass
class AnalysisOutput:
    gap_analysis: str
    recommendations: str
    implementation_guide: str
    full_response: str


# 設定定数
TAVILY_API_URL = "https://api.tavily.com/search"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
GITHUB_API_URL = "https://api.github.com"

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def load_config(config_path: str) -> dict:
    """レビュー設定ファイルを読み込む"""
    with open(config_path, encoding="utf-8") as f:
        return json.load(f)


def get_domain_config(config: dict, domain_id: str) -> dict | None:
    """特定のドメインの設定を取得する"""
    for domain in config.get("domains", []):
        if domain["id"] == domain_id:
            return domain
    return None


class TavilyClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("TAVILY_API_KEY")
        if not self.api_key:
            raise ValueError("TAVILY_API_KEY environment variable is not set")

    def search(
        self,
        query: str,
        max_results: int = 5,
        include_domains: list = None,
        exclude_domains: list = None,
    ) -> dict[str, Any]:
        """Tavily APIを使用して検索を実行する"""
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "advanced",
            "include_answer": True,
            "max_results": max_results,
            "include_domains": include_domains or [],
            "exclude_domains": exclude_domains or [],
        }

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.post(TAVILY_API_URL, json=payload, timeout=30)
                response.raise_for_status()
                return response.json()
            except requests.RequestException as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                print(f"Tavily API error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                time.sleep(RETRY_DELAY * (attempt + 1))

        raise Exception("Tavily API request failed after max retries")


class AnthropicClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    def generate_response(
        self, system_prompt: str, user_prompt: str, temperature: float = 0.3
    ) -> str:
        """Anthropic APIを使用してレスポンスを生成する"""
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        payload = {
            "model": "claude-sonnet-4-5",
            "max_tokens": 4000,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.post(
                    ANTHROPIC_API_URL, headers=headers, json=payload, timeout=60
                )
                response.raise_for_status()
                data = response.json()
                return data["content"][0]["text"]
            except requests.RequestException as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                print(f"Anthropic API error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                time.sleep(RETRY_DELAY * (attempt + 1))

        raise Exception("Anthropic API request failed after max retries")


class GitHubClient:
    def __init__(
        self,
        token: str | None = None,
        repository: str | None = None,
    ):
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.repository = repository or os.environ.get("GITHUB_REPOSITORY")

        if not self.token:
            raise ValueError("GITHUB_TOKEN environment variable is not set")
        if not self.repository:
            raise ValueError("GITHUB_REPOSITORY environment variable is not set")

    def create_issue(
        self,
        title: str,
        body: str,
        labels: list[str] | None = None,
        assignees: list[str] | None = None,
    ) -> dict[str, Any]:
        """GitHub Issueを作成する"""
        url = f"{GITHUB_API_URL}/repos/{self.repository}/issues"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

        payload = {
            "title": title,
            "body": body,
            "labels": labels or [],
            "assignees": assignees or [],
        }

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=30)
                response.raise_for_status()
                return response.json()
            except requests.RequestException as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                print(f"GitHub API error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                time.sleep(RETRY_DELAY * (attempt + 1))

        raise Exception("GitHub API request failed after max retries")

    def find_existing_issue(self, title_prefix: str) -> dict[str, Any] | None:
        """指定されたタイトルプレフィックスを持つ既存のオープンなIssueを検索する"""
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

        # 注: APIのIssueリストではタイトルで直接フィルタリングできません。
        # 取得してフィルタリングするか、検索APIを使用する必要があります。
        # 特定のタイトルを見つけるには検索APIの方が適しています。
        search_url = f"{GITHUB_API_URL}/search/issues"
        search_query = (
            f"repo:{self.repository} is:issue is:open in:title {title_prefix}"
        )

        try:
            response = requests.get(
                search_url, headers=headers, params={"q": search_query}, timeout=30
            )
            response.raise_for_status()
            data = response.json()
            if data["total_count"] > 0:
                return data["items"][0]
            return None
        except requests.RequestException as e:
            print(f"GitHub API search error: {e}")
            return None

    def add_comment(self, issue_number: int, body: str) -> dict[str, Any]:
        """既存のIssueにコメントを追加する"""
        url = f"{GITHUB_API_URL}/repos/{self.repository}/issues/{issue_number}/comments"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

        payload = {"body": body}

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise Exception(f"Failed to add comment: {e}")


class DotfilesKaizen:
    def __init__(
        self,
        config: dict[str, Any],
        content_base: str | Path = ".",
        issue_repository: str | None = None,
        github_token: str | None = None,
    ):
        self.config = config
        self.content_base = Path(content_base)
        self.tavily_client = TavilyClient()
        self.anthropic_client = AnthropicClient()
        self.github_client = GitHubClient(
            token=github_token, repository=issue_repository
        )

    def read_target_files(
        self, target_patterns: list[str], base_path: Path | str = "."
    ) -> str:
        """globパターンに一致するターゲットファイルからコンテンツを読み込む"""
        base = Path(base_path)
        content_parts = []

        for pattern in target_patterns:
            matching_files = list(base.glob(pattern))

            for file_path in matching_files:
                try:
                    content = file_path.read_text(encoding="utf-8")
                    relative_path = file_path.relative_to(base)
                    content_parts.append(f"### File: {relative_path}\n\n{content}")
                except OSError as e:
                    print(f"Warning: Could not read {file_path}: {e}", file=sys.stderr)

        return (
            "\n\n---\n\n".join(content_parts)
            if content_parts
            else "No matching files found."
        )

    def collect_trends(self, domain: dict[str, Any]) -> ResearchOutput:
        """フェーズ1: Tavily APIを使用したトレンド収集"""
        print(f"Starting Phase 1: Trend Collection for {domain['name']}...")

        search_hints = domain["search_hints"]
        current_year = datetime.now().year

        # 検索クエリの構築
        keywords = " ".join(search_hints["primary_keywords"])
        focus = " ".join(search_hints["focus_areas"])
        query = f"{keywords} {focus} {current_year}"

        print(f"Search Query: {query}")

        global_settings = self.config.get("global_settings", {})
        max_results = global_settings.get("max_search_results", 10)

        # 検索の実行
        results = self.tavily_client.search(
            query=query,
            max_results=max_results,
            exclude_domains=search_hints.get("exclude_domains", []),
        )

        # 結果の処理
        sources = []
        for result in results.get("results", []):
            # 除外用語に基づく単純なフィルタリング
            title_lower = result["title"].lower()
            content_lower = result["content"].lower()
            exclude_terms = [t.lower() for t in search_hints.get("exclude_terms", [])]

            if any(
                term in title_lower or term in content_lower for term in exclude_terms
            ):
                continue

            sources.append(
                SearchResult(
                    title=result["title"],
                    url=result["url"],
                    content=result["content"],
                    score=result["score"],
                )
            )

        return ResearchOutput(
            sources=sources,
            summary=results.get("answer", "No summary available."),
            search_query=query,
        )

    def analyze_content(
        self,
        domain: dict[str, Any],
        research_output: ResearchOutput,
        current_content: str,
    ) -> AnalysisOutput:
        """フェーズ2: Anthropic APIを使用した分析"""
        print(f"Starting Phase 2: Analysis for {domain['name']}...")

        analysis_context = domain["analysis_context"]
        priority_aspects = ", ".join(analysis_context["priority_aspects"])

        system_prompt = """
あなたはClaude Code Skillsドキュメントの改善を専門とする改善アドバイザーです。
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

## 参考資料
(使用したソースのリスト)
"""

        user_prompt = f"""
以下のClaude Code Skillを分析してください: {domain["name"]}

## コンテキスト
- 説明: {domain["description"]}
- 現在のバージョン/状態: {analysis_context.get("current_version", "不明")}
- 優先事項: {priority_aspects}

## 最新の調査結果サマリー (2025年)
{research_output.summary}

## 主要なソース
{self._format_sources(research_output.sources)}

## 現在のSkillドキュメント
{current_content}

最新のトレンドとベストプラクティスに基づいて、現在のSkillドキュメントを分析し、改善のための推奨事項を提供してください。
必ず日本語で出力してください。
"""

        global_settings = self.config.get("global_settings", {})
        temperature = global_settings.get("analysis_temperature", 0.3)

        full_response = self.anthropic_client.generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
        )

        # レスポンスの解析 (簡易版)
        # 実際の実装では、マークダウンをより堅牢に解析する必要があるかもしれません
        return AnalysisOutput(
            gap_analysis=self._extract_section(full_response, "Gap Analysis"),
            recommendations=self._extract_section(full_response, "Recommendations"),
            implementation_guide=self._extract_section(
                full_response, "Implementation Guide"
            ),
            full_response=full_response,
        )

    def report_findings(
        self,
        domain: dict[str, Any],
        research_output: ResearchOutput,
        analysis_output: AnalysisOutput,
    ):
        """フェーズ3: GitHub Issueによるレポーティング"""
        print(f"Starting Phase 3: Reporting for {domain['name']}...")

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        title = f"[Dotfiles Kaizen] {domain['name']} - {today}"

        body = f"""
## 🔍 Analysis Overview
- **Domain**: {domain["name"]}
- **Date**: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}
- **Search Query**: `{research_output.search_query}`

## 📊 Research Summary
{research_output.summary}

## 💡 Analysis & Recommendations
{analysis_output.full_response}

## 📚 Top Sources
{self._format_sources_list(research_output.sources)}

---
*This issue was automatically generated by the Dotfiles Kaizen Workflow.*
"""

        # 既存のIssueを確認
        existing_issue = self.github_client.find_existing_issue(
            f"[Dotfiles Kaizen] {domain['name']}"
        )

        if existing_issue:
            print(
                f"Found existing issue #{existing_issue['number']}. Adding comment instead."
            )
            comment_body = f"""
### Update: {today}

**Research Summary**:
{research_output.summary}

**New Recommendations**:
{analysis_output.full_response}
"""
            self.github_client.add_comment(existing_issue["number"], comment_body)
            print(f"Comment added to issue #{existing_issue['number']}")
        else:
            global_settings = self.config.get("global_settings", {})
            labels = list(global_settings.get("issue_labels", ["dotfiles-kaizen"]))
            labels.append(domain["id"])

            issue = self.github_client.create_issue(
                title=title, body=body, labels=labels
            )
            print(f"Created new issue #{issue['number']}: {issue['html_url']}")

    def _format_sources(self, sources: list[SearchResult]) -> str:
        """プロンプト用にソースをフォーマットする"""
        formatted_items = []
        for s in sources[:5]:
            content = s.content[:200]
            if len(s.content) > 200:
                content += "..."
            formatted_items.append(f"- {s.title}: {content}")

        return "\n".join(formatted_items)

    def _format_sources_list(self, sources: list[SearchResult]) -> str:
        """Issue本文用にソースをフォーマットする"""
        return "\n".join([f"- [{s.title}]({s.url})" for s in sources[:5]])

    def _extract_section(self, text: str, section_name: str) -> str:
        """マークダウンテキストからセクションを抽出する"""
        try:
            header = f"## {section_name}"
            start = text.index(header)
            # 開始位置をヘッダーの後に移動
            content_start = start + len(header)

            # 次のセクションを検索
            next_section_start = text.find("\n## ", content_start)

            if next_section_start == -1:
                return text[content_start:].strip()
            return text[content_start:next_section_start].strip()
        except ValueError:
            return ""

    def run_domain_analysis(self, domain_id: str, dry_run: bool = False):
        """特定のドメインに対して完全な分析パイプラインを実行する"""
        domain = get_domain_config(self.config, domain_id)
        if not domain:
            raise ValueError(f"Domain not found: {domain_id}")

        # フェーズ1
        research_output = self.collect_trends(domain)

        # ファイルの読み込み
        current_content = self.read_target_files(
            domain["target_files"], base_path=self.content_base
        )

        # フェーズ2
        analysis_output = self.analyze_content(domain, research_output, current_content)

        # フェーズ3
        self.report_findings(domain, research_output, analysis_output)


def main():
    parser = argparse.ArgumentParser(description="Dotfiles Kaizen Workflow")
    parser.add_argument(
        "--domain-id", required=True, help="ID of the domain to analyze"
    )
    parser.add_argument("--config", required=True, help="Path to configuration file")
    parser.add_argument(
        "--content-base",
        default=".",
        help="Base directory for reading target files (useful when the target repo is checked out to a subdirectory)",
    )
    parser.add_argument(
        "--issue-repo",
        default=None,
        help="Repository (owner/name) where issues should be created. Defaults to GITHUB_REPOSITORY env.",
    )
    parser.add_argument(
        "--github-token",
        default=None,
        help="GitHub token to use for issue creation. Defaults to GITHUB_TOKEN env.",
    )

    args = parser.parse_args()

    try:
        config = load_config(args.config)
        kaizen_engine = DotfilesKaizen(
            config=config,
            content_base=args.content_base,
            issue_repository=args.issue_repo,
            github_token=args.github_token,
        )
        kaizen_engine.run_domain_analysis(args.domain_id)
        print("Analysis completed successfully.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()