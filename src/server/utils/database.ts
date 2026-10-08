import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./database_schema";

export type Database = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseExecutor = Database | DatabaseTransaction;
const databaseState = globalThis as typeof globalThis & { fuelDatabase?: { database: Database; pool: Pool } };

export function getDatabase(): Database {
  if (!databaseState.fuelDatabase) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString || connectionString.startsWith("replace-with-"))
      throw new Error("Missing environment variable: DATABASE_URL");
    const pool = new Pool({ connectionString });
    databaseState.fuelDatabase = { database: drizzle({ client: pool, schema }), pool };
  }
  return databaseState.fuelDatabase.database;
}

export async function closeDatabase() {
  const current = databaseState.fuelDatabase;
  delete databaseState.fuelDatabase;
  if (current) await current.pool.end();
}
