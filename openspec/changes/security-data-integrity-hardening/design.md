## Context

- DB は better-sqlite3 + Drizzle。接続はリクエストごとに `createDatabaseConnection()` で生成し `finally` で close する運用。`db.transaction()` は同期コールバックで動作し、`monthly-cost-close.ts` が既に利用中。
- パスワードは bcrypt（`app/lib/password.ts` の `hashPassword` / `verifyPassword`、非同期）。`applyRow` 内で新規メンバー作成時に `hashPassword` を呼ぶため、import commit をそのまま同期トランザクションで包むことはできない。
- `deleteSessionsForMember` は実装済みだが未使用。`withoutMemberFinancials` / `withoutMemberPasswordHash` パターンはコードベースで確立済み。
- アプリは単一 Node プロセスで動作し、インメモリ状態はプロセス寿命で消える。Docker 公開時はリバースプロキシ前提の HTTPS 終端を README が想定。

## Goals / Non-Goals

**Goals:**

- 認証情報・原価情報が loader 応答へ流出しないこと
- 認証まわりの防御（タイミング均一化・レート制限・セッション失効・最後の管理者保護）
- 複数行更新（月次一括入力 / import commit / 実績コピー）の原子性
- CSV 入出力の堅牢化（BOM 許容・数式インジェクション無害化）
- 月次予定・キャパシティのサーバー側バリデーション強化
- 安全なバックアップ手順の文書化

**Non-Goals:**

- DB 接続のシングルトン化・WAL モード移行（別 change で検討）
- Dockerfile のマルチステージ化・非 root 実行（別 change で検討）
- 期限切れセッションの定期クリーンアップ（本 change ではログイン時の日次一掃まで。ジョブ化は将来）
- Shift-JIS 等の非 UTF-8 CSV 対応（ドキュメントで UTF-8 を案内するのみ）

## Decisions

1. **loader マスキングは既存ヘルパーで統一**
   - `monthly-plans.tsx` は `withoutMemberFinancials` を、`monthly-plans.admin.tsx` の capacities は `{ memberId, displayName }` の最小形に射影する。
   - 理由: コードベース確立済みパターン。新規ユーティリティは不要。

2. **タイミング均一化は定数ダミーハッシュとの常時比較**
   - モジュール先頭に事前計算した bcrypt ダミーハッシュを保持し、未知メール時も `verifyPassword(password, DUMMY_HASH)` を実行してから null を返す。
   - 代替案: 未知メールでも DB ラウンドトリップを追加 → 実装が複雑化する割に効果が同じため不採用。

3. **レート制限はインメモリ固定窓**
   - 失敗回数を IP（`X-Forwarded-For` 先頭、無ければ固定キー `"direct"`）単位で `Map<string, { count, resetAt }>` に記録。既定は「15 分あたり 10 回失敗」で超過時は 429 応答。環境変数 `KOSU_LOGIN_RATE_LIMIT_MAX` / `KOSU_LOGIN_RATE_LIMIT_WINDOW_MS` で上書き可能。
   - 理由: セルフホスト単一プロセス前提のため外部ストア不要。Redis 等は過剰。
   - 限界: プロセス再起動で状態消失、プロキシ不在時は IP 区別不可。README の公開運用ガイドでリバースプロキシ併用を明記する。

4. **セッション失効は自己変更時のみ現セッションを保持**
   - 自己パスワード変更: 現セッション ID を除いて `deleteSessionsForMember`。管理者による他メンバー変更・import による変更: 全セッション削除。
   - 理由: 自己変更後に即ログアウトされる UX を避けつつ、他端末は失効させる。

5. **最後の管理者保護は members リポジトリに `countActiveAdministrators` を追加**
   - 無効化・降格の action 内で「対象がアクティブ管理者かつ他にアクティブ管理者がいない」場合に 400 を返す。トランザクション内でカウントして競合を回避。

6. **複数行更新のトランザクション化**
   - 月次一括入力: 全日付分のバリデーションを先に完了し、その後 `db.transaction` 内で create/update/0 時間クリアを実行。
   - 実績コピー: `copyDailyAllocationPlansToActuals` の全件ループを `db.transaction` 内へ移動（全 DB 操作が同期のため可能）。
   - import commit: bcrypt を事前に一括計算（必要な新規メンバー分をトランザクション前に `hashPassword` し Map 化）し、`db.transaction` 内の `applyRow` は事前計算済みハッシュを参照する。全件オール・オア・ナッシング。1 行でも失敗したらロールバックし import job を failed にする。
   - 理由: drizzle/better-sqlite3 のトランザクションは同期のため、非同期 bcrypt をトランザクション内に置けないことが根拠。

7. **0 時間クリアのセマンティクス**
   - 月次一括入力で「空欄 = 変更なし」「0 = クリア」と区別。0 は対象日の work log に実績割当が存在しない場合のみ許可し、work log を物理削除する。割当が存在する日はバリデーションエラー。
   - 理由: 既存の日別入力側の仕様（0 拒否）は変更せず、月次一括にクリア導線を限定して影響を最小化。

8. **CSV は BOM 除去と数値でない先頭危険文字の無害化**
   - `parseCsv` は先頭 `\uFEFF` を 1 回だけ除去。
   - 出力側は共通ヘルパー（例: `neutralizeCsvCell`）を追加: セルが `=` / `+` / `-` / `@` で始まり、かつ数値としてパースできない場合のみ先頭に `'` を付与。数値セル（負数含む）は無害化しない。
   - 適用箇所: `stringifyCsv`（全管理者エクスポート）と `reports.tsx` の `escapeCsv`（共通ヘルパーへ委譲して二重実装を解消）。

9. **月次バリデーションは `lib/time` の既存検証を流用**
   - `isValidQuarterHour` と `isValidMonth`（実在月チェック）を monthly-plans / monthly-plans.admin / imports の `validateRow` に追加。プレビュー時点で実在月を拒否し、コミット時 500 を防止。

10. **自己アサインは spec 準拠修正（delta なし）**
    - action で案件の存在・アクティブ状態を検証し、非アクティブは「アーカイブ済み案件へは自己アサインできません」を intent 付きで返却、存在しない ID は 404。既存 spec（work-items「Project self-assignment」）の実装不備の是正。

11. **バックアップ手順は README を更新**
    - 「コンテナ停止後の `data/` コピー」または `sqlite3 data/kosu.db ".backup '...'"` を正とし、稼働中のファイルコピーを禁止と明記。

## Risks / Trade-offs

- [インメモリレート制限は複数プロセス・再起動で効力が部分的に失われる] → セルフホスト単一プロセス前提を README に明記し、前面リバースプロキシでのレート制限併用を案内
- [import commit のオール・オア・ナッシング化により、部分取り込みに依存していた運用があった場合挙動が変わる] → 変更はバグ是正としてリリースノートに明記。プレビューで全行有効時のみコミット可能な現 UI と整合
- [bcrypt 事前計算により import 中にパスワードを変更する運用との競合が理論上あり得る] → 単一管理者操作前提のため実害は無視できる範囲と判断
- [0 時間クリアで work log を物理削除する] → 割当が無い日のみ許可し、履歴必要性は割当側が保持するため影響なし
- [`'` プレフィックスは Excel 上で文字列として表示される] → 数値セルは無害化対象外とし、表示影響を自由入力テキストに限定

## Migration Plan

- スキーマ変更なし。マイグレーション不要。
- デプロイ後のロールバックは通常のビルド戻しで可能（データ互換性の懸念なし）。

## Open Questions

（なし）
