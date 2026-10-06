import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle Kit");
}

if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("DATABASE_URL must use the PostgreSQL protocol");
}

export default defineConfig({
  schema: [
    "./src/db/schema/auth.ts",
    "./src/db/schema/organizations.ts",
    "./src/db/schema/subscriptions.ts",
    "./src/db/schema/bachs-webhook-events.ts",
    "./src/db/schema/payments.ts",
    "./src/db/schema/telegram-connections.ts",
    "./src/db/schema/telegram-updates.ts",
    "./src/db/schema/leads.ts",
    "./src/db/schema/conversations.ts",
    "./src/db/schema/messages.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
