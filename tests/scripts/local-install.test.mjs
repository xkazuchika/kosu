// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import Database from "better-sqlite3";
import {
  createDatabaseConnection,
  runMigrations,
} from "../../app/db/client.ts";
import {
  checkRuntime,
  loadConfiguration,
  projectRoot,
  reportConfiguration,
  sampleSecret,
} from "../../scripts/install/common.mjs";
import { checkPort, waitForHealth } from "../../scripts/install/start.mjs";
import {
  backupDatabase,
  restoreDatabase,
} from "../../scripts/install/backup.mjs";

const directories = [];
function temporaryRoot() {
  const base = mkdtempSync(path.join(os.tmpdir(), "kosu-install-test-"));
  directories.push(base);
  const root = path.join(base, "導入 テスト");
  mkdirSync(root);
  return root;
}
function configuration(root, extra = {}) {
  return loadConfiguration({ root, env: {}, create: true, ...extra });
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("local installation configuration", () => {
  test.each(["18.20.0", "22.21.9", "22.22.0-rc.1", "invalid"])(
    "rejects unsupported Node.js %s",
    (version) => {
      expect(() => checkRuntime(version)).toThrow("Node.js 22.22以上");
    },
  );
  test.each(["22.22.0", "22.23.0", "24.0.0", "26.10.0"])(
    "accepts Node.js %s",
    (version) => {
      expect(() => checkRuntime(version)).not.toThrow();
    },
  );
  test("persists one secret and resolves the same configuration from Japanese paths", () => {
    const root = temporaryRoot();
    const first = configuration(root);
    expect(first.env.KOSU_SESSION_SECRET).toMatch(/^[a-f0-9]{64}$/);
    const content = readFileSync(first.configPath, "utf8");
    const second = configuration(root);
    expect(second.env.KOSU_SESSION_SECRET).toBe(first.env.KOSU_SESSION_SECRET);
    expect(second.dataDir).toBe(path.join(root, "data"));
    expect(readFileSync(first.configPath, "utf8")).toBe(content);
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    reportConfiguration(second);
    expect(output.mock.calls.flat().join("\n")).not.toContain(
      first.env.KOSU_SESSION_SECRET,
    );
  });
  test("persists explicit initial data location and honors documented environment overrides", () => {
    const root = temporaryRoot();
    const first = configuration(root, {
      env: {
        KOSU_DATA_DIR: "保存 データ",
        PORT: "4100",
        KOSU_SESSION_SECRET: "s".repeat(40),
      },
    });
    expect(configuration(root).dataDir).toBe(first.dataDir);
    expect(configuration(root).env.KOSU_SESSION_SECRET).toBe("s".repeat(40));
    expect(configuration(root, { env: { PORT: "4200" } }).port).toBe(4200);
  });
  test.each(["", "short", sampleSecret])(
    "rejects invalid secrets without changing existing configuration",
    (secret) => {
      const root = temporaryRoot();
      const configPath = path.join(root, ".env");
      const content = `KOSU_SESSION_SECRET=${secret}\n`;
      writeFileSync(configPath, content);
      expect(() => configuration(root)).toThrow("KOSU_SESSION_SECRET");
      expect(readFileSync(configPath, "utf8")).toBe(content);
      expect(existsSync(path.join(root, "data"))).toBe(false);
    },
  );
  test("invalid new data location does not create configuration or silently fall back", () => {
    const root = temporaryRoot();
    writeFileSync(path.join(root, "file"), "keep");
    expect(() =>
      configuration(root, { env: { KOSU_DATA_DIR: "file/subfolder" } }),
    ).toThrow("フォルダー");
    expect(existsSync(path.join(root, ".env"))).toBe(false);
  });
  test.each([
    { PORT: "0" },
    { PORT: "65536" },
    { HOST: "0.0.0.0" },
    { KOSU_DATA_DIR: "" },
  ])("rejects unusable local configuration %j", (env) => {
    expect(() => configuration(temporaryRoot(), { env })).toThrow();
  });
  test("startup does not generate missing configuration", () => {
    const root = temporaryRoot();
    expect(() => loadConfiguration({ root, env: {} })).toThrow(
      "先に install.bat",
    );
    expect(existsSync(path.join(root, ".env"))).toBe(false);
  });
});

describe("startup readiness", () => {
  test("does not accept an occupied port or terminate its owner", async () => {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      await expect(checkPort(server.address().port)).rejects.toThrow(
        "使用できません",
      );
      expect(server.listening).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  test("rejects an exited child even when a health endpoint would succeed", async () => {
    const fetchHealth = vi.fn();
    await expect(
      waitForHealth(
        "http://unused/health",
        { exitCode: 1, signalCode: null },
        { fetchHealth },
      ),
    ).rejects.toThrow("終了");
    expect(fetchHealth).not.toHaveBeenCalled();
  });
  test("requires usable database response and applies a bounded timeout", async () => {
    const child = { exitCode: null, signalCode: null };
    const failed = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", database: false }),
    });
    await expect(
      waitForHealth("http://unused/health", child, {
        fetchHealth: failed,
        timeoutMs: 20,
      }),
    ).rejects.toThrow("タイムアウト");
    const healthy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", database: true }),
    });
    await expect(
      waitForHealth("http://unused/health", child, { fetchHealth: healthy }),
    ).resolves.toBeUndefined();
  });
});

