# Proposal

## Why

Dockerを利用できないWindowsの社内PCでも、短い手順でkosuを導入・起動したい。公開リポジトリのURLをエージェントへ渡すだけで取得から起動確認まで任せられる入口と、自分で進められる手動手順を用意する。

## What Changes

- READMEに「エージェントに任せる」「自分で導入する」の入口を設け、WindowsでのNode.js直接起動と既存Docker Compose導入へ案内する。
- Windows向けの初回設定・起動用バッチファイルと共通のNode.jsスクリプトを追加し、前提条件の確認、設定ファイルの生成・読み込み、依存関係の導入、ビルド、マイグレーション、起動確認を整える。
- 設定済みシークレットと保存データを維持し、初回導入、通常起動、更新を別操作として説明する。
- 公開URLから開始するプロンプトと取得済みフォルダーから開始するプロンプト、およびエージェント向け導入手順書を提供する。GitクローンとZIP取得を案内し、安定版のバージョンを特定して共通の導入処理を使う。
- 起動完了をヘルスチェックと初期設定／ログイン画面で確認し、URL、停止・再起動方法、データ保存場所を利用者へ伝える。
- WindowsとDockerそれぞれの停止、更新、バックアップ、復元手順を整理し、Windows環境の起動・永続化をCIで検証する。

## Capabilities

### New Capabilities

なし。導入と運用の契約は既存の `self-hosting` に集約する。

### Modified Capabilities

- `self-hosting`: WindowsでのDocker不要の導入、繰り返し実行できる設定、エージェントからの取得・導入、導入経路の選択と運用手順の要件を追加する。

## Impact

- ドキュメント: `README.md`、新規 `docs/install/`、`.env.example`、必要に応じて `docs/release-checklist.md`。
- 導入処理: ルートのWindows用バッチファイル、新規 `scripts/install/`、`package.json` の補助コマンド。Node.js 22.22以上、既存のSQLite、ビルド・マイグレーション処理を利用する。
- Docker: 現在のソースビルドとnamed volumeを使う導入手順を、共通の設定・運用説明へ接続する。
- 検証: 導入処理の回帰テスト、隔離データでの起動・再起動確認、`.github/workflows/ci.yml` のWindows検証。
- 第一段階の対象はWindows x64とNode.js 22系の対応バージョンを基本とする。Windows ARM、Node.js同梱ZIP、専用エージェントスキル、ビルド済みDockerイメージの公開、HTTPSの自動構築、Windowsサービスへの登録は後続の検討対象とする。
- 導入プロンプトの公開は、この機能を含む安定版リリースと対応させる。リリース・外部環境への導入は実装とは別の操作として扱う。
