# Folder structure

The original folder conventions are preserved with Express routes replacing `src/app/api`.

```text
b1g-fuel/
  docs/                     Architecture, folder, and security guides
  prisma/
    schema.prisma           Models for Prisma Client and migrations
    migrations/             Original committed SQL migration history
  scripts/database/
    seed.ts                 Supabase account and global super-admin assignment
    seed-records.ts         Seed orchestration through the Prisma auth repository
  public/                   Static assets
  supabase/config.toml      Local Supabase configuration
  tests/                    API boundary and access-control tests
  src/
    app/                    Next.js App Router pages and root layout
      dashboard/page.tsx     Empty authenticated landing page
      login/page.tsx
      docs/page.tsx
      globals.css
    components/
      auth/auth-form.tsx
      common/async-status.tsx
      docs/swagger.tsx
      providers/redux-provider.tsx
      ui/                   Locally owned shadcn/ui primitives
    hooks/                  Shared React hooks
    proxy.ts                Verifies dashboard sessions through Express
    lib/
      store/                Auth, Users, Roles and Companies slices with typed hooks
      openapi.ts            Shared API specification
      utils.ts              cn() for UI class names
    server/                 Express backend; never imported by the frontend
      index.ts              Node.js service entry
      app.ts                Shared middleware, root router mount and error handling
      auth/                 Supabase cookie adapter and session middleware
      routes/               index.ts mounts health, OpenAPI, resources and 404 fallback
      controllers/          {entity}_controller.ts; async operation handlers matching services
      services/             {entity}_service.ts; business conditions and workflows
      repositories/         {entity}_repository.ts
      schema/               Shared request and response type contracts
      utils/                Shared pagination and Prisma connection
    generated/prisma/       Generated Prisma Client; ignored by Git
  .env.example
  components.json           shadcn CLI settings
  prisma.config.ts          Prisma migrations, datasource and seed command
  next.config.ts            Includes Express /api proxy
  eslint.config.mjs
  postcss.config.mjs
  tsconfig.json
  package.json
  package-lock.json
  README.md
```

Use plural resource folders, `{entity}_controller.ts`, `{entity}_service.ts`, `{entity}_repository.ts`, and `{entity}-slice.ts`. Feature UI lives under its resource folder. Resource controllers declare async operation handlers and may keep request validation and HTTP error helpers locally matching their services. Resource controllers keep validation and HTTP error helpers locally; rate limiters live in routes. Keep business conditions in services, controllers out of `lib`, database access out of components, and generated code out of commits. See [backend structure](BACKEND_STRUCTURE.md) for the request flow and [code conventions](CODE_CONVENTIONS.md) for singular snake_case backend function names.

The Supabase Auth client lives under `server/auth` because Express owns authentication. No browser Supabase client is necessary: login and logout use the same-origin API and HttpOnly cookies.

Add shadcn components with `npx shadcn@latest add <component>`. Shared primitives live in `src/components/ui`, separate from feature components. Temporary operational folders, seed scripts, CI pipelines, and deployment manifests can be added when the project needs them.

See [Architecture](ARCHITECTURE.md) and [Setup](../README.md).
