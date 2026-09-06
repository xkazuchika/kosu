import { existsSync } from "node:fs";

import { createDatabaseConnection } from "../app/db/client";
import { databaseConfig } from "../app/db/config";
import {
  findForeignKeyViolations,
  formatForeignKeyViolations,
} from "../app/db/integrity";

function main() {
  const databasePath = process.argv[2] ?? databaseConfig.databasePath;

  if (!existsSync(databasePath)) {
    console.log(
      `データベースファイルがまだ存在しないため検査をスキップしました: ${databasePath}`,
    );
    return;
  }

  const connection = createDatabaseConnection(databasePath);

  try {
    const violations = findForeignKeyViolations(connection);

    if (violations.length > 0) {
      console.error(formatForeignKeyViolations(violations));
      process.exitCode = 1;
      return;
    }

    console.log("外部キー制約の検査に合格しました。");
  } finally {
    connection.sqlite.close();
  }
}

main();
