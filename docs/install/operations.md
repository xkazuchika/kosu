# 停止・更新・バックアップ・復元

## Windows直接起動

### 停止と再起動

`start.bat` のウィンドウで `Ctrl+C` を押します。再起動は `start.bat` を実行します。`npm stop` は用意されていません。停止はそのアプリを起動したコンソールで行い、ポートを使っている他のプロセスを終了しないでください。

### 一貫性バックアップ

アプリのフォルダーで実行します。設定ファイルとデータ保存先は起動時と同じものを使います。出力先を省略すると `backups/` に日時付きの新規フォルダーを作ります。

```bat
npm run backup:local
```

別の設定と出力先を指定する場合:

```bat
npm run backup:local -- --config "C:\kosu-settings\.env" --output "C:\kosu-backups\pre-update-1"
```

出力先はまだ存在しないフォルダーを指定します。既存バックアップは上書きしません。出力は `kosu.sqlite` と `manifest.json` です。manifestにアプリ版・日時・チェックサム・整合性結果を記録します。シークレットは含まれません。

この補助コマンドはSQLiteの一貫性バックアップを利用するため、稼働中でも使えます。更新前は入力を止め、アプリを停止してから実行してください。`.env` は秘密情報として別途保管し、ソースフォルダーやPCの障害に備えて、バックアップを別の保存先にも保管します。

### 更新

1. 入力を止め、起動コンソールからアプリを停止する。
2. 上記コマンドでバックアップを作り、「バックアップを検証しました」を確認する。
3. 新しい安定版を別の新規フォルダーへ取得する。旧フォルダーとデータは保持する。
4. 同じ設定ファイルとデータ保存先を新しい版へ引き継ぐ。生成済み設定は絶対パスで保存先を記録する。手動設定が相対パスなら、旧版と同じ保存先の絶対パスへ変更する。
5. 新しい版の `install.bat --config "C:\kosu-settings\.env"`、次に `start.bat --config "C:\kosu-settings\.env"` を実行する。設定を旧フォルダーに置いたままなら、そのファイルの絶対パスを指定する。
6. ログインと保存済みデータを確認する。

### 復元

アプリを停止し、**バックアップのmanifestに記録された版のアプリ**で実行します。元のデータ保存先とは別の、まだ存在しないフォルダーを指定してください。

```bat
npm run restore:local -- --input "C:\kosu-backups\pre-update-1" --target-data-dir "C:\kosu-data-restored-1"
```

コマンドはチェックサムとDB整合性を確認して新しい保存先へ復元します。既存データは削除せず、版が異なるバックアップやWAL/SHMが混在したバックアップは拒否します。

「復元データを検証しました」を確認してから、使用する `.env` の `KOSU_DATA_DIR` を新しい保存先へ変更し、同じ設定ファイルを指定して起動します。ログインとデータを確認するまでは旧データを保持します。復元で失われるバックアップ後の入力期間を利用者へ知らせてください。

## Docker

### 停止と再起動

```bash
docker compose stop
docker compose start
```

データを保持する停止には `down -v` を使いません。実際のvolume名は [Docker導入ガイド](docker.md)のマウント確認で取得します。

### バックアップ

稼働中のコンテナで、同じSQLiteバックアップ補助処理を実行できます。コンテナ内の環境変数を使って操作用設定を用意し、既存設定・データを維持します。

```bash
docker compose exec kosu node scripts/install/cli.mjs config --config /tmp/kosu-operations.env
docker compose exec kosu node scripts/install/cli.mjs backup --config /tmp/kosu-operations.env --output /data/backups/pre-update-1
docker compose ps -q kosu
docker cp <コンテナID>:/data/backups/pre-update-1 ./pre-update-1
```

`pre-update-1` は新しいバックアップ名を選んでください。最後のコマンドで、manifestを含むフォルダーをホストへ取り出します。ホストのバックアップ先も既存のものと混ぜないでください。操作用設定はコンテナの再作成でなくなるため、そのときは `config` を再実行します。

更新前は入力を止めてバックアップします。停止中にバックアップする場合は、同じvolumeを使う `docker compose run --rm --no-deps kosu` の一時コンテナで、`config` と `backup` を同じコンテナ内で実行できます。

### 更新

入力停止、一貫性バックアップとホストへの保管、`docker compose stop`、新しい安定版の取得、設定と同じComposeプロジェクト名・volumeの引き継ぎ、`docker compose up --build -d`、ログイン・データ確認の順で進めます。

新しいフォルダーでComposeを実行するとプロジェクト名が変わることがあります。元のコンテナの `com.docker.compose.project` ラベルを確認し、同じ `docker compose -p <元のプロジェクト名>` と設定・overrideファイルを使ってください。必要なoverrideがある場合も引き継ぎます。

### 復元

アプリを停止し、バックアップと同じ版のソース・イメージを使います。既存のvolumeを保持し、その中の新しいサブフォルダーへ復元します。

バックアップフォルダーはDockerから参照できるホストの場所に置いてください。Docker DesktopやColimaのファイル共有対象外の場所では、コンテナ内の `/backup` が空になることがあります。`manifest.json` が見つからない場合は、ホストのフォルダーと共有設定を確認します。

```bash
docker compose stop
docker compose run --rm --no-deps -v "<バックアップフォルダーの絶対パス>:/backup:ro" kosu sh -c "node scripts/install/cli.mjs config --config /tmp/kosu-restore.env && node scripts/install/cli.mjs restore --config /tmp/kosu-restore.env --input /backup --target-data-dir /data/restored-1"
```

検証に成功したら `compose.restore.yml` を作り、使用する保存先を切り替えます。

```yaml
services:
  kosu:
    environment:
      KOSU_DATA_DIR: /data/restored-1
```

```bash
docker compose -f docker-compose.yml -f compose.restore.yml up -d
```

以後は同じファイル指定を使います。既存のComposeプロジェクト名や追加設定がある場合は、その指定も維持します。初期設定画面が出た場合は新規セットアップで進めず、保存先を確認してください。ログインとデータを確認するまで、旧DBと新しい復元先の両方を保持します。

## SQLiteとロールバック

稼働中の `kosu.sqlite` を普通のファイルコピーでバックアップしないでください。WALモードでは `kosu.sqlite-wal` と `kosu.sqlite-shm` も稼働中のDBの一部です。上記の一貫性バックアップはそれらを取り込んだ単一DBを作成します。

停止後のデータディレクトリ全体を保管する方法も使えます。その場合はWAL/SHMを含めて一体として扱い、別のDBの古いWAL/SHMを混ぜないでください。

スキーマ移行後は旧アプリだけを戻さず、移行前のバックアップと対応する旧アプリを組み合わせて復元します。移行後の入力を別途保存し、復元によって戻る期間を利用者へ伝えてください。
