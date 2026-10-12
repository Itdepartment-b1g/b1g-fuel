import type { Database } from "../../src/server/lib/database";
import { authRepository } from "../../src/server/repositories/auth_repository";

export class SeedError extends Error {}

export async function seed_records(database: Database, authId: string, fullName: string, email: string) {
  if (!await authRepository.seed_super_admin(database, authId, fullName, email))
    throw new SeedError("The existing super_admin role must have global scope.");
}
