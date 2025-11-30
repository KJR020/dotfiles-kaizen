# Dotfiles Kaizen TypeScript / mastra 移行要件

## 背景
- 既存は Python + requests で Tavily → Anthropic → GitHub Issue を直列実行し、GitHub Actions (毎日 09:00 JST) で回す。
- ドメイン定義 (`src/dotfiles_kaizen/config.json`) と `generate_matrix.sh` で実行対象を選定し、CLI (`dotfiles-kaizen --domain-id ...`) を叩いている。
- TypeScript + mastra に乗せ替え、型安全とエージェント設計の学習を狙う。

## ゴール
- 現行機能のパリティを保ちつつ、TypeScript + mastra で再実装。
- CLI と GitHub Actions の I/F は可能な限り互換 (`--domain-id`, `--config`, `--content-base`, `--issue-repo`, `--github-token` / env)。
- LLM I/O を型定義し、プロンプト/レスポンスを mastra のフローで管理する。
- 実行ログと失敗時の情報が追いやすい形で整備。

## 非ゴール
- 分析内容の大幅なロジック変更や新規ドメイン設計。
- GitHub Issue テンプレートの再設計。
- インフラ周り（Actions スケジュールや Secrets 名）の変更。

## 技術スタックの前提
- Node 20+、TypeScript、pnpm (なければ npm 可)。
- mastra（LLM オーケストレーション）を中心に、Anthropic SDK、Octokit、Tavily 検索用 HTTP クライアント。
- テストは Vitest 。リンターは ESLint、フォーマッタは Prettier。

## 必須要件
### 構成
- `src/` に TypeScript 実装を配置。エントリーポイント例: `src/main.ts`.
- ドメイン設定は JSON 互換で維持 (`config/domains.json` 等、互換パスを README に明記)。現行の `src/dotfiles_kaizen/config.json` を読み込めること。
- `generate_matrix.sh` 相当を TypeScript で提供（`pnpm matrix --mode daily` など）。`MODE`/`TEST_DAY_OF_WEEK` 環境変数を解釈。

### 環境変数 / 引数 (互換を維持)
- 必須: `TAVILY_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`。
- オプション: `--issue-repo` で上書き、`--github-token` で PAT 指定、`--content-base` でターゲットリポジトリのパスを指定。

### 処理フロー (3 フェーズ)
1) **Trend Collection**: Tavily 検索 (max_results, exclude_terms) → 上位結果 5 件までを保持。リトライ/タイムアウト有り。
2) **Analysis**: mastra でエージェント/ワークフロー化し、Anthropic Claude へのプロンプト生成・レスポンス取得。ギャップ分析テンプレートを維持 (日本語出力)。
3) **Reporting**: GitHub Issue を作成/既存検索してコメント追加。タイトル: `[Dotfiles Kaizen] {domain.name} - YYYY-MM-DD`。ラベルは `dotfiles-kaizen` + ドメイン ID。

### ファイル読み込み
- `target_files` の glob で対象 Markdown を読み、`### File: relative/path` 見出しで結合する現行仕様を踏襲。

### ログ/エラー
- リトライ回数・HTTP ステータス・レスポンス要約をロギング。
- 失敗時は非ゼロ終了、GitHub Actions が artifact 取得できるよう標準エラーに主要情報を残す。

### GitHub Actions 更新
- `actions/setup-node` + `pnpm install` 版に置換。
- Matrix 生成を新しいスクリプトで実行。
- CLI 実行コマンドを TypeScript 版に差し替え (`pnpm start -- --domain-id ...` など)。

## mastra 設計の方向性 (提案)
- **Actors/Flows**
  - `ResearchAgent`: Tavily API 呼び出しツール。検索クエリ生成を関数化し、結果を `zod` で型付け。
  - `AnalysisAgent`: Anthropic Claude 呼び出しツール。プロンプトは現行テンプレートをベースにし、レスポンス構造をパースするユーティリティを用意。
  - `ReportingAgent`: GitHub Issue 作成/コメント追加を行うツール (Octokit)。
  - `KaizenWorkflow`: 上記を直列で実行し、フェーズごとにログを残す orchestrator。
- **型**
  - `SearchResult`, `ResearchOutput`, `AnalysisOutput` を TypeScript の interface で定義。
  - ドメイン設定 (`DomainConfig`) を型定義し、読み込み時に `zod` でバリデーション。
- **テスト**
  - ユニット: 各ツールの入出力フォーマット、ファイル読み込み、Issue ボディ生成。
  - 統合: `KaizenWorkflow` の happy path (API はモック)。

## 成果物
- `requirements.md` (本書)
- TypeScript 実装一式 + ビルド/実行スクリプト (`pnpm start`, `pnpm test`, `pnpm lint` など)。
- 更新済み README (セットアップ・ローカル実行・Actions 実行例)。
- 更新済み GitHub Actions ワークフローと matrix スクリプト。

## 完了条件 (DoD)
- ローカルで `pnpm install && pnpm test` が通る。
- `pnpm start -- --domain-id typescript-best-practices --config src/dotfiles_kaizen/config.json --content-base ../dotfiles` が動作し、GitHub API がモックされている場合は Issue ボディを標準出力/ログに出せる。
- Actions ワークフローが Node 版で構文エラーなく実行できる状態。
- 主要な I/O (設定、Tavily、Anthropic、GitHub) がドキュメント化され、Secrets/Vars 名が明記されている。
