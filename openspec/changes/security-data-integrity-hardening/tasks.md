## 1. 認証情報・原価情報の漏洩修正

- [ ] 1.1 `app/routes/monthly-plans.tsx` の loader が返すメンバーを `withoutMemberFinancials` でマスキングし、応答に `passwordHash` / `hourlyCostRate` が含まれないことを確認する（テスト追加）
- [ ] 1.2 `app/routes/monthly-plans.admin.tsx` の loader が返す capacities を `{ memberId, displayName }` の最小形に射影し、全メンバーの `passwordHash` が含まれないことを確認する（テスト追加）

## 2. 認証まわりの防御

- [ ] 2.1 `app/services/auth.ts` の `authenticateMember` に定数ダミーハッシュとの常時比較を実装し、未知メールと誤パスワードの応答時間が同等になることをテストで確認する
- [ ] 2.2 ログイン失敗に対する IP 単位のインメモリ固定窓レート制限（既定 15 分 / 10 回、`KOSU_LOGIN_RATE_LIMIT_MAX` / `KOSU_LOGIN_RATE_LIMIT_WINDOW_MS` で上書き）を実装し、超過時に 429 が返ることをテストで確認する
- [ ] 2.3 自己パスワード変更（`app/routes/profile.tsx`）後に現セッション以外を失効させる実装と、管理者による他メンバーパスワード変更（`app/routes/members.$id.tsx`）後に全セッションを失効させる実装を追加し、テストで確認する
- [ ] 2.4 members リポジトリに `countActiveAdministrators` を追加し、`app/routes/members.$id.tsx` で最後のアクティブ管理者の無効化・降格を 400 で拒否、他に管理者が残る場合は成功することをテストで確認する
- [ ] 2.5 ログイン成功時に期限切れセッションを一掃する（`app/services/auth.ts`）並びに実装し、期限切れセッションが削除されることをテストで確認する

## 3. 複数行更新のトランザクション化

- [ ] 3.1 `app/routes/work-logs.month.tsx` の月次一括入力を「全行バリデーション → `db.transaction` で一括適用」に変更し、途中に不正行がある場合に一切保存されないことをテストで確認する
- [ ] 3.2 月次一括入力で 0 を入力した場合、実績割当のない日の work log を削除し、割当がある日はエラーになることをテストで確認する
- [ ] 3.3 `app/services/import.ts` の `commitImport` を bcrypt 事前計算＋ `db.transaction` 内一括適用に変更し、途中失敗時に何も反映されず job が failed になることをテストで確認する
- [ ] 3.4 `app/services/daily-allocation-plans.ts` の `copyDailyAllocationPlansToActuals` を `db.transaction` 内で実行するよう変更し、途中失敗時に部分反映されないことをテストで確認する

## 4. CSV 入出力の堅牢化

- [ ] 4.1 `app/lib/csv.ts` の `parseCsv` で先頭 BOM（`\uFEFF`）を除去し、BOM 付き CSV がプレビューできることをテストで確認する
- [ ] 4.2 CSV 出力用の数式無害化ヘルパー（数値としてパースできない `=`/`+`/`-`/`@` 開始テキストに `'` を付与）を追加し、`stringifyCsv` と `reports.tsx` の `escapeCsv` から利用してテストで確認する

## 5. バリデーション強化・spec 準拠

- [ ] 5.1 月次予定・キャパシティ（`app/routes/monthly-plans.tsx`, `app/routes/monthly-plans.admin.tsx`）のサーバー側バリデーションに非負・0.25h 刻みチェックを追加し、テストで確認する
- [ ] 5.2 import の `validateRow`（`app/services/import.ts`）と月次画面に実在月チェック（`isValidMonth`）を追加し、`2026-13` がプレビュー時点で拒否されることをテストで確認する
- [ ] 5.3 `app/routes/self-assign.tsx` の action で案件の存在・アクティブ状態を検証し、アーカイブ済み案件はエラーメッセージ、存在しない ID は 404 を返すことをテストで確認する

## 6. ドキュメント

- [ ] 6.1 README のバックアップ手順を「コンテナ停止後の `data/` コピーまたは `sqlite3 .backup`」に更新し、稼働中のファイルコピーを禁止と明記する
- [ ] 6.2 README に公開運用時の注意（HTTPS 終端・リバースプロキシでのレート制限併用・CSV は UTF-8 で保存）を追記する

## 7. クリーンアップと検証

- [ ] 7.1 未使用の `getServerDatabase`（`app/services/auth.ts`）を削除する
- [ ] 7.2 `npm test` / `npm run typecheck` / `npm run lint` がすべて成功することを確認する

## 0. ベースライン修正（実施済み）

- [x] 0.1 `tests/routes/projects-and-plans.test.ts` の時間依存テスト2件を修正（member loader に `?month=2026-07` を明示）。実カレンダー月が 2026-07 を過ぎて失敗していた pre-existing 不具合。vitest run で PASS(11) を確認済み
