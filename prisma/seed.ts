import "dotenv/config";
import { createClient, type User } from "@supabase/supabase-js";
import { getDatabase, closeDatabase } from "../src/server/utils/database";
import { authRepository } from "../src/server/repositories/auth_repository";
import { seed_records, SeedError } from "../scripts/database/seed-records";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SEED_SUPER_ADMIN_FULL_NAME?.trim() || "Super Admin";
  for (const [name, value] of Object.entries({ DATABASE_URL: databaseUrl, NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SECRET_KEY: secretKey, SEED_SUPER_ADMIN_EMAIL: email, SEED_SUPER_ADMIN_PASSWORD: password })) {
    if (!value || value.startsWith("replace-with-")) throw new SeedError(`Missing environment variable: ${name}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) throw new SeedError("SEED_SUPER_ADMIN_EMAIL must be a valid email.");
  if (password!.length < 8) throw new SeedError("SEED_SUPER_ADMIN_PASSWORD must contain at least 8 characters.");
  if (fullName.length > 250) throw new SeedError("SEED_SUPER_ADMIN_FULL_NAME must contain at most 250 characters.");
  if (secretKey!.startsWith("sb_publishable_")) throw new SeedError("SUPABASE_SECRET_KEY must be a privileged secret key, not a publishable key.");

  const database = getDatabase();
  const supabase = createClient(supabaseUrl!, secretKey!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  try {
    // Verify schema availability and role compatibility before creating an Auth account.
    const existingRole = await authRepository.get_super_admin_role();
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
      const { data, error } = await supabase.auth.admin.createUser({
        email: email!, password: password!, email_confirm: true,
        ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
      });
      if (error || !data.user) throw new SeedError(`Unable to create the Supabase account (${error?.code ?? "admin_request_failed"}).`);
      authUser = data.user;
    } else if (fullName && authUser.user_metadata?.full_name !== fullName) {
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: { ...authUser.user_metadata, full_name: fullName },
      });
      if (error || !data.user) throw new SeedError(`Unable to update the account name (${error?.code ?? "admin_request_failed"}).`);
      authUser = data.user;
    }
    const authId = authUser.id;
    await seed_records(database, authId, fullName, email!);
    console.log(created ? "Super-admin account created and global role assigned." : "Existing account reused; global super-admin role verified. Password unchanged.");
  } finally { await closeDatabase(); }
}

main().catch((error: unknown) => {
  // Never print the connection string, admin key, password, or full SDK error.
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  console.error(error instanceof SeedError ? error.message : `Seed failed${code ? ` (${code})` : ""}. Check migrations, connectivity, and configuration, then rerun.`);
  process.exitCode = 1;
});
