import { parseArgs } from "node:util";
import {
  checkRuntime,
  loadConfiguration,
  prepare,
  reportConfiguration,
} from "./common.mjs";

async function main() {
  checkRuntime();
  const { values, positionals } = parseArgs({
    options: {
      config: { type: "string" },
      output: { type: "string" },
      input: { type: "string" },
      "target-data-dir": { type: "string" },
    },
    allowPositionals: true,
  });
  const [command] = positionals;
  if (
    positionals.length !== 1 ||
    !["config", "prepare", "start", "backup", "restore"].includes(command)
  ) {
    throw new Error(
      "使い方: node scripts/install/cli.mjs config|prepare|start|backup|restore [--config 設定ファイル]",
    );
  }
  const config = loadConfiguration({
    configFile: values.config,
    create: command === "config" || command === "prepare",
  });
  reportConfiguration(config);
  if (command === "config")
    console.log("設定を確認しました。既存の設定は維持しています。");
  if (command === "prepare") await prepare(config);
  if (command === "start")
    await (await import("./start.mjs")).startApplication(config);
  if (command === "backup" || command === "restore") {
    const { backupDatabase, restoreDatabase } = await import("./backup.mjs");
    if (command === "backup")
      console.log(
        `バックアップを検証しました: ${await backupDatabase(config, values.output)}`,
      );
    else
      console.log(
        `復元データを検証しました: ${restoreDatabase(config, values.input, values["target-data-dir"])}`,
      );
  }
}

main().catch((error) => {
  // Do not print process environment, command arguments, or stack traces with secrets.
  console.error(`導入・起動を中断しました: ${error.message}`);
  process.exitCode = 1;
});
