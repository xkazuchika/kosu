# エージェントに導入を任せる

ファイル操作、ネットワークからの取得、コマンド実行ができるエージェント向けです。専用スキルの登録は不要です。次のプロンプトをコピーして渡してください。

このガイドと起動ファイルが含まれる安定版で利用できます。公開済みの安定版にまだ含まれていない場合は、エージェントがその版の手動手順を案内します。未公開のmainへ勝手に切り替えることはありません。

## まだ取得していない場合：URLから任せる

```text
https://github.com/xkazuchika/kosu を、この環境にインストールして起動してください。

まずOS、CPU、Node.js、Docker、Gitの有無と利用制限を確認してください。
利用可能な安定版リリースを特定し、選んだバージョンを示してください。
Gitが使えればそのタグをクローンし、なければ同じタグのソースZIPを取得・展開してください。
取得先は新しいフォルダーにし、既存フォルダーやデータを上書きしないでください。

取得した版の docs/install/agent.md と導入用ファイルを確認し、その手順に従ってください。
必要なファイルがない版では、そのことを報告し、その版で可能な手動手順を案内してください。
無断で開発中のmainへ切り替えないでください。

Dockerを使えないWindows x64環境では、Node.jsによる直接起動を選んでください。
前提ソフトが不足する場合は、環境で許可される方法で導入を進めてください。
権限や制限で実行できない操作があれば、残りの手動操作を具体的に教えてください。

設定の準備、インストール、起動確認まで進めてください。
シークレットと既存設定・データを保持し、秘密情報は出力しないでください。
初期セットアップの管理者情報は私がブラウザで入力します。
最後に、選んだ版・導入方法・確認済みアクセスURL・データ保存先・停止と再起動の方法を教えてください。
プロセスを維持できない環境では、最後の起動操作を引き継いでください。未確認の起動を成功と報告しないでください。
```

## 取得済みの場合：このフォルダーから任せる

```text
このフォルダーのkosuをインストールして起動してください。

現在のバージョンと docs/install/agent.md、導入用ファイルを確認してください。
再クローン、別フォルダーへの置き換え、無断のバージョン変更は不要です。
導入ファイルがない版では、その版のREADMEを確認して可能な手動手順を案内してください。

OS、CPU、Node.js、Dockerと利用制限を確認し、導入ガイドに従ってください。
Dockerを使えないWindows x64環境ではNode.jsによる直接起動を選んでください。
前提ソフトが不足する場合は、環境で許可される方法で導入してください。
実行できない操作があれば、残りの手動操作を具体的に教えてください。

設定・インストール・起動確認には、手動ガイドと同じ導入処理を使ってください。
既存設定、シークレット、データを保持し、秘密情報は出力しないでください。
初期セットアップの管理者情報は私がブラウザで入力します。
最後に、選んだ版・導入方法・確認済みアクセスURL・データ保存先・停止と再起動の方法を教えてください。
プロセスを維持できない環境では、最後の起動操作を引き継いでください。未確認の起動を成功と報告しないでください。
```

## エージェントが実行する手順

### 1. 版と導入先を確認

公開URLから開始する場合は [安定版リリース](https://github.com/xkazuchika/kosu/releases/latest)からリリースタグを取得します。`draft` と `prerelease` は選びません。取得後は `package.json` の版とタグの対応を確認します。

Gitがある場合の取得例です。`<リリースタグ>` は取得した `vMAJOR.MINOR.PATCH`、`<新しいフォルダー>` はまだ存在しない場所に置き換えます。

```bash
git clone --depth 1 --branch <リリースタグ> https://github.com/xkazuchika/kosu.git <新しいフォルダー>
```

WindowsでGitを使わない場合、PowerShellの標準コマンドで安定版のZIPを取得できます。既存フォルダーは使いません。

```powershell
$release = Invoke-RestMethod https://api.github.com/repos/xkazuchika/kosu/releases/latest
if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v\d+\.\d+\.\d+$') { throw '安定版を確認できません。' }
$destination = Join-Path $env:USERPROFILE ('kosu-' + $release.tag_name)
if (Test-Path $destination) { throw '取得先が既に存在します。別の新規フォルダーを選んでください。' }
$archive = Join-Path $env:TEMP ('kosu-' + [Guid]::NewGuid().ToString() + '.zip')
Invoke-WebRequest $release.zipball_url -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $destination
Get-ChildItem $destination -Directory
```

ZIPのトップフォルダー名はGitHubが決めます。展開結果から `package.json` のあるフォルダーを特定します。取得が失敗した場合はそこで止まり、未取得の状態で導入を続けません。

取得済みの場合は現在のフォルダーを使います。どちらも `docs/install/agent.md`、Windows直接起動なら `install.bat` と `start.bat`、Dockerなら `docker-compose.yml` の存在を確認します。必要なファイルがない版では、その版のREADMEへ案内してください。

### 2. 共通の導入処理を使う

Windows直接起動ではNode.js 22.22以上を確認し、[Windowsの手動ガイド](windows.md)の準備・起動を使います。エージェントが待機不要でバッチを実行する場合は、そのプロセスだけ `KOSU_NO_PAUSE=1` を指定できます。

```bat
set KOSU_NO_PAUSE=1
install.bat
start.bat
```

共通処理を直接呼ぶ場合は `npm run setup:local`、`npm run start:local` です。Dockerでは [Dockerの手動ガイド](docker.md)の設定・Compose起動を使います。別の設定生成や起動方式を独自に作らないでください。

既存の `.env` が不正なら修正箇所を示します。既存のシークレットを勝手に再生成せず、初期化やデモ投入を導入の代わりに使いません。管理者アカウントは利用者がブラウザで初期設定します。

### 3. 起動と引き継ぎを確認

- 起動したプロセスの稼働、`/health` の成功、初期設定またはログイン画面への到達を確認します。
- localhostのURL、設定ファイルの場所、データ保存先を伝えます。設定ファイルの中身は貼り付けません。
- Windowsでは起動コンソールを維持し、Ctrl+Cによる停止と `start.bat` による再起動を案内します。
- 実行ツールの終了で子プロセスが終了する場合は、持続するコンソールを使うか、利用者へ最後の起動操作を渡します。
- Dockerの場合は `docker compose ps` とコンテナの状態を確認し、`stop` / `start` と実際のvolume名を案内します。
- 成功した操作、残った手動操作、未確認の条件を区別して報告します。

更新とバックアップは [運用手順](operations.md) を使います。
