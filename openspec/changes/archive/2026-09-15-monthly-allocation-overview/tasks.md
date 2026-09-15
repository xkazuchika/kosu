## 1. 確認状態の保存と整合性

- [x] 1.1 `app/db/schema.ts` に担当者・月の予定確認テーブルを追加し Drizzle migration を生成する。空 DB と既存 DB の migration テストで UNIQUE、月・revision 制約、既存予定・原価・締めの保持を検証する。
- [x] 1.2 月次予定・キャパシティの変更時に revision 更新と確認解除を行う trigger を migration に追加する。追加・更新・削除、旧新対象、原価のみ更新の除外、失敗時 rollback を DB テストで検証する。
- [x] 1.3 予定確認 repository / service を追加し、管理者、有効メンバー、実在月、未締め、revision を同一 transaction で検証する。0時間確認、capacity なし、古い revision、保護月・権限拒否をサービスとルートテストで検証する。

## 2. 配分集計と画面

- [x] 2.1 時間のみの月次集計サービスを実装する。案件内の役割合算、社内・非請求案件、capacity 未設定と0、超過、未確認、無効メンバーとアーカイブ案件を単体テストで検証する。
- [x] 2.2 管理者の月次予定画面に担当者×案件一覧と確認操作、同月の予実比較への導線を追加する。既存入力が利用でき、140h予定/160h capacity の確認後余力が20hとなることをルートテストとブラウザーで確認する。
- [x] 2.3 予実比較のキャパシティ表示を共通計算と確認状態に統一する。実績を二重に引かないこと、未確認を空きと表示しないこと、本人以外の情報と金額をメンバーへ返さないことを `tests/routes/reports.test.ts` で検証する。
- [x] 2.4 既存の本人向け月次予定に capacity 残高表示がある場合は共通の表示規則を適用し、画面間の意味の一致と本人限定のデータ返却を `tests/routes/projects-and-plans.test.ts` で検証する。

## 3. 統合確認と運用説明

- [x] 3.1 CSV 予定・capacity 更新による対象月のみの確認解除と、不正 CSV の全件 rollback を既存 import テストへ追加する。原価締めで保護された月への書き込み拒否も回帰検証する。
- [x] 3.2 ブラウザーで月変更、予定編集→確認→再編集、未設定・0・超過・社内作業、狭い画面の表と確認操作を検証し、UI のスクリーンショットを残す。
- [x] 3.3 README、`docs/user-guide.md`、`docs/business-flow.md` に月次配分→実績→振り返り、任意の日次予定、確認と実績提出の違い、余力が月単位の目安であることを記載し、画面と説明の一致を確認する。
- [x] 3.4 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:e2e` と `git diff --check` を実行し、変更全体の検証結果を記録する。

## 検証結果（2026-09-14）

- Vitest: 61ファイル・356テスト成功。移行、確認状態、役割合算、CSV、権限、本人限定返却を検証。
- TypeScript / ESLint / git diff --check / OpenSpec strict validation: 成功。
- Playwright: Chromiumで成功。本番ビルド・隔離DB移行・起動を含む。月切替、予定140h/稼働可能160h→確認→余力20h、変更時の確認解除、0h/超過、社内案件、予実比較への遷移、390×844での確認操作を検証。
- 検証URL: http://127.0.0.1:5173。内蔵Browser接続が `No browser is available` だったため、計画済みのPlaywrightで検証。対象フローのconsole/pageerrorなし。既存smoke末尾の廃止URLに対する404は期待どおり。
- デスクトップとモバイルのスクリーンショットをOS一時ディレクトリの `kosu-monthly-allocation-desktop.png` / `kosu-monthly-allocation-mobile.png` に保存し目視確認。Chrome以外のブラウザーと週単位の配分は検証対象外。
- アプリの公開・リリース・変更のアーカイブは未実施。
