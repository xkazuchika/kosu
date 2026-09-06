## Why

コードレビュー（業務利用目線）により、パスワードハッシュがブラウザへ送信される重大な情報漏洩、パスワード変更後もセッションが残る問題、トランザクション外での部分コミット、総当たりログイン無対策など、運用開始前に修正が必要な課題が判明した。

## What Changes

- 月次予定・管理キャパシティ画面の loader がメンバーの `passwordHash` / `hourlyCostRate` を返さないようにする（情報漏洩修正）
- パスワード変更時に該当メンバーの全セッションを失効させる
- ログインの応答時間を均す（ダミーハッシュ比較）し、IP 単位のレート制限を追加する
- 最後のアクティブ管理者の無効化・降格を拒否する
- 月次一括入力・CSV import・日次予定→実績コピーをトランザクション化し、部分コミットを防ぐ
- CSV import commit を全件成功時のみ反映するオール・オア・ナッシングにする
- BOM 付き UTF-8 CSV（Excel 由来）を正常にパースできるようにする
- CSV エクスポートで数式インジェクション（`=`/`+`/`-`/`@` 開始値）を無害化する
- 月次予定・キャパシティのサーバー側バリデーションを強化する（負数拒否・0.25h 刻み・月形式検証）
- 月次一括入力で 0 時間を入力した場合のクリア導線を提供する（実績割当がない日に限る）
- 自己アサイン action でアーカイブ済み案件・無効 ID を既存 spec どおり拒否する（spec 準拠修正・delta なし）
- README のバックアップ手順を安全な手順（コンテナ停止後コピーまたは `sqlite3 .backup`）に更新する

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `team-members`: ログイン要求の応答時間均一化と IP 単位レート制限、パスワード変更時のセッション全失効、最後のアクティブ管理者の無効化・降格拒否
- `monthly-plans`: 月次予定・キャパシティ画面の応答に credential / financial フィールドを含めないこと、予定工数・キャパシティ工数のサーバー側検証（非負・0.25h 刻み・月形式）
- `data-import-export`: BOM 付き CSV の受け入れ、import commit のオール・オア・ナッシング化、エクスポート CSV の数式インジェクション対策
- `time-entries`: 月次一括入力の全体原子性（バリデーション失敗時に部分更新しない）、実績コピーの原子性、実績割当のない日に対する 0 時間クリア
- `self-hosting`: バックアップ手順を稼働中 SQLite のファイルコピーから安全な手順へ変更

## Impact

- `app/routes/monthly-plans.tsx`, `app/routes/monthly-plans.admin.tsx`（loader マスキング）
- `app/routes/members.$id.tsx`, `app/routes/profile.tsx`（セッション失効・最後の管理者保護）
- `app/services/auth.ts`（タイミング均一化・レート制限）、`app/db/repositories/sessions.ts`（既存 `deleteSessionsForMember` を利用）
- `app/routes/work-logs.month.tsx`, `app/services/import.ts`, `app/services/daily-allocation-plans.ts`（トランザクション化）
- `app/lib/csv.ts`, `app/routes/reports.tsx`（BOM 除去・数式無害化）
- `app/routes/imports.tsx`, `app/routes/self-assign.tsx`（バリデーション・spec 準拠）
- `README.md`（バックアップ手順）
- テスト: `tests/` 配下の該当ユニット・E2E テストの追加・更新
