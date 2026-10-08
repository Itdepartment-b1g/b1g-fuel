# Backend layers and operation naming

This project uses controllers for HTTP operation handlers, services for business conditions, and repositories for database access. Backend operations use snake_case. Controller and service operations use the same name; repository helpers can describe their supporting queries. See [backend structure and request flow](BACKEND_STRUCTURE.md) for a complete example.

```text
Component → Redux → Express route → Controller → Service → Repository → Prisma → Postgres
```

## Layer responsibilities

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Routes | Match URL/method, apply authentication/authorization and rate limiting, dispatch controller | GET roles with an ID routes to `list_by_id_role`; without an ID to `list_role` |
| Controllers | Validate body/query/IDs, normalize input, call services, write JSON/redirects and translate errors into HTTP statuses | Reject malformed UUIDs or missing names; map duplicate database keys to 409 |
| Services | Evaluate business conditions and orchestrate operations | Protect system roles, reject assigned-role deletion, verify company-role membership, require an admin-provisioned login profile |
| Repositories | Execute Prisma queries, serialize records, expose transaction-bound queries | `list_by_id_role`, `list_user`, `create_user` |
| Redux | Make HTTP requests and manage client loading/error/data state | `listRole`, `editRole`, `createRole`, `updateRole`, `deleteRole` |
| Components | Render controls, manage local form values and browser interaction, dispatch Redux | Open a dialog, remember an email, navigate after login |

Controllers and services must not import directly into client components or slices. Redux accesses the Express API through `/api` with cookies.

Shared pagination and the Prisma connection belong in `src/server/utils`. Resource request validation, database error translation and HTTP error responses stay in controllers. Resource error classes live in their service modules. Prisma filtering helpers, including `build_user_filter`, stay in their repositories; services pass search/filter values without constructing database queries.

## Validation versus conditions

**Input validation belongs in controllers:** whether a field exists, whether it has the right type/length/format, whether a UUID is valid, whether a mapping key is registered, whether arrays contain duplicates, and whether the request attempts to change read-only fields. A valid input becomes a typed object before the controller calls the service. Users, Roles, and Companies keep these helpers in their controllers. Controllers declare operation handlers corresponding to their service operations and may also declare `validate_*` and `respond_*` helpers. Routes own rate limiters.

**Business conditions belong in services:** whether a role is system-managed, whether a global role can be the default, whether a role is assigned and deletable, whether an email already belongs to an account, whether selected roles are available for a company membership, and whether a login account has an organization profile.

Services receive validated values and dependencies, return data, or raise resource error classes (`UserError`, `RoleError`, `CompanyError`) declared in their service modules. They never accept Express request/response objects, write response bodies, or redirect the browser. Errors contain a business reason, such as `role_not_found`, and a safe message. They contain no HTTP status. Request validation helpers use the `invalid_input` reason.

Each resource controller implements its own `try/catch` and success statuses. Resource controllers keep validation and error translation inline in their implemented operation handlers. Roles and Companies each have five operations; Users retains listing, creation and its two dynamic options endpoints. The auth controller translates authentication-guard and Google errors. Resource error classes and reason types live in service modules. The user service completes Auth cleanup before rethrowing a persistence failure to its controller.

Controllers explicitly send `200` for reads/options/updates/deletion and password login/logout, and `201` for resource creation. Missing records return `404`; invalid inputs/pagination return `400`; denied access returns `401`/`403`; conflicts return `409`; provider failures use the existing `502` responses. Unexpected resource failures return a generic `500` without SQL or internal error details. Google callback navigation uses `303 See Other` redirects. `300 Multiple Choices` is not used for ordinary navigation. The application error boundary still handles parser errors and failures outside resource controllers.

Authentication middleware delegates access conditions to `authService`, manages session cookies, and calls `respond_auth_error` from the auth controller to send disallowed-request errors. Origin/CORS middleware retains its protocol-specific responses.

Origin/CORS middleware lives in the existing `src/server/security/middleware.ts`. `getAppOrigin` validates the shared browser origin; `createOriginMiddleware` handles CORS, preflights and mutation-origin checks. The Google controller imports that same helper for redirects. Server binding (`API_HOST`, `API_PORT`, `listen`) stays in `index.ts` because it is startup configuration rather than request middleware.

Token verification lives in `src/server/security/jwt.ts` as `verifyUserToken`. Authentication and Google services call it before applying profile/access conditions. Supabase remains responsible for issuing/signing JWTs; token verification remains separate from database authorization.

Endpoint registration belongs in `src/server/routes/index.ts`: health, OpenAPI, resource-router mounts and the final 404 fallback. `app.ts` installs shared middleware, mounts `routesRouter`, and installs the error handler. New resource routes are registered in the routes index.

