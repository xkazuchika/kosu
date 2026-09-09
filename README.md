# kosu

`kosu` は、小さなチームや部門向けの軽量セルフホスト OSS 工数管理アプリです。

現在のアプリバージョンは `v0.8.0` です。

重い SaaS や ERP を導入せずに、日次・週次の実績工数入力、案件・タスク別の実績工数、案件工数予算、日別・月次の予定工数、月別の総稼働時間、基本的な工数レポートを扱うことを目指しています。初期 UI とドキュメントは日本語ファーストです。

## 操作ガイド

画面ごとの操作手順は [docs/user-guide.md](docs/user-guide.md) を参照してください。

月次の業務の流れと締めの条件は [docs/business-flow.md](docs/business-flow.md) を参照してください。

## 現在できること

- ワークスペース初期セットアップと最初の管理者作成
- メンバー管理、部署属性、管理者/メンバーの2権限
- 案件、案件工数予算、タスク、担当アサイン、メンバー自身による既存案件への自己アサイン
- メンバー別の月次稼働可能時間と案件別の月次予定工数
- 日別予定工数入力と月次予定工数との差分確認
- 保存済みの日別予定工数から実績工数への反映
- 日別の総稼働時間と案件・タスク別の実績工数を複数行で一括入力
- 日別予定・直近勤務日からの未保存下書きと、残時間の一括割当
- 月曜から日曜までの週次実績工数入力
- 月別総稼働時間の一括入力
- 対象月・状態で絞り込める未割当・超過の警告と日別修正導線
- 月次原価締めによる完全性確認、全更新経路の保護、承認済み案件財務スナップショット
- メンバー向け・管理者向けダッシュボード
- ワークフロー別サイドバー、モバイルナビゲーション、Today First ダッシュボード
- 日付の多い入力画面での曜日表示、土曜/日曜の視認性向上
- 工数実績レポート、予定工数対実績工数レポート、CSV エクスポート
- 管理者向けの案件別直接人件費、残り人件費予算、労務粗利レビュー
- メンバー、案件、アサイン、稼働可能時間、月次予定工数の CSV インポート

日次・週次・月別の実績入力と日別予定は、実在する日付と 0.25h 単位の値だけを受け付け、1日あたりの総稼働・各案件工数・案件工数合計をそれぞれ 24h 以下に制限します。メンバーの時間あたり原価は空欄または 0 以上の整数円です。

CSV インポートは画面入力と同じ単価・有効状態・アサイン関係を検証し、不正行があるファイルは全件を取り込みません。案件 CSV の `effortBudgetHours` は任意列で、新しいテンプレートとエクスポートに含まれます。旧ヘッダーも利用でき、列がない更新では既存の案件工数予算を維持します。

## 現在対象外のこと

`kosu` は軽量な工数管理と直接人件費管理に絞っています。ERP、勤怠管理、給与計算、請求書発行、入金管理、経費精算、仕入れ・外注費管理、複雑な承認ワークフロー、ガントチャート、チケット管理、自動タイマー、本格的な会計・財務レポートは対象外です。

日別の予定工数対実績工数レポート、リソース計画、仕入れ・外注費を含む案件原価、最終利益見込みは今後の検討対象です。

## 技術スタック

- React Router / Remix-style full-stack routing
- TypeScript
- Tailwind CSS と shadcn/ui-style の軽量コンポーネント
- SQLite と Drizzle ORM
- Vitest
- Playwright

## ローカル開発

必要なもの:

- Node.js 22.22 以上
- npm

セットアップ:

```bash
npm install
```

開発サーバー:

```bash
npm run dev
```

`npm run dev` は起動前に `npm run db:migrate` を実行します。

品質チェック:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

`npm run test:e2e` は、隔離された一時SQLiteデータベースで初期セットアップ、ログイン、主要レポートへの到達をChromiumで確認します。Pull RequestではGitHub Actionsが単体テスト、型、Lint、build、browser smokeを自動実行します。

Drizzle マイグレーション用コマンド:

```bash
npm run db:generate
npm run db:migrate
```

## データディレクトリ

