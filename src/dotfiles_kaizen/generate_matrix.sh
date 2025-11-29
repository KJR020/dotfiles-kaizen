#!/bin/bash
set -euo pipefail

MODE="${MODE:-daily}"
CONFIG="${1:-src/dotfiles_kaizen/config.json}"

if [ ! -f "$CONFIG" ]; then
    echo "Error: Configuration file not found: $CONFIG" >&2
    exit 1
fi

if [ "$MODE" = "all" ]; then
    # すべてのドメインを返す
    jq -c '[.domains[] | {domain_id: .id, domain_name: .name}]' "$CONFIG"
else
    # 今日の曜日でフィルタリング (ISO: 1=月曜日, 7=日曜日)
    # TEST_DAY_OF_WEEK 環境変数でテスト用に上書き可能
    TODAY="${TEST_DAY_OF_WEEK:-$(date -u +%u)}"
    jq -c --argjson today "$TODAY" \
        '[.domains[] | select(.day_of_week == $today) | {domain_id: .id, domain_name: .name}]' \
        "$CONFIG"
fi