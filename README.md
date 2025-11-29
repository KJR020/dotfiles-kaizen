# Dotfiles Kaizen

dotfiles リポジトリの Claude Code スキルを定期的に分析し、最新のベストプラクティスに基づいた改善提案を自動生成するワークフローです。

## 概要

- **Tavily API** でトレンド情報を収集
- **Anthropic API (Claude)** でギャップ分析と改善提案を生成
- **GitHub Issues** に結果をレポート

## セットアップ

### 1. GitHub Secrets の設定

以下のシークレットを設定してください:

| シークレット | 説明 |
|-------------|------|
| `TAVILY_API_KEY` | Tavily API キー |
| `ANTHROPIC_API_KEY` | Anthropic API キー |
| `DOTFILES_TOKEN` | dotfiles リポジトリへの Issue 作成権限を持つ PAT |

### 2. リポジトリ変数の設定

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `DOTFILES_REPO` | 分析対象のリポジトリ | `KJR020/dotfiles` |

### 3. Personal Access Token (PAT) の作成

1. GitHub Settings > Developer settings > Personal access tokens
2. 「Generate new token (classic)」をクリック
3. スコープ: `repo` または `public_repo` + `issues`
4. 作成したトークンを `DOTFILES_TOKEN` として登録

## ファイル構成

```
.
├── .github/workflows/
│   └── dotfiles-kaizen.yml    # メインワークフロー
├── src/dotfiles_kaizen/
│   ├── __init__.py
│   ├── main.py                # メインスクリプト
│   ├── config.json            # ドメイン設定
│   └── generate_matrix.sh     # ドメイン選択
├── tests/
│   ├── __init__.py
│   └── test_main.py           # テスト
├── pyproject.toml             # プロジェクト設定
└── README.md
```

## ローカル開発

### 依存関係のインストール

```bash
# uv をインストール（未インストールの場合）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 依存関係をインストール
uv sync

# 開発用依存関係を含める
uv sync --extra dev
```

### テスト実行

```bash
uv run pytest
```

### ローカル実行

```bash
# .env ファイルを作成
cat > .env << EOF
TAVILY_API_KEY=your_tavily_key
ANTHROPIC_API_KEY=your_anthropic_key
GITHUB_TOKEN=your_github_token
GITHUB_REPOSITORY=KJR020/dotfiles
EOF

# 環境変数を読み込んで実行
source .env && uv run dotfiles-kaizen \
  --domain-id typescript-best-practices \
  --config src/dotfiles_kaizen/config.json
```

## ワークフロー

- **毎日 09:00 JST** に自動実行
- `workflow_dispatch` で手動実行も可能
  - `daily`: 当日のドメインのみ
  - `all`: 全ドメインを分析

## ドメイン設定

`src/dotfiles_kaizen/config.json` でレビュー対象を設定:

| ドメイン ID | 曜日 | 対象 |
|------------|------|------|
| `typescript-best-practices` | 月 | TypeScript ベストプラクティス |
| `skill-creator` | 水 | Claude スキル作成 |
| `claude-commands` | 木 | Claude カスタムコマンド |
| `claude-settings` | 金 | Claude 設定 |