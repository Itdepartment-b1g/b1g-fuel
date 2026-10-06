import "dotenv/config";
import { createClient, type User } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

class SeedError extends Error {}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  for (const [name, value] of Object.entries({ DATABASE_URL: databaseUrl, NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SECRET_KEY: secretKey, SEED_SUPER_ADMIN_EMAIL: email, SEED_SUPER_ADMIN_PASSWORD: password })) {
    if (!value || value.startsWith("replace-with-")) throw new SeedError(`Missing environment variable: ${name}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) throw new SeedError("SEED_SUPER_ADMIN_EMAIL must be a valid email.");
  if (password!.length < 8) throw new SeedError("SEED_SUPER_ADMIN_PASSWORD must contain at least 8 characters.");
  if (secretKey!.startsWith("sb_publishable_")) throw new SeedError("SUPABASE_SECRET_KEY must be a privileged secret key, not a publishable key.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const supabase = createClient(supabaseUrl!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  try {
    // Verify schema availability and role compatibility before creating an Auth account.
    const existingRole = await prisma.roles.findUnique({ where: { slug: "super_admin" } });
    if (existingRole && existingRole.scope !== "global") throw new SeedError("The existing super_admin role must have global scope. No account was created.");
    let authUser: User | undefined;
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new SeedError(`Unable to inspect Supabase users (${error.code ?? "admin_request_failed"}). Check the secret key and project URL.`);
      authUser = data.users.find((user) => user.email?.toLowerCase() === email);
      if (authUser || data.users.length < 100) break;
    }
    if (authUser && !authUser.email_confirmed_at) throw new SeedError("The existing account is not email-confirmed. Confirm it through Supabase administration before rerunning the seed.");
    const created = !authUser;
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({ email: email!, password: password!, email_confirm: true });
      if (error || !data.user) throw new SeedError(`Unable to create the Supabase account (${error?.code ?? "admin_request_failed"}).`);
      authUser = data.user;
    }
    const authId = authUser.id;
    await prisma.$transaction(async (tx) => {
      const role = await tx.roles.upsert({
        where: { slug: "super_admin" },
        create: { name: "Super Admin", slug: "super_admin", scope: "global", is_system: true },
        update: { is_system: true, is_default_role: false },
      });
      await tx.user.upsert({ where: { id: authId }, create: { id: authId, email }, update: { email } });
      await tx.user_role.upsert({
        where: { user_id_role_id: { user_id: authId, role_id: role.id } },
        create: { user_id: authId, role_id: role.id, scope: "global" },
        update: {},
      });
    });
    console.log(created ? "Super-admin account created and global role assigned." : "Existing account reused; global super-admin role verified. Password unchanged.");
  } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  // Never print the connection string, admin key, password, or full SDK error.
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  console.error(error instanceof SeedError ? error.message : `Seed failed${code ? ` (${code})` : ""}. Check migrations, connectivity, and configuration, then rerun.`);
  process.exitCode = 1;
});
