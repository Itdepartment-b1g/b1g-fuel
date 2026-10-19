import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
const local = connectionString && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(connectionString).hostname);

test("company supply links allow many requesters, enforce directional unique pairs, and preserve inactive links", { skip: !local }, async () => {
  const client = new Client({ connectionString });
  await client.connect();
  const [requesterA, supplierB, requesterC, requesterD, secondSupplier, actor] = Array.from({ length: 6 }, () => randomUUID());
  const insert = 'INSERT INTO "company_supply_relationship" (id, requesting_company_id, supplying_company_id, created_by, updated_at) VALUES ($1, $2, $3, $4, now()) RETURNING *';
  try {
    await client.query("BEGIN");
    for (const [id, name] of [[requesterA, "A"], [supplierB, "B"], [requesterC, "C"], [requesterD, "D"], [secondSupplier, "Second supplier"]])
      await client.query('INSERT INTO "company" (id, name, updated_at) VALUES ($1, $2, now())', [id, `Supply relationship test ${name}`]);

    const links = [];
    for (const requester of [requesterA, requesterC, requesterD]) {
      const result = await client.query(insert, [randomUUID(), requester, supplierB, actor]);
      links.push(result.rows[0]);
      assert.equal(result.rows[0].is_active, true);
      assert.equal(result.rows[0].created_by, actor);
      assert.ok(result.rows[0].created_at instanceof Date);
    }
    assert.equal((await client.query('SELECT count(*)::int AS total FROM "company_supply_relationship" WHERE supplying_company_id = $1', [supplierB])).rows[0].total, 3);
    await client.query(insert, [randomUUID(), requesterA, secondSupplier, actor]);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM "company_supply_relationship" WHERE requesting_company_id = $1', [requesterA])).rows[0].total, 2);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM "company_supply_relationship" WHERE requesting_company_id = $1 AND supplying_company_id = $2', [supplierB, requesterA])).rows[0].total, 0);

    await client.query("SAVEPOINT constraint_check");
    await assert.rejects(client.query(insert, [randomUUID(), requesterA, supplierB, actor]), { code: "23505" });
    await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    await assert.rejects(client.query(insert, [randomUUID(), requesterA, requesterA, actor]), { code: "23514" });
    await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    await assert.rejects(client.query('UPDATE "company_supply_relationship" SET supplying_company_id = requesting_company_id WHERE id = $1', [links[0].id]), { code: "23514" });
    await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    await assert.rejects(client.query(insert, [randomUUID(), randomUUID(), supplierB, actor]), { code: "23503" });
    await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    await assert.rejects(client.query(insert, [randomUUID(), requesterA, randomUUID(), actor]), { code: "23503" });
    await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    for (const companyId of [requesterA, supplierB]) {
      await assert.rejects(client.query('DELETE FROM "company" WHERE id = $1', [companyId]), { code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    }

    await client.query('UPDATE "company_supply_relationship" SET is_active = false, updated_at = now() WHERE id = $1', [links[0].id]);
    const inactive = (await client.query('SELECT * FROM "company_supply_relationship" WHERE id = $1', [links[0].id])).rows[0];
    assert.equal(inactive.is_active, false);
    assert.equal(inactive.created_by, actor);
    assert.equal(inactive.created_at.getTime(), links[0].created_at.getTime());
    assert.equal((await client.query('SELECT count(*)::int AS total FROM "company_supply_relationship" WHERE supplying_company_id = $1 AND is_active', [supplierB])).rows[0].total, 2);
    await client.query("SAVEPOINT inactive_link");
    await assert.rejects(client.query(insert, [randomUUID(), requesterA, supplierB, actor]), { code: "23505" });
    await client.query("ROLLBACK TO SAVEPOINT inactive_link");
    await client.query('UPDATE "company_supply_relationship" SET is_active = true WHERE id = $1', [links[0].id]);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM "company_supply_relationship" WHERE supplying_company_id = $1 AND is_active', [supplierB])).rows[0].total, 3);
    const security = await client.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'company_supply_relationship'::regclass");
    assert.equal(security.rows[0].relrowsecurity, true);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
