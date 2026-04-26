import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/saas_pricing";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/infrastructure/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
