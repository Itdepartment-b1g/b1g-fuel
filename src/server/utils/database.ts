import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

export type Database = PrismaClient;
export type DatabaseTransaction = Prisma.TransactionClient;
export type DatabaseExecutor = Database | DatabaseTransaction;
const databaseState = globalThis as typeof globalThis & {
  fuelDatabase?: { database: Database };
};

export function getDatabase(): Database {
  if (!databaseState.fuelDatabase) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString || connectionString.startsWith("replace-with-"))
      throw new Error("Missing environment variable: DATABASE_URL");
    databaseState.fuelDatabase = {
      database: new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
      }),
    };
  }
  return databaseState.fuelDatabase.database;
}

export async function closeDatabase() {
  const current = databaseState.fuelDatabase;
  delete databaseState.fuelDatabase;
  if (current) await current.database.$disconnect();
}
