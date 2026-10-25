import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);

test("inventory migration preserves balances and enforces movement sources and immutable history", { skip: !local }, async () => {
  const client = new Client({ connectionString: url });
  const schema = `inventory_test_${randomUUID().replaceAll("-", "")}`;
  const location = randomUUID();
  const product = randomUUID();
  const source = randomUUID();
  const actor = randomUUID();
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const table of ["location", "product", "receiving_item", "material_request_dispatch_item", "material_request_receiving_item"]) {
      await client.query(`CREATE TABLE "${table}" (id UUID PRIMARY KEY)`);
    }
    const previous = await readFile(new URL("../prisma/migrations/20261025020000_material_request_dispatch/migration.sql", import.meta.url), "utf8");
    const stockStatements = previous.split(";").map((statement) => statement.trim()).filter((statement) => /^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE) "stock_(balance|movement)/.test(statement));
    assert.ok(stockStatements.length > 0);
    for (const statement of stockStatements) await client.query(statement);
    await client.query("INSERT INTO location VALUES ($1)", [location]);
    await client.query("INSERT INTO product VALUES ($1)", [product]);
    await client.query("INSERT INTO stock_balance VALUES ($1, $2, $3, 12.500, now())", [randomUUID(), location, product]);
    const historicalSource = randomUUID();
    await client.query("INSERT INTO material_request_receiving_item VALUES ($1)", [historicalSource]);
    await client.query(`INSERT INTO stock_movement
      (id, location_id, product_id, qty, direction, type, material_request_receiving_item_id, created_by)
      VALUES ($1, $2, $3, 12.500, 'in', 'receive_in', $4, $5)`, [randomUUID(), location, product, historicalSource, actor]);

    const migration = await readFile(new URL("../prisma/migrations/20261025120000_inventory_and_po_stock_movements/migration.sql", import.meta.url), "utf8");
    await client.query(migration);
    assert.equal((await client.query("SELECT qty FROM inventory")).rows[0].qty, "12.500");
    assert.equal((await client.query("SELECT qty FROM stock_movement WHERE material_request_receiving_item_id = $1", [historicalSource])).rows[0].qty, "12.500");
    assert.equal((await client.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'inventory'::regclass")).rows[0].relrowsecurity, true);
    await client.query("BEGIN");
    const rejects = async (sql: string, params: unknown[], code: string) => {
      await client.query("SAVEPOINT invalid_write");
      await assert.rejects(client.query(sql, params), { code });
      await client.query("ROLLBACK TO SAVEPOINT invalid_write");
      await client.query("RELEASE SAVEPOINT invalid_write");
    };
    await rejects("UPDATE inventory SET qty = -1", [], "23514");
    await rejects("INSERT INTO inventory VALUES ($1, $2, $3, 1, now())", [randomUUID(), location, product], "23505");

    const insert = `INSERT INTO stock_movement
      (id, location_id, product_id, qty, direction, type, po_receiving_item_id,
       material_request_dispatch_item_id, material_request_receiving_item_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
    for (const [type, direction, table, index] of [
      ["po_receive_in", "in", "receiving_item", 6],
      ["dispatch_out", "out", "material_request_dispatch_item", 7],
      ["receive_in", "in", "material_request_receiving_item", 8],
    ] as const) {
      await client.query(`INSERT INTO "${table}" VALUES ($1)`, [source]);
      const params: unknown[] = [randomUUID(), location, product, "2.500", direction, type, null, null, null, actor];
      params[index] = source;
      await client.query(insert, params);
      await rejects(insert, params.with(0, randomUUID()), "23505");
      await rejects(insert, params.with(0, randomUUID()).with(index, null), "23514");
      await rejects(insert, params.with(0, randomUUID()).with(index, randomUUID()), "23503");
      await rejects(insert, params.with(0, randomUUID()).with(3, 0).with(index, randomUUID()), "23514");
      await rejects(insert, params.with(0, randomUUID()).with(4, direction === "in" ? "out" : "in").with(index, randomUUID()), "23514");
      const multiple = params.with(0, randomUUID()).with(index, randomUUID());
      multiple[index === 6 ? 7 : 6] = randomUUID();
      await rejects(insert, multiple, "23514");
      await rejects(`DELETE FROM "${table}" WHERE id = $1`, [source], "23503");
    }
    await rejects("UPDATE stock_movement SET qty = 3", [], "23514");
    await rejects("DELETE FROM stock_movement", [], "23514");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM stock_movement")).rows[0].count, 4);
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
