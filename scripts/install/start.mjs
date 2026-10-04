import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { findNpmCli, runNode } from "./common.mjs";

export function checkPort(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `ポート${port}を使用できません。既存アプリを停止するか、設定ファイルのPORTを変更してください。`,
        ),
      ),
    );
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      probe.close(resolve),
    );
  });
}

export async function waitForHealth(
  url,
  child,
  { timeoutMs = 30_000, fetchHealth = fetch } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error("サーバーが起動確認前に終了しました。");
    try {
      const response = await fetchHealth(url, {
        signal: AbortSignal.timeout(
          Math.min(1000, Math.max(1, deadline - Date.now())),
        ),
      });
      const body = await response.json();
      if (
        response.ok &&
        body.status === "ok" &&
        body.database === true &&
        child.exitCode === null &&
        child.signalCode === null
      )
        return;
    } catch {
      // The server may still be loading its build.
    }
    await delay(100);
  }
  throw new Error(
    "起動確認がタイムアウトしました。サーバーのログと設定を確認してください。",
  );
}

export async function startApplication(config) {
  const server = path.join(
    config.root,
    "node_modules/@react-router/serve/bin.cjs",
  );
  if (
    !existsSync(server) ||
    !existsSync(path.join(config.root, "build/server/index.js"))
  ) {
    throw new Error(
      "起動に必要なビルドがありません。先に install.bat または npm run setup:local を実行してください。",
    );
  }
  await checkPort(config.port);
  mkdirSync(config.dataDir, { recursive: true });
  await runNode(
    [findNpmCli(config.env), "run", "db:migrate"],
    config,
    "データベースの移行と整合性検査",
  );
  await checkPort(config.port);
  const child = spawn(process.execPath, [server, "./build/server/index.js"], {
    cwd: config.root,
    env: config.env,
    stdio: "inherit",
  });
  let spawnError;
  child.once("error", (error) => {
    spawnError = error;
  });
  const exited = new Promise((resolve) =>
    child.once("close", (code) => resolve(code)),
  );
  const stop = () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await waitForHealth(`http://127.0.0.1:${config.port}/health`, child);
    if (spawnError) throw new Error("サーバーを開始できませんでした。");
    console.log(`起動を確認しました: http://localhost:${config.port}`);
    console.log(
      "初回はブラウザでワークスペースと管理者を設定してください。この画面を開いたまま使い、停止するときは Ctrl+C を押してください。",
    );
    const code = await exited;
    if (code !== 0 && code !== null)
      throw new Error(
        `サーバーが終了しました（${code}）。ログを確認してください。`,
      );
  } finally {
    stop();
    const completed = await Promise.race([
      exited.then(() => true),
      delay(5000, undefined, { ref: false }).then(() => false),
    ]);
    if (!completed) {
      child.kill("SIGKILL");
      await exited;
    }
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
