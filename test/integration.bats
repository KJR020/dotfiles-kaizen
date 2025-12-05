#!/usr/bin/env bats

setup() {
  export MODE=daily
  export TEST_DAY_OF_WEEK=5
  export GITHUB_REPOSITORY="KJR020/dotfiles"
}

@test "matrix command outputs valid JSON" {
  output=$(pnpm --silent matrix --config config/domains.json --mode daily 2>/dev/null)

  # JSONとしてパース可能か確認
  echo "$output" | jq -e . >/dev/null

  # 配列の長さを取得
  length=$(echo "$output" | jq -r 'length')
  [ "$length" -gt 0 ]
}

@test "matrix command respects mode=all" {
  output=$(pnpm --silent matrix --config config/domains.json --mode all 2>/dev/null)

  # すべてのドメインが返される
  length=$(echo "$output" | jq -r 'length')
  [ "$length" -ge 1 ]
}

@test "start command accepts arguments correctly" {
  # dry-runで実行して引数パースのみ確認
  run pnpm start --domain-id claude-settings --config config/domains.json --content-base . --dry-run

  # 引数パースエラーがないことを確認（実行時エラーは許容）
  [[ ! "$output" =~ "Unexpected argument" ]]
  [[ ! "$output" =~ "positional arguments" ]]
}

@test "workflow simulation: daily mode" {
  # Step 1: Select domains
  matrix=$(pnpm --silent matrix --config config/domains.json --mode daily 2>/dev/null)
  domain_count=$(echo "$matrix" | jq -r 'length')

  [ "$domain_count" -gt 0 ]

  # Step 2: Process each domain (dry-run)
  echo "$matrix" | jq -c '.[]' | while read -r item; do
    domain_id=$(echo "$item" | jq -r '.domain_id')

    # dry-runで実行
    run pnpm start \
      --domain-id "$domain_id" \
      --config config/domains.json \
      --content-base . \
      --dry-run

    # 引数パースエラーがないことを確認
    [[ ! "$output" =~ "Unexpected argument" ]]
    [[ ! "$output" =~ "positional arguments" ]]
  done
}

@test "workflow simulation: all mode" {
  # Step 1: Select domains
  matrix=$(pnpm --silent matrix --config config/domains.json --mode all 2>/dev/null)
  domain_count=$(echo "$matrix" | jq -r 'length')

  [ "$domain_count" -ge 1 ]

  # matrixに含まれるドメイン数を確認
  config_domain_count=$(jq -r '.domains | length' config/domains.json)
  [ "$domain_count" -eq "$config_domain_count" ]
}
