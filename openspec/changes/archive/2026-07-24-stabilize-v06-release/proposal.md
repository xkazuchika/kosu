## Why

v0.6の主要機能と自動テストは揃っているが、ワークスペースのタイムゾーンが「今日」「今月」の判定に反映されず、日本時間では深夜帯に誤った日付を表示し得る。また、CIとE2E smoke testが未整備で、リリースチェックと一部preview表示が過去バージョンのまま残っているため、次の機能開発へ進む前に安定した区切りを作る。

## What Changes

- ワークスペースのIANAタイムゾーンを検証し、ダッシュボード、工数入力、予定入力、レポートのカレンダー既定値をそのタイムゾーンから一貫して算出する。
- 日付・月の既定値を共通化し、UTCの文字列切り出しによるローカル日付判定をなくす。
- GitHub ActionsでVitest、型チェック、Lint、production buildをPull Requestごとに実行する。
- Playwrightに初期セットアップとログインを確認する最小smoke testを追加し、E2Eコマンドが0件のまま成功扱いされない状態にする。
- v0.1向けのリリースチェックを現在のリリース検証手順へ更新し、Docker起動・マイグレーション・SQLite永続化・依存関係監査の確認項目を再利用可能にする。
- 公開範囲外で古いバージョン表記を持つリソース計画previewルートを撤去し、READMEと現行レポート仕様に画面構成を合わせる。
- 既知の開発ツール由来moderate advisoryは本番依存と区別して記録し、安全でない強制ダウングレードは行わない。

## Capabilities

### New Capabilities

- `workspace-calendar`: ワークスペースのタイムゾーン検証と、今日・現在月を使う画面全体の一貫したカレンダー基準を定義する。
- `repository-quality`: Pull Request品質ゲート、最小E2E smoke test、リリース検証記録を定義する。

### Modified Capabilities

- `reports`: 公開範囲外の旧リソース計画previewを提供せず、サポート対象の工数・予定対実績・案件財務レポートに限定する。

## Impact

- Affected code: `app/lib/time.ts`、workspace setup/settings、dashboard、work-log、daily/monthly planning、report routes。
- Affected tooling: `.github/workflows/`、`playwright.config.ts`、`tests/e2e/`、package scripts。
- Affected documentation: `README.md`、`docs/release-checklist.md`、OpenSpec report scope。
- No database migration is expected; existing workspace timezone values remain valid when they are recognized IANA identifiers.
- The completed `filter-allocation-issues` and `project-financial-control` changes should be archived before applying this change so their delta specs are present in the main specification baseline.
