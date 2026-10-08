import type { TestContext } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Pool } from "pg";
import type { Database } from "../src/server/utils/database";
import * as schema from "../src/server/utils/database_schema";

export type DatabaseQuery = { sql: string; params: unknown[] };
// Execute real Drizzle builders and row decoders against a controlled pg transport.
export function mockDatabase(t: TestContext, respond: (query: DatabaseQuery) => unknown[][] | Promise<unknown[][]>) {
  const queries: DatabaseQuery[] = [];
  const pool = {
    async query(config: string | { text: string }, params: unknown[] = []) {
      const query = { sql: typeof config === "string" ? config : config.text, params };
      queries.push(query);
      const rows = await respond(query);
      return { rows, rowCount: rows.length };
    },
    async end() {},
  } as unknown as Pool;
  const holder = globalThis as typeof globalThis & { fuelDatabase?: { database: Database; pool: Pool } };
  const previous = holder.fuelDatabase;
  holder.fuelDatabase = { database: drizzle({ client: pool, schema }), pool };
  t.after(() => { if (previous === undefined) delete holder.fuelDatabase; else holder.fuelDatabase = previous; });
  return queries;
}

export function compileSql(condition: SQL | undefined) {
  return condition ? new PgDialect().sqlToQuery(condition) : undefined;
}