## Naming format

Use **snake_case, action + singular entity** for every named function declared in `src/server/repositories`, `src/server/controllers`, and `src/server/services`. This includes operations, factories, validation, serialization, transaction wrappers, function-valued dependency callbacks, and local helpers. List results and database model/JSON collection names can remain plural. Files keep their existing names.

| Operation | Role naming | User naming | Meaning |
| --- | --- | --- | --- |
| List | `list_role` | `list_user` | Fetch a collection, with filters/pagination |
| Create | `create_role` | `create_user` | Save a new record |
| Load for editing | `list_by_id_role` | `edit_user` | Read the existing record for an edit form; does not save changes |
| Update | `update_role` | `update_user` | Persist changes to an existing record |
| Delete | `delete_role` | `delete_user` | Remove a record after checking conditions |
| Form choices | `/roles/options` route | `get_user_option` | Load available values |

`edit_user`, `update_user` and `delete_user` are future naming examples; the current Users API implements listing, creation and options. Do not add placeholder operations just to fill this table.

Use the same operation name across controller and service exports. The Roles repository exports named async functions: `list_role`, `list_by_id_role`, `create_role`, `update_role`, and `delete_role`. Transaction-bound update/delete queries use the same operation names as their service. Company operations follow the same format: `list_company`, `create_company`, `list_by_id_company`, `update_company`, and `delete_company`.

Repository and service helpers use descriptive snake_case: `serialize_role`, `get_user_profile`, `list_user_global_role`, `start_google_login`, and `finish_google_login`. Resource controllers keep validation and HTTP error handling inline in their operation handlers. Avoid ambiguous bare resource functions such as `list`, `find`, `create`, `update`, or `delete` on application repository/service objects.

`usersRepository.assignable_user(input)` reads the existing email account, selected company, and available company-role count before creation. It performs eligibility lookups and does not write assignments. The user service checks those results before provisioning the account.

Types and classes use PascalCase. Resource repositories and the Users/Roles services expose named async functions. Namespace imports may use names such as `usersRepository` or `roleService`. Frontend Redux exports use camelCase, such as `createUser`; components access the backend through HTTP. React components use PascalCase and hooks use `use...`. Imported infrastructure helpers and external APIs retain their prescribed names, including Prisma `select`/`insert` and Supabase `createUser`/`signInWithOAuth`.

ESLint enforces snake_case for named functions and object methods in the three backend directories, with additional checks for arrow-function handlers.

## Current operation exports

- Users controllers/services: `list_user`, `create_user`, `get_user_option`, `get_user_filter_option`; repository eligibility lookup: `assignable_user`.
- Roles controllers/services: `create_role`, `update_role`, `delete_role`, `list_by_id_role`, `list_role`. The controller keeps validation and HTTP error handling inline; static form choices are returned by the `/options` route.
- Companies controllers/services: `list_company`, `create_company`, `list_by_id_company`, `update_company`, `delete_company`.
- Authentication: `login_user`, `logout_user`, `get_user_session`, `start_google_login`, `finish_google_login`; service access checks: `require_user_access`, `require_super_admin`.
- Redux keeps `listUser`, `createUser`, `listRole`, `createRole`, `listCompany`, `createCompany`, and its existing selectors.

Redux async thunks for roles support `.unwrap()`. `createUser` and `loginUser` are manual thunks that keep passwords out of plain actions, async-thunk metadata and state; await their dispatch directly. Naming changes do not change this behavior.

## Transactions and concurrency

Role update/delete services open a database transaction, check business conditions, and pass that transaction to the named repository functions. Role creation and list snapshot transactions remain inside their repository functions. Update/delete statements include the role attributes observed by the service, so a concurrent change cannot silently bypass the decision. A zero-row write is returned to the service, which raises a conflict.

Database constraints remain the final protection against races: unique slugs, the single company-default index, scope CHECK constraints and assignment foreign keys. Repository query predicates and database constraints are persistence safeguards, not duplicated controller validation.

## Adding a resource

1. Define shared request/response types without backend imports.
2. Add raw-input validation and HTTP error helpers in the resource controller.
3. Add database-only repository operations with singular entity names.
4. Add services that decide conditions and coordinate transactions/external operations.
5. Add async operation handlers to controllers with the same names as their service operations. Keep request validation and HTTP error helpers locally, and send explicit success statuses.
6. Mount protected routes and document them in Swagger.
7. Add matching Redux actions and update component imports.
8. Test validation, business conditions, authorization, transaction behavior and failures; run lint/typecheck/tests/build.

This refactor preserves existing HTTP URLs, query conventions, response keys and permissions. No schema migration is required.
