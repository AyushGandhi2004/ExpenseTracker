import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
// Easy to paste wrong: the pooler username is `postgres.<project-ref>`, not `postgres.<project-ref>.supabase.co`.
if (/^postgres(ql)?:\/\/[^:@/]+\.supabase\.co[:@]/.test(connectionString)) {
  throw new Error("DATABASE_URL username must be `postgres.<project-ref>` (remove the trailing `.supabase.co`).");
}

// Reuse one client across hot reloads in dev, but replace it if .env.local's URL changed.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql; pgUrl?: string };

if (globalForDb.pgClient && globalForDb.pgUrl !== connectionString) {
  void globalForDb.pgClient.end({ timeout: 5 });
  globalForDb.pgClient = undefined;
}

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
  globalForDb.pgUrl = connectionString;
}

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
