# Dockerで起動する

DockerとDocker Composeが利用できるPCまたはサーバー向けの手順です。Dockerが禁止されている場合は [Windows直接起動](windows.md) を選べます。

## 1. ソースと設定を用意する

[安定版リリース](https://github.com/xkazuchika/kosu/releases/latest)のZIPを展開するか、リリースタグを指定してクローンし、`docker-compose.yml` のあるフォルダーで操作します。

`.env` を用意して、固有のシークレットを設定します。PowerShellでは、新規ファイルを次のように作れます（既存設定は上書きしません）。Node.jsは不要です。

```powershell
if (Test-Path .env) { throw '.envは既に存在します。既存設定を確認してください。' }
$secretBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $random.GetBytes($secretBytes) } finally { $random.Dispose() }
$sessionSecret = -join ($secretBytes | ForEach-Object { $_.ToString('x2') })
[System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), "KOSU_SESSION_SECRET=$sessionSecret`n")
```

macOS/Linuxでは次のコマンドで新規に作成できます。

```bash
(set -C; umask 077; printf 'KOSU_SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" > .env)
```

`.env.example` のサンプル値をそのまま使わないでください。シークレットを画面や共有ログへ出力する必要はありません。

## 2. ビルドして起動する

```bash
docker compose up --build -d
docker compose ps
```

現在のComposeはソースからビルドします。`healthy` になったら `http://localhost:3000` を開き、ワークスペースと管理者を設定します。standalone Composeを使う環境では `docker-compose` に読み替えます。

```bash
docker compose logs --tail 50 kosu
```

起動できない場合はログの直前のエラーを確認してください。社内サーバーなどから他の端末へ公開する場合は、HTTPS終端とリバースプロキシを用意し、初期設定を管理者が完了してから共有します。

## 3. 保存先を確認する

SQLiteはコンテナ内の `/data` に、Composeのnamed volumeで保存されます。実際のvolume名はプロジェクト名によって異なります。

```bash
docker compose ps -q kosu
docker inspect <上で表示されたコンテナID> --format '{{json .Mounts}}'
```

`Destination` が `/data` のマウントの `Name` が実際のvolume名です。`kosu_kosu-data` という名前を固定で仮定しないでください。

停止・再開は次のとおりです。

```bash
docker compose stop
docker compose start
```

設定とvolumeを維持して再起動すればデータは残ります。`docker compose down -v` はデータを削除するため、日常の停止には使いません。更新・バックアップ・復元は [運用手順](operations.md) を参照してください。
