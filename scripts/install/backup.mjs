import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function databaseClass(config) {
  return createRequire(path.join(config.root, "package.json"))(
    "better-sqlite3",
  );
}

export function verifyDatabase(Database, file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    if (
      db.pragma("integrity_check", { simple: true }) !== "ok" ||
      db.pragma("foreign_key_check").length > 0
    ) {
      throw new Error(
        "データベースの整合性検査に失敗しました。既存データは保持しています。",
      );
    }
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    if (
      !["workspace_settings", "members", "__drizzle_migrations"].every((name) =>
        tables.includes(name),
      )
    ) {
      throw new Error("kosuのマイグレーション済みデータベースではありません。");
    }
  } finally {
    db.close();
  }
}

function checksum(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export async function backupDatabase(config, output) {
  const directory = path.resolve(
    config.root,
    output ??
      path.join(
        "backups",
        `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
      ),
  );
  if (existsSync(directory))
    throw new Error(
      "バックアップ先が既に存在します。新しいフォルダーを指定してください。",
    );
  if (!existsSync(config.databasePath))
    throw new Error(
      "バックアップするデータベースがありません。先に導入を完了してください。",
    );
  const Database = databaseClass(config);
  const db = new Database(config.databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  const file = path.join(directory, "kosu.sqlite");
  mkdirSync(directory, { recursive: true });
  try {
    await db.backup(file);
  } finally {
    db.close();
  }
  // Make the backup self-contained, without requiring WAL/SHM from the source.
  const snapshot = new Database(file, { fileMustExist: true });
  try {
    snapshot.pragma("journal_mode = DELETE");
  } finally {
    snapshot.close();
  }
  verifyDatabase(Database, file);
  const version = JSON.parse(
    readFileSync(path.join(config.root, "package.json"), "utf8"),
  ).version;
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        formatVersion: 1,
        applicationVersion: version,
        createdAt: new Date().toISOString(),
        databaseFile: "kosu.sqlite",
        sha256: checksum(file),
        integrity: "ok",
        sourceDataDir: config.dataDir,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return directory;
}

export function restoreDatabase(config, input, targetDataDir) {
  if (!input || !targetDataDir)
    throw new Error(
      "復元には --input バックアップフォルダー --target-data-dir 新しい保存先 を指定してください。",
    );
  const backup = path.resolve(config.root, input);
  const target = path.resolve(config.root, targetDataDir);
  if (existsSync(target))
    throw new Error(
      "復元先が既に存在します。既存データを保持するため、新しいフォルダーを指定してください。",
    );
  const metadata = JSON.parse(
    readFileSync(path.join(backup, "manifest.json"), "utf8"),
  );
  if (
    metadata.formatVersion !== 1 ||
    metadata.databaseFile !== "kosu.sqlite" ||
    !metadata.applicationVersion
  ) {
    throw new Error("対応するバックアップ形式ではありません。");
  }
  const currentVersion = JSON.parse(
    readFileSync(path.join(config.root, "package.json"), "utf8"),
  ).version;
  if (metadata.applicationVersion !== currentVersion)
    throw new Error(
      `バックアップはv${metadata.applicationVersion}用です。対応する同じ版のアプリで復元してください。`,
    );
  const source = path.join(backup, "kosu.sqlite");
  if (
    readdirSync(backup).some(
      (name) => name === "kosu.sqlite-wal" || name === "kosu.sqlite-shm",
    )
  ) {
    throw new Error(
      "バックアップにWAL/SHMが混在しています。一貫性バックアップを指定してください。",
    );
  }
  if (checksum(source) !== metadata.sha256)
    throw new Error(
      "バックアップのチェックサムが一致しません。既存データは保持しています。",
    );
  const Database = databaseClass(config);
  verifyDatabase(Database, source);
  mkdirSync(target, { recursive: true });
  const destination = path.join(target, "kosu.sqlite");
  copyFileSync(source, destination, 1); // COPYFILE_EXCL: never replace data.
  verifyDatabase(Database, destination);
  return target;
}
