# Prisma repositories and migrations

Prisma handles the database schema, migrations, repository queries, transactions, and seed writes. `prisma/schema.prisma` is the model definition. Prisma Client is generated into `src/generated/prisma/` and ignored by Git. No separate TypeScript table mappings are maintained.

## Client and repositories

`src/server/utils/database.ts` provides a lazy Prisma Client using the PostgreSQL adapter and the backend `DATABASE_URL`. The client is reused and disconnected during API shutdown.

Repository files use generated model APIs such as `findMany`, `count`, `create`, `updateMany`, and `deleteMany`. Relations load role assignments, memberships, pages, permissions and assignment counts. Repositories serialize dates into the existing public response shapes. Prisma supplies model UUID defaults and `updated_at` values.

User filters use typed `Prisma.userWhereInput` objects. Conditions within a field use OR; different fields use AND. Relation filters handle memberships and role assignments. Text matching is case-insensitive, and substring filters escape LIKE wildcards to preserve literal `%`, `_` and backslash searches.

Rows and totals share repeatable-read transactions. User profiles and optional assignments use atomic nested writes. Role mapping changes remain atomic, and role updates/deletes include the attributes observed by the service in their conditions. Company deletion retains one parameterized `$queryRaw` row lock before reading membership counts, because the model API has no row-lock option.

Controllers translate Prisma conflicts into the existing HTTP error responses. Resource controllers keep this handling inline in each operation; unexpected failures return safe generic responses.

## Migrations and client generation

The original SQL history remains in `prisma/migrations/`, including scope checks, the single default-role index, and Supabase RLS. Custom checks, partial indexes and RLS must be preserved in migration SQL. Edit models, generate a migration for review, then apply it:

```sh
npm run db:validate
npm run db:generate -- --name add_resource
# Review prisma/migrations/<timestamp>_add_resource/migration.sql.
npm run db:migrate
npm run db:client
```

`db:generate` creates a migration with `prisma migrate dev --create-only`; it does not generate the runtime client. `db:client` runs `prisma generate`. Development migrations require a database and a shadow database. `db:deploy` applies committed SQL in deployment, `db:status` inspects migration status, and `db:studio` opens Prisma Studio. See the [Prisma migration reference](https://www.prisma.io/docs/cli/v7/migrate).

Install, build, typecheck, tests and seeding generate Prisma Client automatically. Builds do not apply database migrations. Commit models and migrations together, and apply migrations separately from application builds.

## Seeding and verification

`db:seed` runs `prisma/seed.ts`, which provisions or reuses a confirmed Supabase Auth account and calls the auth repository for transactional profile and global role writes. Existing passwords are retained and role assignments are idempotent. Auth provisioning happens outside the database transaction.

Run `db:validate`, `npm test`, `typecheck`, `lint`, and `build`. The normal tests exercise real Prisma Client through its PostgreSQL adapter against embedded PostgreSQL (PGlite), replaying committed migration SQL. They verify CRUD, filtering, assignments, constraints, RLS, rollback and seed reruns. `test:db` explicitly exercises the configured live database with temporary fixtures and cleanup, without creating Auth accounts.
