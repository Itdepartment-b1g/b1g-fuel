import { EventEmitter } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Reuse the production PrismaPg adapter while directing its pg transport to isolated PostgreSQL.
export function createEmbeddedPrisma(client: PGlite) {
  const pool = new Pool();
  const query = async (config: string | { text: string; values?: unknown[]; types?: { getTypeParser: (oid: number, format: string) => (value: string) => unknown } }, params?: unknown[]) => {
    const text = typeof config === "string" ? config : config.text;
    const values = typeof config === "string" ? params : config.values;
    const parsers: Record<number, (value: string) => unknown> = {};
    if (typeof config !== "string" && config.types) {
      for (const oid of [16, 20, 21, 23, 25, 700, 701, 1043, 1082, 1083, 1114, 1184, 1186, 1266, 1700, 2950, 114, 3802, 1009, 1015, 1115, 1182, 1185])
        parsers[oid] = config.types.getTypeParser(oid, "text");
    }
    const result = await client.query(text, values, { rowMode: "array", parsers });
    return { rows: result.rows, fields: result.fields, rowCount: result.affectedRows ?? result.rows.length };
  };
  const connection = Object.assign(new EventEmitter(), { query, release() {} });
  pool.query = query as unknown as Pool["query"];
  pool.connect = (async () => connection as unknown as PoolClient) as Pool["connect"];
  pool.end = async () => {};
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