SQLite データベースはデフォルトで `./data/kosu.sqlite` に保存します。`KOSU_DATA_DIR` を指定すると、データディレクトリを変更できます。

```bash
KOSU_DATA_DIR=/var/lib/kosu npm run db:migrate
```

セルフホスト運用では、このディレクトリを永続化ボリュームに配置し、バックアップ対象にしてください。

データベースは WAL（Write-Ahead Logging）モードで動作します。同じディレクトリに `kosu.sqlite-wal` と `kosu.sqlite-shm` が生成されますが、**これらもデータベースの一部です**。バックアップと復元は必ず `kosu.sqlite` とこれらのファイルを一体として扱ってください。

データベース接続ごとに外部キー制約を有効化しています。`journal_mode = WAL` と `busy_timeout`（デフォルト 5000ms、環境変数 `KOSU_SQLITE_BUSY_TIMEOUT_MS` で変更可能）も合わせて設定されます。

## 主な画面

公開用スクリーンショットは今後追加予定です。現時点では、ローカルでデモデータを投入して以下の画面を確認できます。

- ダッシュボード
- 日別工数実績入力
- 週次工数実績入力
- 月別総稼働時間入力
- 日別予定工数入力
- 月次予定工数
- 工数実績レポート
- 予定工数対実績工数
- 案件財務レビュー（管理者のみ）
- 月次原価締め（管理者のみ）

サポート対象のレポートは上記3系統です。月次キャパシティ比較は予定工数対実績工数に含まれます。案件工数予算は全期間の予定・実績に対する管理値であり、本格的な要員最適化やガントチャートは現在の公開範囲に含みません。

## 案件別の直接人件費管理

請求対象案件では、管理者が税抜の契約売上と人件費予算を別々に登録できます。保存済みの月次予定工数・実績工数に記録された時間あたり原価から、案件ごとの次の値を確認できます。

- 選択月の予定人件費・実績人件費
- 累計実績人件費
- 残り人件費予算・人件費予算消化率
- 目標労務粗利・目標労務粗利率
- アーカイブ済み案件の確定労務粗利・確定労務粗利率

これらは直接人件費だけを対象にした管理値です。仕入れ、外注費、経費、税金、請求・入金は含めません。原価スナップショットがない予定・実績工数がある場合、金額は不完全として表示され、残予算や確定労務粗利を確定値として扱いません。

旧「売上または予算」項目の値は自動変換されません。案件編集から、意味を確認したうえで契約売上または人件費予算を設定してください。

## 月次原価締め

管理者は `/period-locks` で対象月をレビュー中にして編集を止め、完全性チェック後に承認できます。勤務時間と配賦時間の不一致、原価スナップショット欠損、活動中の請求対象案件に必要な契約売上・人件費予算の欠損は承認をブロックします。日次予定と月次予定の差は警告ですが、承認は妨げません。

レビュー中・承認済みの月は、管理者を含む全員について実績、配賦、日次・月次予定、キャパシティ、予定から実績への反映、対象月のCSV取り込みが読み取り専用になります。修正時は理由を記録して再オープンします。承認済み案件財務は承認時のスナップショットを表示するため、その後の案件名・基準額・メンバー原価率・アーカイブ状態・将来実績の変更では変わりません。

旧バージョンの有効な月次ロックは、アップグレード時に「レビュー中」として移行されます。旧ロックテーブルはロールバック互換性のため残りますが、承認済みとはみなしません。

## Docker デプロイ

必要なもの:

- Docker
- Docker Compose

ビルドと起動:

```bash
# 本番用シークレットを設定
export KOSU_SESSION_SECRET=$(openssl rand -hex 32)

# ビルド＆起動
docker compose up --build -d
```

環境によっては Docker Compose plugin ではなく standalone コマンドを使います。

```bash
docker-compose up --build -d
```

`docker-compose.yml` は `/data` を `kosu-data` ボリュームにマウントします。

Docker 手順は release checklist で smoke test する対象です。公開前には build、起動、初期セットアップ画面への到達、永続化ボリュームの確認を行ってください。

