// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import {
  commitImportJob,
  createImportJob,
  findImportJobById,
} from "../../../app/db/repositories/import-jobs";
import { createTestDatabase } from "../../db/helpers";

let db: KosuDatabase;
let connection: DatabaseConnection;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

describe("import jobs repository", () => {
  test("create preview and commit import job", () => {
    const job = createImportJob(db, {
      importType: "members",
      status: "previewed",
      fileName: "members.csv",
      totalRows: 10,
      validRows: 10,
      invalidRows: 0,
    });

    expect(findImportJobById(db, job.id)?.status).toBe("previewed");

    const committed = commitImportJob(db, job.id, "2026-07-05T00:00:00Z");
    expect(committed.status).toBe("committed");
  });
});
