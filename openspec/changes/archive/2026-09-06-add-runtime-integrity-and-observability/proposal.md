## Why

業務利用を想定した全体レビューにより、前 change（`security-data-integrity-hardening`）が Non-Goal として残した「DB 接続の整合性・同時実行制御」に加え、インポートの必須列欠落が原因不明の全件失敗を招く問題、アサイン解除済み案件の実績を編集すると別案件へ付け替わる問題、そして障害を追跡する手段（ヘルスチェック・ログ）が存在しない問題が判明した。いずれも業務運用を開始する前に土台として固めるべき領域である。

## What Changes

- DB 接続確立時に `foreign_keys = ON` / `journal_mode = WAL` / `busy_timeout` を設定する
- 外部キー制約を有効化する前に孤立行の有無を検査し、検出時は修復を促す明確なエラーで起動を止める（**BREAKING**: 孤立行が存在する環境では起動しなくなる）
- CSV インポートでテンプレートの必須列そのものがヘッダ行に存在しない場合を、バリデーションエラーとして扱う
- 既存の実績配賦を編集する際、参照中の案件がアサイン解除済み・アーカイブ済みでも選択肢から落とさず、案件の付け替えは明示的な変更としてのみ検証する
- 認証不要の `/health` エンドポイントを追加する
- 認証失敗・権限拒否・アクション例外・月次締め操作を構造化ログとして標準出力へ記録する

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `self-hosting`: DB 接続ごとの外部キー強制・WAL・ビジータイムアウト設定、起動時の孤立データ検査、ヘルスチェック端点、運用イベントのログ記録
- `data-import-export`: テンプレート必須列の欠落検出とプレビュー時のエラー表示
- `time-entries`: 既存実績配賦の編集中に参照案件を維持し、暗黙の案件付け替えを拒否すること

## Impact

- `app/db/client.ts`（プラグマ設定）、`app/db/schema.ts` 周辺の整合性検査の追加
- `app/services/import.ts`（必須列検証）
- `app/routes/work-logs.$date.tsx`（案件選択肢の維持とサーバー側検証）
- `app/routes/health.ts`（新規）、`app/lib/log.ts`（新規）、各認証・アクション経路へのログ記録追加
- `README.md`（WAL 導入に伴うバックアップ対象の説明、起動時検査の修復手順）
- `docker-compose.yml`（healthcheck 追加）
- テスト: `tests/` 配下の該当ユニット・ルートテストの追加・更新
