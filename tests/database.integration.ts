import { test } from "node:test";
import { verify_repository_database } from "./database-scenarios";

// Explicit opt-in: temporary fixtures on the configured PostgreSQL database.
test("Prisma repositories preserve CRUD, filters, assignments, constraints and rollback on Postgres", verify_repository_database);