## バックアップと復元

SQLite データベースは `KOSU_DATA_DIR`（デフォルト `./data`）に保存されます。WAL モードのため `kosu.sqlite` に加えて `kosu.sqlite-wal` / `kosu.sqlite-shm` が存在します。これら 3 ファイルをまとめてバックアップしてください。

**重要: 稼働中の SQLite ファイルを `cp` でコピーしないでください。** 書き込み中のデータベースをコピーすると、破損したバックアップになる可能性があります。次のいずれかの方法を使用してください。

方法1: SQLite の一貫性バックアップコマンド（アプリ稼働中でも安全）:

```bash
sqlite3 ./data/kosu.sqlite ".backup '/backup/kosu-$(date +%Y%m%d).sqlite'"
```

方法2: アプリを停止してからディレクトリをコピー:

```bash
npm stop  # または docker compose stop
cp -r ./data /backup/kosu-$(date +%Y%m%d)
```

Docker Compose の named volume を使っている場合（コンテナ停止後にコピー）:

```bash
docker compose stop
docker run --rm -v kosu_kosu-data:/data -v "$PWD/backups:/backup" alpine sh -c 'cp -r /data /backup/kosu-$(date +%Y%m%d)'
docker compose start
```

復元:

```bash
rm -rf ./data
cp -r /backup/kosu-YYYYMMDD ./data
```

Docker Compose の named volume へ復元する場合:

```bash
docker run --rm -v kosu_kosu-data:/data -v "$PWD/backups:/backup" alpine sh -c 'rm -rf /data/* && cp -r /backup/kosu-YYYYMMDD/* /data/'
```

## 外部キー制約の検査

アプリは起動時に外部キー制約の違反（孤立行）を検査し、違反がある場合は起動を中止します。アップグレード前に次のコマンドで事前確認できます。

```bash
npm run db:check
# または特定のファイルを指定
npx tsx scripts/check-foreign-keys.ts /var/lib/kosu/kosu.sqlite
```

`npm run db:migrate` はマイグレーション適用後にこの検査を実行します。違反が検出された場合は対象テーブルと件数が表示され、非ゼロ終了します。

修復方法:

1. 対象行を特定します。

   ```bash
   sqlite3 ./data/kosu.sqlite "PRAGMA foreign_key_check"
   ```

2. 参照先を確認します。

   ```bash
   sqlite3 ./data/kosu.sqlite "PRAGMA foreign_key_list(<テーブル名>)"
   ```

3. バックアップからリストアするか、孤立行を明示的に削除・修復してから再起動します。

自動修復は行いません。削除はデータ損失を伴う判断のため、内容を確認したうえで人手で実施してください。

## ヘルスチェックとログ

`GET /health` は認証不要で可用性を返します。データベース接続が利用できる場合は `200`、利用できない場合は `503` を返します。レスポンスは `{"status":"ok","database":true}` のような可用性情報のみで、メンバー・案件・財務情報は含まれません。Docker Compose の healthcheck と外部監視から利用してください。

運用上重要なイベント（認証失敗、レート制限超過、権限拒否、保護された月への書き込み拒否、アクションの失敗、月次締め操作）は、1 行 JSON として標準出力へ記録されます。

```json
{
  "level": "warn",
  "event": "auth.login_failed",
  "message": "ログイン認証に失敗しました",
  "at": "2026-09-06T00:00:00.000Z",
  "emailDomain": "example.com"
}
```

コンテナ運用では標準出力が唯一の収集経路です。Docker のログドライバや外部のログ収集サービスへ転送してください。パスワード・パスワードハッシュ・セッション ID・原価率はログに記録されません。

## デモデータ投入（開発・評価用）

```bash
npm run db:seed:demo
```

本番環境 (`NODE_ENV=production`) では実行できません。

デモデータ投入後は、次のアカウントでログインできます。

- 管理者: `admin@example.com` / `password123`
- メンバー: `member@example.com` / `password123`

## バージョン履歴

