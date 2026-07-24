## Context

v0.6ではVitest 160件、型チェック、Lint、production buildが成功している。一方、workspaceに保存された`defaultTimezone`は設定画面以外で使われず、複数ルートが`new Date().toISOString().slice(...)`をカレンダー上の今日・現在月として使う。これはUTCの保存時刻には正しいが、利用者の暦日には正しくない。

リポジトリにはPlaywright設定と`test:e2e`があるがテストは0件で、GitHub Actionsはない。リリースチェックはv0.1の実績を固定表示し、非公開範囲の`/reports/resource-planning`もv0.1/v0.2 previewのまま直接アクセスできる。

## Goals / Non-Goals

**Goals:**

- workspace timezoneをカレンダー既定値の唯一の基準にする。
- 時刻を固定した境界テストで日付・月替わりを再現可能にする。
- Pull Requestごとに主要品質チェックと最小ブラウザsmokeを再現可能にする。
- 現在の公開範囲とリリース文書を一致させる。

**Non-Goals:**

- 保存済み日時や監査用timestampをローカル時刻へ変換する。
- ユーザー単位のタイムゾーンや休日カレンダーを追加する。
- 本格的なリソース計画、網羅的E2E、カバレッジ閾値を導入する。
- 既知のdev-only advisoryを強制的なbreaking downgradeで解消する。

## Decisions

### Decision: workspace calendar contextを共通サービスで解決する

純粋な日付関数は、基準`Date`とタイムゾーンから`YYYY-MM-DD`と`YYYY-MM`を返す。DBに依存する薄いサービスがworkspaceを読み、各loader/actionへ`today`と`currentMonth`を提供する。テストでは基準時刻を注入する。

`Intl.DateTimeFormat`を利用してNode.js標準機能だけで認識可能なタイムゾーンを検証・正規化する。setup/settingsは不正値を拒否する。既存DBに不正値がある場合はリクエストをクラッシュさせずUTCへフォールバックし、管理者が設定を修正できる警告情報を返す。

Alternatives considered:

- `TZ`環境変数へ依存する: workspace設定と実行環境がずれ、複数環境で再現しにくい。
- 日付ライブラリを追加する: この用途は`Intl`で満たせるため依存追加が過剰。
- 各routeで個別変換する: 境界挙動とフォールバックが再び分散する。

明示的に指定された有効な日付・月は変更せず、未指定または不正な場合だけworkspace calendarの既定値を使う。作成・更新時刻は引き続きUTC ISO timestampとする。

### Decision: CIを静的・単体ゲートとブラウザsmokeに分ける

GitHub ActionsはNode.js 22.22以上と`npm ci`を使い、`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`を必須ジョブで実行する。別ジョブでChromiumを導入し、Playwright smokeを実行する。ジョブを分けることで失敗原因と実行時間を判別しやすくする。

Playwright web serverは`127.0.0.1`へ明示的にbindし、CI専用の一時`KOSU_DATA_DIR`と32文字以上のsession secretを使う。smokeは新規DBのsetup、ログイン、認証後dashboard到達を確認し、テスト間で状態を共有しない。

Alternatives considered:

- E2EをCIに含めない: 0件の設定だけが残る問題を解消できない。
- 全機能をE2E化する: v0.6の締めとして範囲が大きく、既存Vitestと重複する。

### Decision: 古いresource planning previewは撤去する

現在サポートされるcapacity比較は予定対実績レポートに存在し、preview routeはナビゲーションされず、説明もv0.1/v0.2で停止している。ルート登録と実装を削除し、将来の本格的リソース計画は別changeで再設計する。

### Decision: release checklistを再利用可能な検証文書にする

固定されたv0.1のチェック済み項目ではなく、各リリースで実行するコマンド、Docker smoke、migration、永続化、production dependency audit、dev dependency advisoryの扱いを記録するテンプレートへ更新する。未実行の検証を成功済みとして記載しない。

## Risks / Trade-offs

- [既存の不正timezoneがUTCへフォールバックする] → 管理者向け警告を表示し、設定画面で修正可能にする。
- [日付境界テストが実時刻に依存する] → 基準時刻を注入し、UTCとAsia/Tokyoの月替わりを固定値で検証する。
- [ブラウザCIが遅くなる] → 初期セットアップとログインのsmokeだけに限定し、単体ゲートと並列化する。
- [preview URLの利用者がいる] → 未公開・非ナビゲーションrouteであることを前提に404とし、同等のcapacity確認先を予定対実績レポートとして文書化する。
- [dev dependency advisoryが継続する] → production auditと分離して記録し、互換性のある更新を継続監視する。

## Migration Plan

1. `filter-allocation-issues`と`project-financial-control`をアーカイブし、メイン仕様を同期する。
2. timezone検証とworkspace calendar contextを追加し、setup/settingsと対象routeを移行する。
3. 境界テストを追加し、古いresource planning previewを撤去する。
4. Playwright smokeとGitHub Actionsを追加する。
5. リリース文書を更新し、全品質ゲートとDocker smokeを再検証する。

DB migrationは不要。ロールバック時はrouteの既定値利用箇所を戻せるが、timezone検証とテストは保持してよい。CIはworkflowをrevertすることで独立して戻せる。

## Open Questions

- なし。ユーザー別タイムゾーンや本格的リソース計画は別changeで扱う。
