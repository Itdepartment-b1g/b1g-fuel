# Architecture

This project adapts the provided monolithic Next.js reference to the requested **Next.js frontend plus separate Express API**. Node.js runs both services. React uses Lucide React icons and locally owned shadcn/ui components.

```mermaid
flowchart LR
  UI[React feature components] --> Redux[Redux slices and thunks]
  Redux -->|fetch /api with cookies| Next[Next.js same-origin proxy]
  Next --> Express[Express resource routes]
  Express --> Auth[Verified Supabase session]
  Auth --> Controller[Controllers]
  Controller --> Repository[Repositories]
  Repository --> Prisma[Prisma and pg adapter]
  Prisma --> DB[(Supabase Postgres)]
```

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Page | `src/app/{entity}/page.tsx` | Thin App Router page shell |
| Feature UI | `src/components/{entity}/` | List orchestration, table, shared form, dialogs |
| Shared UI | `src/components/ui/`, `src/components/common/` | shadcn primitives, async status |
| Client state | `src/lib/store/` | Types, request thunks, reducers, typed hooks |
| Proxy | `next.config.ts` | Forward `/api/*` to `API_ORIGIN` |
| API entry | `src/server/index.ts`, `app.ts` | Start Express, middleware, errors |
| Routes | `src/server/routes/` | Methods, auth middleware, controller dispatch |
| Controllers | `src/server/controllers/` | Validate inputs, map results to HTTP responses |
| Repositories | `src/server/repositories/` | Database queries; no HTTP code |
| Database client | `src/server/prisma/client.ts` | Lazy Prisma singleton with pg adapter |
| Authentication | `src/server/auth/` | Cookie adapter and verified Supabase user |

Do not add Next.js API handlers for business resources. Do not import backend modules into React components or Redux. Express files cannot use Next.js `server-only`; ESLint checks the frontend boundary. Redux providers create a store per mounted application, rather than sharing a singleton across server requests.

## Resource conventions

One Express router per resource; identity uses `GET/DELETE ?id=uuid` and PATCH body `{ id, title }`. Errors use `{ "error": "Human-readable message" }`. Malformed JSON and invalid inputs return 400, unauthenticated calls 401, disallowed origins 403, missing/unowned resources 404, and unexpected failures a generic 500.

For future per-user resources, derive ownership from the verified session and constrain every repository query by that owner. Profiles are synchronized after verified login.

Redux slices own resource types and HTTP requests, using `credentials: "include"`. List components dispatch fetches, show loading/errors, redirect on 401, and wire table actions to dialogs. Dialogs keep local open/pending state and close only after successful mutations.

## Add a CRUD resource

1. Add a snake_case Prisma model with `user_id` when the data is per-user. Run `npm run db:migrate -- --name add_resource` and generate the client.
2. Create `src/server/repositories/{entity}_repository.ts`; scope every query by the authenticated user.
3. Create `src/server/controllers/{entity}_controller.ts`; validate fields and return consistent errors.
4. Create `src/server/routes/{entity}.ts`, apply `requireAuthUser`, and mount the router in `app.ts`.
5. Extend paths and schemas in `src/lib/openapi.ts`.
6. Create an entity slice and register its reducer in `store.ts`.
7. Create the feature's list/table/form/dialogs and create a thin App Router page.
8. Add navigation, then run lint, typecheck, tests, and build. Verify CRUD with a real database and two users to check isolation.

Generated Prisma code is never edited or committed. Commit schema changes and SQL migrations together. Apply migrations separately from builds. Swagger uses `swagger-ui-dist` loaded on the client for React compatibility.

## Dependency maintenance

The lockfile includes targeted overrides for Prisma CLI's `deepmerge-ts` and `mysql2` dependencies to address their published advisories without downgrading Prisma. Generation and the build have been verified with these overrides. Remove them once upstream packages adopt the patched versions.

At scaffold verification on 2026-10-05, `npm audit --omit=dev` reported no runtime advisories. The full audit reported five high-severity development-tool entries arising from the `braces` dependency chain in Next.js's ESLint plugin. The registry's current `braces` release had no patch; the suggested forced fix would downgrade the Next.js lint configuration to version 14. Keep track of the upstream fix rather than forcing that incompatible downgrade.

Lint, typecheck, API tests, and the Next.js production build passed. A production smoke check returned 200 for all application pages, proxied health, and proxied OpenAPI. Real login and future persisted resources require configured Supabase credentials and an applied database migration; they have not been verified against an external database.

See [Security](SECURITY.md), [Folder structure](FOLDER_STRUCTURE.md), and [Setup](../README.md).

## Sidebar catalog

`src/lib/auth/catalog.ts` defines page keys, page entries, and optional menu groups. The catalog is intentionally empty until features are added. `src/lib/auth/dashboard.ts` defines route paths. `src/app/layout/sideBarMenuItems.ts` builds navigation from explicitly allowed page keys, and checks a page's optional `view_permission` against supplied permission keys. Grouped menus include only allowed children and disappear when none remain. Register each new page in the catalog and icon map, then supply allowed pages and permissions to the dashboard shell.

`AppSideBar` renders icons, active links, and expandable nested groups on desktop and mobile. `format_role_label` formats role slugs for future user UI. Role names alone do not grant menu access, and navigation filtering does not enforce API authorization. The current route shell supplies no page permissions and the session endpoint exposes only identity/global role slugs; fetching company-scoped page grants belongs with the future access-control implementation.