- `v0.8.0`: 案件工数予算と予定・実績・残工数の確認、メンバー別の割当状況、日次入力の下書き・残時間割当、週次一括入力、データ整合性・運用監視・認証保護を追加・強化。
- `v0.7.0`: 月次原価締め、締め前完全性チェック、全更新経路の保護、理由付き再オープン、承認済み案件財務スナップショットを追加。
- `v0.6.1`: ワークスペースのタイムゾーンに基づく日付初期値、リリース検証、GitHub Actions CI、Playwright smoke test を追加し、未対応のリソース計画プレビューを削除。
- `v0.6.0`: 管理者向けの案件別直接人件費、人件費予算、予算消化、労務粗利レビューと、メンバー向けの月別未割当・超過修正導線を追加。
- `v0.5.0`: ワークフロー別ナビゲーション、Today First ダッシュボード、共有UI刷新、主要画面の構成整理、曜日/土日表示を追加。
- `v0.4.0`: 日別予定工数入力と予定から実績への反映を追加。
- `v0.3.0`: 月次予定入力を再設計。
- `v0.2.0`: 月次入力と予定対実績を追加。
- `v0.1.0`: MVP。

## セルフホスト運用メモ

- 現在は SQLite single-instance self-host 前提です。
- high concurrency、multi-instance、multi-tenant SaaS 用途は対象外です。
- PostgreSQL 対応や複数インスタンス運用は今後の検討対象です。
- 永続化ディレクトリをバックアップ対象にします（稼働中の SQLite ファイルコピーは禁止。上記の手順を参照）。WAL モードの `kosu.sqlite-wal` / `kosu.sqlite-shm` もデータベースの一部として扱ってください。
- アップグレード前に `npm run db:check` で外部キー制約の違反を確認してください。違反がある場合は起動を中止します。
- 本番投入前に、環境変数、永続化ボリューム、バックアップ、HTTPS 終端、Cookie 設定を確認してください。
- インターネット公開する場合は、HTTPS 終端とリバースプロキシ（IP 単位のレート制限併用）を前面に配置してください。アプリ内のログインレート制限（既定: 15分あたり10回失敗、`KOSU_LOGIN_RATE_LIMIT_MAX` / `KOSU_LOGIN_RATE_LIMIT_WINDOW_MS` で調整）は単一プロセス前提です。
- CSV インポートは UTF-8（BOM 付き可）で保存してください。Shift-JIS は文字化けするため非対応です。
- `KOSU_SESSION_SECRET` は本番環境で必須です（32文字以上）。
- 公開前の確認項目は `docs/release-checklist.md` を参照してください。
- 「今日」「今月」の既定値は、ワークスペース設定のタイムゾーンを基準にします。

## OpenSpec

現在のスコープは `openspec/specs/` を参照してください。`openspec/changes/archive/` は過去の検討・実装履歴であり、現在の公開スコープと異なる記述を含む場合があります。詳しくは `openspec/README.md` を参照してください。

## OSS としての利用

`kosu` は MIT License で公開する想定です。小さな部門や受託・社内開発チームが、自分たちの環境で試しやすいことを優先しています。

Issue や Pull Request では、次の情報があると検討しやすくなります。

- チーム規模と利用シナリオ
- 月次予定工数、日別予定工数、日別実績工数、レポートのどこに関する要望か
- 権限や公開範囲に関わる変更かどうか
- 再現手順、期待結果、実際の結果

## English Summary

`kosu` is a lightweight self-hosted OSS effort management web app for small teams. Version `v0.8.0` adds project effort budgets with planned, actual, and remaining effort visibility; member allocation views; faster daily entry with drafts and remaining-time allocation; weekly bulk entry; and stronger data integrity, operational monitoring, and authentication protection. It also includes administrator-only direct-labor cost control, monthly cost closing, daily and monthly planned effort, planned-vs-actual reporting, CSV import/export, workflow-oriented navigation, GitHub Actions CI, Playwright production smoke testing, and SQLite single-instance deployment. Accounting, invoicing, expense, procurement, full resource planning, multi-instance operation, and multi-tenant SaaS use cases are out of scope. The UI and documentation are Japanese-first, and the project is licensed under MIT.
