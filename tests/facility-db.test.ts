import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);

test("facility rename preserves IDs, assignments, history and RLS, and keeps history triggers working", { skip: !local }, async () => {
  const client = new Client({ connectionString: url });
  const schema = `facility_test_${randomUUID().replaceAll("-", "")}`;
  const company = randomUUID();
  const actor = randomUUID();
  const membership = randomUUID();
  const hub = randomUUID();
  const warehouse = randomUUID();
  const assignment = randomUUID();
  const migrationName = "20261025130000_rename_location_to_facility";
  const migrations = new URL("../prisma/migrations/", import.meta.url);
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const entries = await readdir(migrations, { withFileTypes: true });
    for (const name of entries.filter((entry) => entry.isDirectory() && entry.name < migrationName).map((entry) => entry.name).sort()) {
      await client.query(await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"));
    }
    await client.query('INSERT INTO company (id, name, updated_at) VALUES ($1, $2, now())', [company, "Facility migration fixture"]);
    await client.query('INSERT INTO "user" (id, name, updated_at) VALUES ($1, $2, now())', [actor, "Assigned staff"]);
    await client.query('INSERT INTO user_company (id, user_id, company_id, updated_at) VALUES ($1, $2, $3, now())', [membership, actor, company]);
    await client.query('INSERT INTO location (id, company_id, name, type, updated_at) VALUES ($1, $3, $4, \'hub\', now()), ($2, $3, $5, \'warehouse\', now())', [hub, warehouse, company, "Hub", "Warehouse"]);
    await client.query('INSERT INTO user_location (id, company_id, user_company_id, location_id, assigned_by) VALUES ($1, $2, $3, $4, $5)', [assignment, company, membership, hub, actor]);

    await client.query(await readFile(new URL(`${migrationName}/migration.sql`, migrations), "utf8"));
    assert.deepEqual((await client.query('SELECT id, type FROM facility ORDER BY type')).rows, [{ id: warehouse, type: "warehouse" }, { id: hub, type: "hub" }]);
    assert.equal((await client.query('SELECT facility_id FROM user_facility WHERE id = $1', [assignment])).rows[0].facility_id, hub);
    assert.equal((await client.query('SELECT facility_id FROM user_facility_history WHERE id = $1', [assignment])).rows[0].facility_id, hub);
    assert.equal((await client.query("SELECT to_regclass('location') AS old_table")).rows[0].old_table, null);
    for (const table of ["facility", "user_facility", "user_facility_history", "inventory", "stock_movement"]) {
      assert.equal((await client.query('SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass', [table])).rows[0].relrowsecurity, true);
    }
    await client.query('DELETE FROM user_facility WHERE id = $1', [assignment]);
    assert.ok((await client.query('SELECT unassigned_at FROM user_facility_history WHERE id = $1', [assignment])).rows[0].unassigned_at);
    const replacement = randomUUID();
    await client.query('INSERT INTO user_facility (id, company_id, user_company_id, facility_id, assigned_by) VALUES ($1, $2, $3, $4, $5)', [replacement, company, membership, hub, actor]);
    assert.equal((await client.query('SELECT facility_id FROM user_facility_history WHERE id = $1', [replacement])).rows[0].facility_id, hub);
    await client.query('DELETE FROM user_company WHERE id = $1', [membership]);
    assert.ok((await client.query('SELECT unassigned_at FROM user_facility_history WHERE id = $1', [replacement])).rows[0].unassigned_at);
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
