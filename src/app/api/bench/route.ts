import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Set when the module first loads; lets us tell a cold start from a warm one.
const bootedAt = Date.now();
let invocations = 0;

async function time<T>(fn: () => Promise<T>) {
  const start = performance.now();
  await fn();
  return Math.round((performance.now() - start) * 10) / 10;
}

/** Latency check: open from your phone and compare `queriesMs` with the full request time. */
export async function GET() {
  invocations += 1;
  const queriesMs = [];
  for (let i = 0; i < 3; i++) {
    queriesMs.push(await time(() => db.execute(sql`select 1`)));
  }

  return Response.json({
    region: process.env.VERCEL_REGION ?? "local",
    coldStart: invocations === 1,
    functionAgeSec: Math.round((Date.now() - bootedAt) / 1000),
    queriesMs,
  });
}
