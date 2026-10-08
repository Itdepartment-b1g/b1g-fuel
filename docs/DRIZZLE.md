# Repository queries with Drizzle

The API uses Drizzle ORM with the existing `pg` driver for all four repositories: authentication, users, roles, and companies. Prisma remains responsible for the committed migrations and `prisma/seed.ts`, which creates and closes its own client. The unused API Prisma singleton has been removed. This conversion requires no database reset, migration, or new environment variables.

## Connection and table mappings

`src/server/utils/database.ts` exports `getDatabase()`, `closeDatabase()`, and executor/transaction types. The connection is lazy and uses the existing backend-only `DATABASE_URL`. A shared PostgreSQL pool is reused and closed during API shutdown. This follows Drizzle's [node-postgres connection setup](https://orm.drizzle.team/docs/get-started-postgresql).

`src/server/utils/database_schema.ts` maps the existing table names, enum, column types, nullability, and runtime defaults. Keep these mappings synchronized with `prisma/schema.prisma` whenever a model changes. UUID generation and `updated_at` values previously supplied by Prisma must also be supplied by Drizzle; the mappings provide runtime defaults and update timestamps.

Use the existing `db:migrate`, `db:deploy`, and `db:seed` commands. Prisma migrations remain the authority for foreign keys, unique indexes, CHECK constraints, and RLS. The Drizzle mappings are for queries; no second migration system or Drizzle Kit workflow is configured.

## Layer responsibilities

Controllers keep input validation and HTTP error translation. Services keep business conditions. Existing repository files execute typed Drizzle queries and serialize dates into the same public response shapes. Redux and component contracts are unchanged. All functions declared in these backend layers use snake_case, such as `list_role`, `create_role`, `edit_role`, `update_role`, and `delete_role`; see [code conventions](CODE_CONVENTIONS.md).

Filters in `utils/user_filter.ts` now return parameterized Drizzle SQL expressions. Active values within a field use OR, different fields use AND, and assignment filters use correlated EXISTS queries. Exact text values ignore case. Search uses literal substring matching, so `%` and `_` in input do not become wildcards. Filtering runs before pagination and the total count.

## Transactions and errors

- List rows and totals use a repeatable-read transaction; user filter options also share a snapshot.
- Role creation and mapping replacement are atomic. Conditional role updates/deletes preserve the attributes checked by the service.
- User profile, optional membership, and company-role assignments are written atomically. Supabase Auth creation remains outside this transaction; the service still compensates on database failure.
- Company deletion locks the company row before checking membership counts. This protects against concurrent membership creation and prevents unintended cascading removal.
- Correlated aggregate queries explicitly qualify the outer table ID to avoid ambiguous inner-column references.

Drizzle supports PostgreSQL isolation configuration through its [transaction API](https://orm.drizzle.team/docs/transactions). `getDatabaseErrorCode` unwraps query-error causes. Existing controller files map PostgreSQL SQLSTATE codes: `23505` for uniqueness conflicts, `23503` for foreign-key conflicts, and `23514` for CHECK violations where configured. Services report business reasons without HTTP statuses. Controllers use local `try/catch`, send safe response messages, and return generic `500` responses for unexpected failures. The shared application boundary handles parser errors and failures outside controllers.

## Verification

```sh
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```

The regular suite executes real Drizzle query builders and decoders against a controlled PostgreSQL transport. `test:db` explicitly connects using `.env` and creates temporary records to verify CRUD, filters, membership and assignment counts, global/company role reads, constraint failures, and transaction rollback. It cleans up its fixtures and closes its connection. These fixtures exercise persistence directly without creating Supabase Auth accounts.
