# 実装と検証記録

## 候補版

- 実装コミット: `fd467f89764b33cd4dbef138e4d7541d314b5f5e`
- ブランチ: `codex/windows-agent-installation`
- [ドラフトPR #1](https://github.com/xkazuchika/kosu/pull/1)
- [CI run 37240545576](https://github.com/xkazuchika/kosu/actions/runs/37240545576): Quality gate、Browser smoke、Windows installation smokeがすべて成功。
- PRのテスト用mergeコミット: `0baaf6daca650228108ebc8cbe7187e7a4be5876`。Windows診断の `candidateRevision` はGitHub ActionsのこのSHAを記録する。
- アプリ版は `0.10.0` のまま。導入機能を含む安定版の公開は今回行っていない。

## 検証結果

| 対象              | 環境・コマンド                                                                                                                    | 結果                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 全体の回帰        | ローカル `npm test`                                                                                                               | 66ファイル、410件成功。導入設定・readiness・WALバックアップと復元の25件を含む                                                    |
| 品質              | ローカルおよびUbuntu CIの `npm run typecheck`、`npm run lint`、`npm run build`                                                    | 成功                                                                                                                             |
| 既存ブラウザE2E   | ローカルおよびUbuntu CIの `npm run test:e2e`                                                                                      | 初期設定、ログイン、月次提出、主要レポートのsmoke成功                                                                            |
| 本番依存監査      | CIの `npm audit --omit=dev`                                                                                                       | 指摘0件。morganをロックファイル内で1.12.1へ更新                                                                                  |
| 直接導入          | macOS、Node.js 22.23.3で `node scripts/install/smoke.mjs`                                                                         | ZIPの隔離フォルダーから初回準備・初期設定・ログイン・設定を保持した再準備・再起動・復元後ログイン成功                            |
| Windows公開バッチ | Windows runner、x64、Node.js 22.22.0、`npm run test:install`                                                                      | 日本語・スペースのあるパスでinstall.bat／start.bat成功。Node.js不在・不正設定は終了コード1。ポート競合を拒否し既存サーバーを保持 |
| 取得経路          | macOSとWindowsの隔離候補版でGitタグclone／ZIP展開                                                                                 | 同一版と導入用ファイルの存在を確認。ZIP経路は準備から復元まで実行                                                                |
| Docker導入        | Colima上の隔離Composeプロジェクト `kosu-install-onboarding`                                                                       | ソースビルド、healthy、初期設定、ログアウト／ログイン、stop／start後の再ログイン成功                                             |
| Docker運用        | ガイドのconfig／backup、docker cp、runによるrestore、新しい保存先への切り替え                                                     | manifestとDBの取り出し、別ディレクトリ `/data/restored-1` への復元、再ログイン成功。旧DBを保持                                   |
| 導線・仕様        | READMEと導入文書のローカルリンク検査、`openspec validate simplify-installation-and-agent-onboarding --strict`、`git diff --check` | 成功                                                                                                                             |

## 診断と画面確認

Windows CIは `windows-install-diagnostics` にresult.jsonと初回・再起動の画面を保存した。確認項目は初回準備、setup、logout/login、occupied port rejection、repeat preparation、restart/login、consistent backup、new-directory restore/login、invalid config rejection、missing Node.js batch entry。設定ファイル、シークレット、SQLiteデータは診断に含めない。

Windowsの再起動後とDockerの復元後のダッシュボードを目視確認した。管理者としてログインでき、主なカードとナビゲーションが表示され、ページの実行時例外はなかった。ブラウザ連携の初期化が `Importing module "node:process" is not allowed in node_repl` で失敗したため、隔離されたPlaywright Chromiumで確認した。

Dockerの永続volume名はinspectで `kosu-install-onboarding_kosu-data`、コンテナ内の保存先は `/data` と確認した。最初の復元ではColimaの共有対象外だった `/private/tmp` のbind mountが空になり、manifest不在で安全に中断した。共有対象のリポジトリ内の無視対象フォルダーへ検証用コピーを置いて再実行すると成功したため、運用ガイドに共有対象の確認を追記した。

## 検証範囲と後続の確認

- 公開URLからの取得は、安定版タグに固定する指示とGit／ZIPの候補版リハーサルを確認した。現在の公開安定版へ未公開機能を含めたと扱わない。機能を含む安定版公開後の実URL検証はrelease-checklistのゲートとする。
- 各エージェント製品の自律操作・常駐能力、組織ごとのインストール権限、オフライン環境は今回の動作保証に含めない。プロンプトは不足条件と最後の手動操作を引き継ぐよう指定する。
- Windowsの停止smokeは検証で生成したプロセスツリーだけを終了する。実際のコンソールのCtrl+C操作、Windowsサービス登録、ARM環境は未検証。日常停止は公開ガイドのCtrl+Cで行う。
- localhostの認証はPlaywright Chromiumで確認した。Firefox、Safari、社内IPのHTTP共有は未検証。チーム共有はHTTPS運用へ案内する。
- Node.js 22系を導入検証対象とする。別のNode.js／npmではネイティブ部品の取得やインストールスクリプトの実行許可が必要になり、利用不可の場合は処理を中断して条件を案内する。
- 導入専用スキルの登録、Node.js同梱ZIP、コンテナイメージ配布、安定版リリースは後続の対象。
