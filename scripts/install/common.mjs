import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as util from "node:util";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const sampleSecret = "change-me-to-a-random-32-character-secret";

export function checkRuntime(version = process.versions.node) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (
    !match ||
    Number(match[1]) < 22 ||
    (Number(match[1]) === 22 && Number(match[2]) < 22)
  ) {
    throw new Error(
      "Node.js 22.22以上が必要です。Node.js 22系の対応版を導入して、もう一度実行してください。",
    );
  }
}

function checkWritableDirectory(directory) {
  let parent = directory;
  while (!existsSync(parent)) {
    const next = path.dirname(parent);
    if (next === parent) throw new Error("データ保存先を確認できません。");
    parent = next;
  }
  if (!statSync(parent).isDirectory())
    throw new Error("データ保存先にはフォルダーを指定してください。");
  try {
    accessSync(parent, constants.W_OK);
  } catch {
    throw new Error(
      "データ保存先へ書き込めません。書き込み可能なフォルダーを指定してください。",
    );
  }
}

export function loadConfiguration({
  root = projectRoot,
  configFile = ".env",
  env = process.env,
  create = false,
} = {}) {
  checkRuntime();
  const configPath = path.resolve(root, configFile);
  const isNew = !existsSync(configPath);
  if (isNew && !create)
    throw new Error(
      "設定ファイルがありません。先に install.bat または npm run setup:local を実行してください。",
    );
  const fileEnv = isNew
    ? {
        KOSU_SESSION_SECRET: randomBytes(32).toString("hex"),
        KOSU_DATA_DIR: "./data",
        HOST: "127.0.0.1",
        PORT: "3000",
      }
    : util.parseEnv(readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
  const effective = {
    ...fileEnv,
    ...Object.fromEntries(
      Object.entries(env).filter(([, value]) => value !== undefined),
    ),
  };
  // npm lifecycle scripts must use the same Node.js that launched this installer.
  // Windows environment keys are case-insensitive; pass a single PATH key.
  const pathKey = Object.keys(effective).find(
    (key) => key.toUpperCase() === "PATH",
  );
  const inheritedPath = pathKey ? effective[pathKey] : "";
  for (const key of Object.keys(effective))
    if (key.toUpperCase() === "PATH") delete effective[key];
  effective.PATH = `${path.dirname(process.execPath)}${path.delimiter}${inheritedPath}`;
  const secret = effective.KOSU_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === sampleSecret) {
    throw new Error(
      "KOSU_SESSION_SECRETに固有の32文字以上の値を設定してください。サンプル値は使用できません。既存設定は変更していません。",
    );
  }
  const configuredDir = effective.KOSU_DATA_DIR;
  if (configuredDir !== undefined && !configuredDir.trim())
    throw new Error("KOSU_DATA_DIRにデータ保存先を指定してください。");
  const dataDir = path.resolve(root, configuredDir?.trim() ?? "data");
  checkWritableDirectory(dataDir);
  const port = Number(effective.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("PORTには1024〜65535の整数を指定してください。");
  const host = effective.HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1")
    throw new Error(
      "直接起動はHOST=127.0.0.1で利用してください。チーム共有はHTTPS付きの運用手順を参照してください。",
    );
  if (isNew) {
    // Keep supplied values too: a later double-click must use the same configuration.
    const content = [
      "# kosu local installation",
      "NODE_ENV=production",
      `KOSU_SESSION_SECRET=${secret}`,
      `KOSU_DATA_DIR=${JSON.stringify(dataDir.replaceAll("\\", "/"))}`,
      `HOST=${host}`,
      `PORT=${port}`,
      "",
    ].join("\n");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(configPath, content, { flag: "wx", mode: 0o600 });
  }
  return {
    root,
    configPath,
    dataDir,
    databasePath: path.join(dataDir, "kosu.sqlite"),
    port,
    env: {
      ...effective,
      KOSU_SESSION_SECRET: secret,
      KOSU_DATA_DIR: dataDir,
      HOST: host,
      PORT: String(port),
      NODE_ENV: "production",
    },
  };
}

export function findNpmCli(env = process.env) {
  const candidates = [
    env.npm_execpath,
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
    path.resolve(
      path.dirname(process.execPath),
      "../lib/node_modules/npm/bin/npm-cli.js",
    ),
  ];
  const located = spawnSync(
    process.platform === "win32" ? "where.exe" : "which",
    [process.platform === "win32" ? "npm.cmd" : "npm"],
    { encoding: "utf8" },
  );
  for (const entry of located.stdout?.trim().split(/\r?\n/) ?? []) {
    if (!entry || !existsSync(entry)) continue;
    const resolved = realpathSync(entry);
    candidates.push(
      resolved,
      path.join(path.dirname(resolved), "node_modules/npm/bin/npm-cli.js"),
    );
  }
  const cli = candidates.find(
    (candidate) =>
      candidate && candidate.endsWith("npm-cli.js") && existsSync(candidate),
  );
  if (!cli)
    throw new Error(
      "npmが見つかりません。npmを含むNode.jsの配布版を導入してください。",
    );
  return cli;
}

export function runNode(args, config, label) {
  console.log(`${label}…`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: config.root,
      env: config.env,
      stdio: "inherit",
    });
    child.once("error", () =>
      reject(new Error(`${label}を開始できませんでした。`)),
    );
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${label}に失敗しました（${signal ?? code}）。直前のエラーを確認してください。`,
            ),
          ),
    );
  });
}

export async function prepare(config) {
  const npmCli = findNpmCli(config.env);
  await runNode([npmCli, "ci", "--include=dev"], config, "依存関係の導入");
  try {
    const Database = createRequire(path.join(config.root, "package.json"))(
      "better-sqlite3",
    );
    const probe = new Database(":memory:");
    probe.close();
  } catch {
    throw new Error(
      "SQLiteのネイティブ部品を利用できません。Node.js・OS・CPUの対応、ダウンロードの制限、npmのインストールスクリプトの実行許可を確認してください。制限は自動変更しません。",
    );
  }
  await runNode([npmCli, "run", "build"], config, "アプリのビルド");
  mkdirSync(config.dataDir, { recursive: true });
  await runNode(
    [npmCli, "run", "db:migrate"],
    config,
    "データベースの準備と整合性検査",
  );
  console.log(
    "導入の準備が完了しました。start.bat または npm run start:local で起動してください。",
  );
}

export function reportConfiguration(config) {
  console.log(`設定ファイル: ${config.configPath}`);
  console.log(`データ保存先: ${config.dataDir}`);
}
