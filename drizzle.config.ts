import { defineConfig } from "drizzle-kit";

import { databaseConfig } from "./app/db/config";

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: databaseConfig.databaseUrl,
  },
  out: "./drizzle",
  schema: "./app/db/schema.ts",
});
