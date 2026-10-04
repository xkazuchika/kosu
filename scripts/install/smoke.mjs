import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { parseEnv } from "node:util";
import { projectRoot } from "./common.mjs";

const base = mkdtempSync(path.join(os.tmpdir(), "kosu-install-smoke-"));
const candidate = path.join(base, "candidate");
const diagnostics = path.join(projectRoot, "test-results/install-smoke");
mkdirSync(candidate);
mkdirSync(diagnostics, { recursive: true });
const sourceItems = [
  "app",
  "drizzle",
  "public",
  "scripts",
  "docs/install",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "react-router.config.ts",
  "tsconfig.json",
  "drizzle.config.ts",
  "eslint.config.js",
  "install.bat",
  "start.bat",
  "README.md",
  ".env.example",
];
for (const item of sourceItems)
  if (existsSync(path.join(projectRoot, item)))
    cpSync(path.join(projectRoot, item), path.join(candidate, item), {
      recursive: true,
    });

function run(file, args, cwd = candidate) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, `${file} failed: ${result.stderr}`);
  return result.stdout.trim();
}
function publicEntry(root, entry, args = [], extraEnv = {}) {
  const env = { ...process.env, KOSU_NO_PAUSE: "1" };
  for (const key of Object.keys(env))
    if (key.startsWith("KOSU_") && key !== "KOSU_NO_PAUSE") delete env[key];
  Object.assign(env, extraEnv);
  if (process.platform === "win32") {
    // Only generated paths and fixed options are used here; avoid shell interpolation of user input.
    const quote = (value) => `"${value.replaceAll('"', '""')}"`;
    return spawn(
      process.env.ComSpec ?? "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `"${[path.join(root, `${entry}.bat`), ...args].map(quote).join(" ")}"`,
      ],
      {
        cwd: root,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsVerbatimArguments: true,
      },
    );
  }
  return spawn(
    process.execPath,
    [
      path.join(root, "scripts/install/cli.mjs"),
      entry === "install" ? "prepare" : "start",
      ...args,
    ],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
}
function track(child) {
  const capture = { child, output: "", closed: false, code: null };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    capture.output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    capture.output += chunk.toString();
  });
  capture.done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      capture.closed = true;
      capture.code = code;
      resolve(code);
    });
  });
  return capture;
}
async function finish(capture, expected = 0) {
  const code = await capture.done;
  assert.equal(code, expected, capture.output);
  return capture.output;
}
async function stop(capture) {
  if (capture.closed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(capture.child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else capture.child.kill("SIGTERM");
  await Promise.race([
    capture.done,
    delay(10_000, undefined, { ref: false }).then(() => {
      throw new Error("Stop timed out");
    }),
  ]);
}
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function launch(root) {
  const capture = track(publicEntry(root, "start"));
  const deadline = Date.now() + 45_000;
  while (
    !capture.output.includes("起動を確認しました:") &&
    Date.now() < deadline &&
    !capture.closed
  )
    await delay(100);
  if (!capture.output.includes("起動を確認しました:")) {
    await stop(capture);
    throw new Error(capture.output || "No readiness report");
  }
  return capture;
}

let active;
let browser;
let allOutput = "";
try {
  // Candidate acquisition rehearsal: no public release is created or changed.
  run("git", ["init", "--quiet"]);
  run("git", ["add", "."]);
  run("git", [
    "-c",
    "user.name=Installation smoke",
    "-c",
    "user.email=smoke@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "candidate fixture",
  ]);
  const version = JSON.parse(
    readFileSync(path.join(candidate, "package.json"), "utf8"),
  ).version;
  run("git", ["tag", `v${version}`]);
  const clone = path.join(base, "Git取得 日本語 folder");
  run("git", [
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--branch",
    `v${version}`,
    pathToFileURL(candidate).href,
    clone,
  ]);
  assert.equal(
    JSON.parse(readFileSync(path.join(clone, "package.json"), "utf8")).version,
    version,
  );
  assert.ok(existsSync(path.join(clone, "docs/install/agent.md")));
  const archive = path.join(base, "candidate.zip");
  run("git", ["archive", "--format=zip", `--output=${archive}`, `v${version}`]);
  const root = path.join(base, "ZIP取得 日本語 folder");
  if (process.platform === "win32") {
    const script = `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${root.replaceAll("'", "''")}'`;
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ]);
  } else {
    mkdirSync(root);
    run("unzip", ["-q", archive, "-d", root]);
  }
  assert.ok(existsSync(path.join(root, "install.bat")));
  allOutput += await finish(
    track(publicEntry(root, "install", [], { PORT: String(await freePort()) })),
  );
  const configPath = path.join(root, ".env");
  const configuration = readFileSync(configPath, "utf8");
  const env = parseEnv(configuration);
  const url = `http://localhost:${env.PORT}`;
  active = await launch(root);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${url}/setup`);
  await expect(page).toHaveTitle("初期セットアップ | kosu");
  await page.getByLabel("ワークスペース名").fill("導入確認ワークスペース");
  await page.getByLabel("管理者氏名").fill("導入管理者");
  await page
    .getByLabel("管理者メールアドレス")
    .fill("install-smoke@example.com");
  await page.getByLabel("管理者パスワード").fill("install-smoke-password");
  await page.getByRole("button", { name: "セットアップを完了する" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  async function login() {
    await page.getByLabel("メールアドレス").fill("install-smoke@example.com");
    await page.getByLabel("パスワード").fill("install-smoke-password");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await login();
  await page.screenshot({ path: path.join(diagnostics, "local-startup.png") });
  const occupied = await finish(track(publicEntry(root, "start")), 1);
  assert.ok(occupied.includes("使用できません"));
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  allOutput += active.output;
  await stop(active);
  active = undefined;

  // Re-preparing must retain configuration and existing administrator data.
  allOutput += await finish(track(publicEntry(root, "install")));
  assert.equal(readFileSync(configPath, "utf8"), configuration);
  active = await launch(root);
  await page.context().clearCookies();
  await page.goto(`${url}/login`);
  await login();
  await page.screenshot({ path: path.join(diagnostics, "local-restart.png") });
  allOutput += active.output;
  await stop(active);
  active = undefined;

  const cli = path.join(root, "scripts/install/cli.mjs");
  const backup = path.join(base, "backup");
  const restored = path.join(base, "restored");
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv))
    if (key.startsWith("KOSU_")) delete cleanEnv[key];
  for (const args of [
    ["backup", "--output", backup],
    ["restore", "--input", backup, "--target-data-dir", restored],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      env: cleanEnv,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    allOutput += result.stdout;
  }
  const restoreConfig = path.join(root, ".restore.env");
  writeFileSync(
    restoreConfig,
    configuration.replace(
      /^KOSU_DATA_DIR=.*$/m,
      `KOSU_DATA_DIR=${JSON.stringify(restored.replaceAll("\\", "/"))}`,
    ),
  );
  active = track(publicEntry(root, "start", ["--config", restoreConfig]));
  const restoreDeadline = Date.now() + 45_000;
  while (
    !active.output.includes("起動を確認しました:") &&
    !active.closed &&
    Date.now() < restoreDeadline
  )
    await delay(100);
  assert.ok(active.output.includes("起動を確認しました:"), active.output);
  await page.context().clearCookies();
  await page.goto(`${url}/login`);
  await login();
  await expect(
    page.getByRole("heading", { name: "ダッシュボード", exact: true }),
  ).toBeVisible();
  allOutput += active.output;
  await stop(active);
  active = undefined;
  assert.deepEqual(errors, []);

  writeFileSync(
    configPath,
    configuration.replace(
      /^KOSU_SESSION_SECRET=.*$/m,
      "KOSU_SESSION_SECRET=short",
    ),
  );
  const rejected = await finish(track(publicEntry(root, "install")), 1);
  assert.ok(rejected.includes("KOSU_SESSION_SECRET"));
  assert.equal(
    readFileSync(configPath, "utf8"),
    configuration.replace(
      /^KOSU_SESSION_SECRET=.*$/m,
      "KOSU_SESSION_SECRET=short",
    ),
  );
  writeFileSync(configPath, configuration);
  if (process.platform === "win32") {
    const missing = await finish(
      track(
        publicEntry(root, "install", [], {
          Path: path.join(process.env.SystemRoot, "System32"),
          PATH: path.join(process.env.SystemRoot, "System32"),
        }),
      ),
      1,
    );
    assert.ok(missing.includes("Node.js 22.22"));
  }
  assert.ok(!allOutput.includes(env.KOSU_SESSION_SECRET));
  writeFileSync(
    path.join(diagnostics, "result.json"),
    JSON.stringify(
      {
        platform: process.platform,
        architecture: process.arch,
        node: process.versions.node,
        candidateRevision:
          process.env.GITHUB_SHA ??
          run("git", ["rev-parse", "HEAD"], projectRoot),
        acquisition: [
          "local candidate Git tag clone",
          "local candidate ZIP extraction",
        ],
        checks: [
          "fresh preparation",
          "setup",
          "logout/login",
          "occupied port rejection",
          "repeat preparation",
          "restart/login",
          "consistent backup",
          "new-directory restore/login",
          "invalid config rejection",
          ...(process.platform === "win32"
            ? ["missing Node.js batch entry"]
            : []),
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Installation smoke passed (${process.platform}, Node.js ${process.versions.node}). Diagnostics: ${diagnostics}`,
  );
  await browser.close();
  browser = undefined;
  rmSync(base, { recursive: true, force: true });
} catch (error) {
  if (active) await stop(active);
  if (browser) await browser.close();
  // Do not save .env or the temporary database as diagnostics.
  writeFileSync(path.join(diagnostics, "failure.txt"), `${error.message}\n`);
  console.error(`Installation smoke failed. Diagnostics: ${diagnostics}`);
  console.error(error.message);
  process.exitCode = 1;
}
