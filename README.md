# kosu

`kosu` は、小さなチームや部門向けの軽量セルフホスト OSS 工数管理アプリです。

重い SaaS や ERP を導入せずに、日々の工数入力、案件・タスク別の配賦、月次の稼働可能時間と予定工数、基本的な工数レポートを扱うことを目指しています。初期 UI とドキュメントは日本語ファーストです。

## v0.1 で扱うこと

- ワークスペース初期セットアップと最初の管理者作成
- メンバー管理、部署属性、管理者/メンバーの2権限
- 案件、タスク、担当アサイン、メンバー自身による既存案件への自己アサイン
- メンバー別の月次稼働可能時間と案件別の予定工数
- 日次の総稼働時間と案件・タスク別の実績配賦
- 未配賦・過配賦の警告表示
- 月次ロックによるレビュー済み期間の保護
- メンバー向け・管理者向けダッシュボード
- 基本的な工数レポートと CSV エクスポート
- メンバー、案件、アサイン、稼働可能時間、月次計画の CSV インポート

## v0.1 で扱わないこと

`kosu` v0.1 は軽量な工数管理に絞っています。ERP、勤怠管理、給与計算、請求書発行、経費精算、複雑な承認ワークフロー、ガントチャート、チケット管理、自動タイマー、本格的な採算管理や財務レポートは対象外です。

planned-vs-actual、リソース計画、原価・売上・粗利を含む詳細レポートは v0.2 以降の検討対象です。

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
npm run db:migrate
npm run dev
```

品質チェック:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

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

## 画面イメージ

公開用スクリーンショットは v0.1 リリース準備時に追加予定です。現時点では、ローカルでデモデータを投入して以下の画面を確認できます。

- ダッシュボード
- 日次工数入力
- 月次予定
- 基本工数レポート

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

Docker 手順は v0.1 公開前の release checklist で smoke test する対象です。公開前には build、起動、初期セットアップ画面への到達、永続化ボリュームの確認を行ってください。

## バックアップと復元

SQLite データベースは `KOSU_DATA_DIR`（デフォルト `./data`）に保存されます。

バックアップ:

```bash
cp -r ./data /backup/kosu-$(date +%Y%m%d)
```

Docker Compose の named volume を使っている場合:

```bash
docker run --rm -v kosu_kosu-data:/data -v "$PWD/backups:/backup" alpine sh -c 'cp -r /data /backup/kosu-$(date +%Y%m%d)'
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

## デモデータ投入（開発・評価用）

```bash
npm run db:seed:demo
```

本番環境 (`NODE_ENV=production`) では実行できません。

## セルフホスト運用メモ

- v0.1 は SQLite single-instance self-host 前提です。
- high concurrency、multi-instance、multi-tenant SaaS 用途は対象外です。
- PostgreSQL 対応や複数インスタンス運用は v0.2 以降の検討対象です。
- 永続化ディレクトリをバックアップ対象にします。
- 本番投入前に、環境変数、永続化ボリューム、バックアップ、HTTPS 終端、Cookie 設定を確認してください。
- `KOSU_SESSION_SECRET` は本番環境で必須です（32文字以上）。
- v0.1 公開前の確認項目は `docs/release-checklist.md` を参照してください。

## OpenSpec

現在の v0.1 スコープは `openspec/specs/` を参照してください。`openspec/changes/archive/` は過去の検討・実装履歴であり、現在の公開スコープと異なる記述を含む場合があります。詳しくは `openspec/README.md` を参照してください。

## OSS としての利用

`kosu` は MIT License で公開する想定です。小さな部門や受託・社内開発チームが、自分たちの環境で試しやすいことを優先しています。

Issue や Pull Request では、次の情報があると検討しやすくなります。

- チーム規模と利用シナリオ
- 月次計画、日次実績、レポートのどこに関する要望か
- 権限や公開範囲に関わる変更かどうか
- 再現手順、期待結果、実際の結果

## English Summary

`kosu` is a lightweight self-hosted OSS effort management web app for small teams. Version 0.1 focuses on daily work logs, project/task allocation, monthly capacity and plans, basic effort reports, CSV import/export, and SQLite single-instance deployment. Full financial reporting, resource planning, multi-instance operation, and multi-tenant SaaS use cases are out of scope for v0.1. The UI and documentation are Japanese-first, and the project is licensed under MIT.
