import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createEmbeddedPrisma } from "./prisma-pglite";
import { seed_records } from "../scripts/database/seed-records";
import type { Database } from "../src/server/utils/database";
import { verify_repository_database } from "./database-scenarios";
import * as usersRepository from "../src/server/repositories/users_repository";
import * as companiesRepository from "../src/server/repositories/companies_repository";
import { Prisma } from "../src/generated/prisma/client";

// Replay the committed Prisma SQL in isolated PostgreSQL for repository verification.
async function apply_prisma_sql(client: PGlite) {
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const migration of migrations) await client.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
}

test("Prisma repositories preserve CRUD, filters, assignments and transactions on committed migrations", async () => {
  const client = new PGlite();
  const db = createEmbeddedPrisma(client);
  const holder = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = holder.fuelDatabase;
  holder.fuelDatabase = { database: db };
  try {
    await apply_prisma_sql(client);
    // Exercise the same repository scenarios as the live Postgres integration suite.
    await verify_repository_database();
    holder.fuelDatabase = { database: db };
    const company = await companiesRepository.create_company({ name: "Literal 100%_Company" });
    assert.match(company.id, /^[0-9a-f-]{36}$/);
    const pagination = { page: 1, page_size: 10, skip: 0, take: 10 };
    assert.equal((await companiesRepository.list_company(pagination, "%_")).total, 1);
    assert.equal((await companiesRepository.list_company(pagination, "' OR 1=1 --")).total, 0);
    assert.equal((await usersRepository.get_user_option()).companies.length, 1);
    const rls = await client.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'");
    assert.equal(rls.rows.length, 8);
    assert.ok(rls.rows.every((row) => row.relrowsecurity));
    const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
    await assert.rejects(db.roles.create({ data: { name: "Invalid", slug: "invalid_prisma_default", scope: "global", is_default_role: true } }), error => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
      const adapter = error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined;
      return error.code === "P2004" || adapter?.cause?.originalCode === "23514";
    });
    await assert.rejects(client.query("INSERT INTO roles (id, name, slug, scope, is_default_role, updated_at) VALUES ($1, 'Invalid', 'invalid_default', 'global', true, now())", [randomUUID()]), code("23514"));
    await client.query("INSERT INTO roles (id, name, slug, is_default_role, updated_at) VALUES ($1, 'Default', 'default', true, now())", [randomUUID()]);
    await assert.rejects(client.query("INSERT INTO roles (id, name, slug, is_default_role, updated_at) VALUES ($1, 'Duplicate', 'duplicate_default', true, now())", [randomUUID()]), code("23505"));
    await assert.rejects(client.query("INSERT INTO user_role (user_id, role_id, scope) VALUES ($1, $2, 'company')", [randomUUID(), randomUUID()]), code("23514"));
    await assert.rejects(client.query("INSERT INTO user_company_role (user_company_id, role_id, scope) VALUES ($1, $2, 'global')", [randomUUID(), randomUUID()]), code("23514"));
  } finally {
    if (previous) holder.fuelDatabase = previous; else delete holder.fuelDatabase;
    await db.$disconnect();
    await client.close();
  }
});

test("repository seeding is idempotent and rejects a super-admin role with company scope", async () => {
  const client = new PGlite();
  const db = createEmbeddedPrisma(client);
  try {
    await apply_prisma_sql(client);
    const database = db;
    const id = randomUUID();
    await seed_records(database, id, "Admin", "admin@example.com");
    await seed_records(database, id, "Renamed Admin", "admin@example.com");
    assert.equal((await client.query("SELECT * FROM user_role")).rows.length, 1);
    assert.equal((await client.query("SELECT * FROM roles")).rows.length, 1);
    assert.equal((await client.query<{ name: string }>('SELECT name FROM "user"')).rows[0].name, "Renamed Admin");
    await client.exec("DELETE FROM user_role; UPDATE roles SET scope = 'company'");
    await assert.rejects(seed_records(database, randomUUID(), "Rejected", "rejected@example.com"), /must have global scope/);
    assert.equal((await client.query('SELECT * FROM "user"')).rows.length, 1);
  } finally { await db.$disconnect(); await client.close(); }
});