describe("consistent backup and restore", () => {
  function migratedConfig() {
    const tempRoot = temporaryRoot();
    const config = configuration(tempRoot);
    config.root = projectRoot;
    const connection = createDatabaseConnection(config.databasePath);
    runMigrations(connection);
    connection.sqlite
      .prepare(
        "INSERT INTO workspace_settings (id, display_name, default_timezone) VALUES (?, ?, ?)",
      )
      .run("workspace", "保存データ", "Asia/Tokyo");
    return { config, connection, tempRoot };
  }
  test("backs up live WAL data and restores into a new directory without replacing current data", async () => {
    const { config, connection, tempRoot } = migratedConfig();
    let backup;
    try {
      backup = await backupDatabase(config, path.join(tempRoot, "backup"));
    } finally {
      connection.sqlite.close();
    }
    const manifest = JSON.parse(
      readFileSync(path.join(backup, "manifest.json"), "utf8"),
    );
    expect(manifest.integrity).toBe("ok");
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(manifest)).not.toContain(
      config.env.KOSU_SESSION_SECRET,
    );
    const target = restoreDatabase(
      config,
      backup,
      path.join(tempRoot, "復元 データ"),
    );
    const restored = new Database(path.join(target, "kosu.sqlite"));
    try {
      expect(
        restored.prepare("SELECT display_name FROM workspace_settings").get()
          .display_name,
      ).toBe("保存データ");
    } finally {
      restored.close();
    }
    expect(existsSync(config.databasePath)).toBe(true);
    expect(() => restoreDatabase(config, backup, config.dataDir)).toThrow(
      "既に存在",
    );
    await expect(backupDatabase(config, backup)).rejects.toThrow("既に存在");
  });
  test("detects corrupt backup before creating a restore destination", async () => {
    const { config, connection, tempRoot } = migratedConfig();
    connection.sqlite.close();
    const backup = await backupDatabase(config, path.join(tempRoot, "backup"));
    writeFileSync(path.join(backup, "kosu.sqlite"), "corrupt");
    const target = path.join(tempRoot, "restore");
    expect(() => restoreDatabase(config, backup, target)).toThrow(
      "チェックサム",
    );
    expect(existsSync(target)).toBe(false);
    expect(existsSync(config.databasePath)).toBe(true);
  });
  test("rejects mismatched versions and stale side files", async () => {
    const { config, connection, tempRoot } = migratedConfig();
    connection.sqlite.close();
    const backup = await backupDatabase(config, path.join(tempRoot, "backup"));
    const manifestPath = path.join(backup, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, applicationVersion: "0.0.1" }),
    );
    expect(() =>
      restoreDatabase(config, backup, path.join(tempRoot, "restored")),
    ).toThrow("同じ版");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(path.join(backup, "kosu.sqlite-wal"), "stale");
    expect(() =>
      restoreDatabase(config, backup, path.join(tempRoot, "restored")),
    ).toThrow("WAL/SHM");
  });
});
