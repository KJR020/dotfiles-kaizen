# Dotfiles Kaizen

TypeScript + mastra で Tavily / Anthropic / GitHub Issue をオーケストレーションし、dotfiles リポジトリの改善アイデアを自動生成するツールです。現行の CLI / GitHub Actions インターフェースを維持しつつ、型安全なフローとテストしやすい構成へ移行しました。

## 主な機能
- Tavily API で最新トレンドを収集 (リトライ/タイムアウト付き)
- Anthropic Claude でギャップ分析・改善提案を日本語生成
- 既存 Issue を検索し、なければ作成、あればコメント追加
- `target_files` の glob で対象 Markdown を結合し、LLM へ渡す

## セットアップ
### 必須ツール
- Node.js 20+
- pnpm (推奨、npm でも可)

### 依存関係のインストール
```bash
pnpm install
```

### 環境変数 / シークレット
| 名前 | 必須 | 用途 |
| --- | --- | --- |
| `TAVILY_API_KEY` | ✅ | Tavily API 認証 |
| `ANTHROPIC_API_KEY` | ✅ | Claude 呼び出し用 API キー |
| `GITHUB_TOKEN` | ✅ | Issue 作成/コメント用 PAT |
| `GITHUB_REPOSITORY` | ✅ | Issue を作成するリポジトリ (`owner/name`) |

CLI オプションで上書き可能な項目:
- `--issue-repo`: Issue を作成するリポジトリ (未指定なら `GITHUB_REPOSITORY`)
- `--github-token`: GitHub PAT (未指定なら `GITHUB_TOKEN`)
- `--content-base`: 対象リポジトリのパス (default: `.`)
- `--config`: ドメイン設定ファイル (default: `config/domains.json`)
- `--dry-run`: GitHub への書き込みを抑止し、内容のみ出力

## ドメイン設定
- 既定パス: `config/domains.json`
- 旧パス互換: `src/dotfiles_kaizen/config.json` (シンボリックリンク)

スキーマは `requirements.md` の通りで、`day_of_week` に ISO 曜日 (1=月曜) を指定します。

## 使い方
### ローカル実行
```bash
pnpm start -- --domain-id typescript-best-practices \
  --config config/domains.json \
  --content-base ../dotfiles \
  --issue-repo your/repo \
  --github-token $DOTFILES_TOKEN \
  --dry-run
```

### マトリクス生成 (`generate_matrix.sh` 代替)
```bash
# MODE 環境変数または --mode で daily/all を指定 (デフォルト: daily)
# TEST_DAY_OF_WEEK で ISO 曜日を上書き可能 (テスト用)
pnpm matrix -- --config config/domains.json --mode daily
```

### テスト / Lint
```bash
pnpm test
pnpm lint
pnpm format
```

## GitHub Actions
`.github/workflows/dotfiles-kaizen.yml` を Node 版に更新しました。
- `actions/setup-node` + `pnpm install` で依存関係を準備
- `pnpm matrix -- --config config/domains.json` で対象ドメインを決定
- `pnpm start -- --domain-id ... --content-base dotfiles ...` で CLI を実行

## 実装メモ
- mastra 互換の軽量 Flow シム（`@mastra/core`）をローカル提供し、フェーズを型安全にオーケストレーション
- Tavily/Anthropic/Octokit クライアントはそれぞれ `src/clients/` に分離
- LLM プロンプトは `src/prompts.ts` に集約し、セクション抽出も型で管理
- `requirements.md` に移行要件・DoD を明文化
