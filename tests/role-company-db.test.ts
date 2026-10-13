import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
const local = connectionString && ["localhost", "127.0.0.1", "::1"].includes(new URL(connectionString).hostname);

test("company role constraints reject mismatched memberships and moving assigned roles", { skip: !local }, async () => {
  const client = new Client({ connectionString });
  await client.connect();
  const [firstCompany, secondCompany, role, user, firstMembership, secondMembership] = Array.from({ length: 6 }, () => randomUUID());
  try {
    await client.query("BEGIN");
    await client.query('INSERT INTO "company" (id, name, updated_at) VALUES ($1, $3, now()), ($2, $3, now())', [firstCompany, secondCompany, "Role regression test"]);
    await client.query('INSERT INTO "roles" (id, name, slug, company_id, updated_at) VALUES ($1, $2, $3, $4, now())', [role, "Regression role", `regression_${role.replaceAll("-", "")}`, firstCompany]);
    await client.query('INSERT INTO "user" (id, name, updated_at) VALUES ($1, $2, now())', [user, "Regression user"]);
    await client.query('INSERT INTO "user_company" (id, user_id, company_id, updated_at) VALUES ($1, $3, $4, now()), ($2, $3, $5, now())', [firstMembership, secondMembership, user, firstCompany, secondCompany]);

    await client.query("SAVEPOINT mismatch");
    await assert.rejects(client.query('INSERT INTO "user_company_role" (user_company_id, role_id) VALUES ($1, $2)', [secondMembership, role]), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "23514"));
    await client.query("ROLLBACK TO SAVEPOINT mismatch");

    await client.query('INSERT INTO "user_company_role" (user_company_id, role_id) VALUES ($1, $2)', [firstMembership, role]);
    await client.query("SAVEPOINT reassignment");
    await assert.rejects(client.query('UPDATE "roles" SET company_id = $1 WHERE id = $2', [secondCompany, role]), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "23514"));
    await client.query("ROLLBACK TO SAVEPOINT reassignment");
    const saved = await client.query('SELECT company_id FROM "roles" WHERE id = $1', [role]);
    assert.equal(saved.rows[0].company_id, firstCompany);

    await client.query("SAVEPOINT company_deletion");
    await assert.rejects(client.query('DELETE FROM "company" WHERE id = $1', [firstCompany]), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "23503"));
    await client.query("ROLLBACK TO SAVEPOINT company_deletion");
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
