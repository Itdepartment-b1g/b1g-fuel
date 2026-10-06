# B1G Fuel

Next.js App Router frontend with a separate Express 5 API on Node.js. TypeScript, Redux Toolkit, Tailwind CSS, shadcn/ui components, Lucide React, Prisma 7, and Supabase Auth/Postgres are configured.

## Setup

Use Node.js 22.12+ (Node.js 24 recommended) and npm. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

```sh
npm install
cp .env.example .env
```

Set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your Supabase project values. The public key variable accepts an anon/publishable key. `SUPABASE_SECRET_KEY` is backend-only and used by the super-admin seed, not by browser code or normal login. Express reads `.env` via dotenv and Next.js reads it automatically.

For local Supabase, install Docker and the Supabase CLI, then run `supabase start` from this directory. The local ports are configured in `supabase/config.toml`; copy the displayed connection URL and anon key into `.env`. Local auth emails appear at http://127.0.0.1:56324. You can also use Supabase Cloud instead.

```sh
npm run db:generate
npm run db:deploy
npm run dev
```

Open http://localhost:3000. Express listens on http://127.0.0.1:4000. `/api/*` requests go through the Next.js proxy, so the browser uses a single origin and session cookies stay on the frontend host. Set `APP_ORIGIN` to the exact browser origin, including the port; mutation requests from other origins are rejected.

For local development, `API_ORIGIN`, `API_HOST`, `API_PORT`, and `APP_ORIGIN` are optional: the code defaults to `http://127.0.0.1:4000`, `127.0.0.1`, `4000`, and `http://localhost:3000` respectively. Business API routers belong in `src/server/routes/`; no `src/app/api` folder is needed for this Express setup.

Sign in with an existing Supabase account. Public registration is disabled locally; provision accounts through Supabase administration. For a hosted Supabase project, disable new user signups in its authentication settings as well. `/docs` serves Swagger UI and `/api/openapi` serves the spec. `/api/health` reports API liveness; it does not verify database connectivity.

## Seed the first super-admin

Add `SUPABASE_SECRET_KEY`, `SEED_SUPER_ADMIN_EMAIL`, and `SEED_SUPER_ADMIN_PASSWORD` to your local `.env` using `.env.example` as the template. Use a privileged `sb_secret_...` key (or legacy service-role key) from the same Supabase project as `DATABASE_URL` and the Auth URL. Do not prefix the secret or password with `NEXT_PUBLIC_`.

```sh
npm run db:deploy
npm run db:seed
npm run dev
```

The seed creates an email-confirmed Supabase Auth account, a matching Prisma profile, the global/system `super_admin` role, and its `user_role` assignment. It does not require a company membership or expose public registration. Reruns reuse an existing confirmed account without resetting its password and upsert the database records without duplicate assignments. Set the optional `SEED_SUPER_ADMIN_FULL_NAME` to save `user_metadata.full_name` for a new or existing account; leaving it blank preserves the existing name. The sidebar displays this name above the email and Logout button. If an account already exists, use its existing password to log in. A database failure after Auth creation is recoverable by rerunning the seed; Auth creation is outside the Prisma transaction.

Keep `[auth].enable_signup = false` and `[auth.email].enable_signup = true` in local Supabase configuration: the first blocks registration, while the second keeps the email provider available for sign-in. Restart this project's Supabase stack after changing Auth settings.

Open `/login` and enter the seed credentials. Successful login redirects to `/dashboard`, which intentionally has no content yet. Its Next.js proxy verifies the session through Express before allowing access and forwards refreshed session cookies to the browser. Missing sessions redirect to `/login`; unavailable authentication returns 503. The dashboard has an empty fixed sidebar on desktop and a compact mobile header with a menu button that opens the sidebar. Its content area scrolls independently. The page is available to authenticated users; future administrative actions must separately enforce the global role.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Next.js and Express together with reload |
| `npm run dev:web` / `npm run dev:api` | Run either process independently |
| `npm run build` | Generate Prisma client and build Next.js |
| `npm run start` | Run both processes after build |
| `npm run start:web` / `npm run start:api` | Start either production process |
| `npm run lint` | Check source and layer boundaries |
| `npm run typecheck` | Generate Prisma and check frontend/backend TypeScript |
| `npm test` | Run API boundary and authorization tests |
| `npm run db:migrate -- --name add_resource` | Create a migration during development |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Generate Prisma and create/reuse the seeded super-admin |
| `npm run db:studio` | Inspect the database |

The API runs TypeScript with `tsx` in development and production. Keep runtime dependencies installed for the API; don't prune `tsx`. `build` does not require a running database and does not apply migrations.

The reference resource has been removed. If you already applied the initial migration, the next `npm run db:deploy` applies the removal migration and drops its table and data. No database migration was run during this cleanup.

## Guides

- [Folder structure](docs/FOLDER_STRUCTURE.md)
- [Architecture and CRUD playbook](docs/ARCHITECTURE.md)
- [Authentication and access control](docs/SECURITY.md)
- [Users, roles, and company assignments](docs/DATA_MODEL.md)

Root-level guide links point to the implemented documentation. Express replaces the API-route layer from those references at your request. `server-only` is intentionally absent: it is a Next.js bundler marker that cannot run in standalone Express. ESLint prohibits frontend components and Redux slices from importing server or generated database code.

## Deployment

Deploy the Next.js frontend and Express API as separate Node.js services, or on the same host behind a reverse proxy. Set `API_ORIGIN` to the API's reachable URL before building Next.js; set `APP_ORIGIN` on Express to the public frontend origin. In production, use HTTPS for the frontend and proxy. Set `API_HOST=0.0.0.0` if deploying Express in a container, and keep the API private behind the frontend/reverse proxy when possible.

Install dependencies, run `npm run db:deploy` against your production database, then run `npm run build` and start the services. A single Vercel deployment does not host this standalone Express process; host the API separately. Configure Supabase's site URL and email settings for your production frontend. Login sets HttpOnly session cookies. Provision user accounts through Supabase administration; the application does not expose registration.
