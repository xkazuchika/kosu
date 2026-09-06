import { sql } from "drizzle-orm";

import { createDatabaseConnection } from "~/db/client";

type HealthResult = {
  status: "ok" | "error";
  database: boolean;
};

function checkHealth(): HealthResult {
  let connection: ReturnType<typeof createDatabaseConnection> | undefined;

  try {
    connection = createDatabaseConnection();
    connection.db.get<{ ok: number }>(sql`SELECT 1 AS ok`);

    return { status: "ok", database: true };
  } catch {
    return { status: "error", database: false };
  } finally {
    connection?.sqlite.close();
  }
}

export const loader = () => {
  const result = checkHealth();

  return Response.json(result, { status: result.status === "ok" ? 200 : 503 });
};
