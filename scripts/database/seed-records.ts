import type { Database } from "../../src/server/lib/database";
import { authRepository } from "../../src/server/repositories/auth_repository";

export class SeedError extends Error {}

export async function seed_records(database: Database, authId: string, fullName: string, email: string) {
  if (!await authRepository.seed_super_admin(database, authId, fullName, email))
    throw new SeedError("The existing super_admin role must have global scope.");

  for (const type of [
    { name: "New", key: "new" },
    { name: "Refill", key: "refill" },
  ]) {
    const existing = await database.product_type.findFirst({
      where: { company_id: null, key: type.key },
      select: { id: true },
    });
    if (!existing) {
      await database.product_type.create({
        data: {
          name: type.name,
          key: type.key,
          created_by: authId,
        },
      });
    }
  }
}
