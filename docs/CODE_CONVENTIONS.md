# Backend layers and operation naming

This project uses controllers for request validation and HTTP errors, services for business conditions, and repositories for database access. Apply the same operation names throughout the backend and Redux.

```text
Component → Redux → Express route → Controller → Service → Repository → Prisma
```

## Layer responsibilities

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Routes | Match URL/method, apply authentication/authorization and rate limiting, dispatch controller | GET roles with an ID routes to editRole; without an ID to listRole |
| Controllers | Validate body/query/IDs, normalize input, call services, write JSON/redirects and translate errors into HTTP statuses | Reject malformed UUIDs or missing names; map duplicate database keys to 409 |
| Controller validation functions | Input checks live directly in the resource's existing controller file | `validateCreateRole` in `roles_controller.ts`; `validateCreateUser` and `validateUserFilter` in `users_controller.ts` |
| Services | Evaluate business conditions and orchestrate operations | Protect system roles, reject assigned-role deletion, verify company-role membership, require an admin-provisioned login profile |
| Repositories | Execute Prisma queries, serialize records, expose transaction-bound queries | `getRole`, `listUser`, `createUser`, `runRoleTransaction` |
| Redux | Make HTTP requests and manage client loading/error/data state | `listRole`, `editRole`, `createRole`, `updateRole`, `deleteRole` |
| Components | Render controls, manage local form values and browser interaction, dispatch Redux | Open a dialog, remember an email, navigate after login |

Controllers and services must not import directly into client components or slices. Redux accesses the Express API through `/api` with cookies.

Pure server helpers belong in `src/server/utils`. For example, `buildUserFilter` in `utils/user_filter.ts` constructs a Prisma filter without executing queries or coordinating a workflow. Services use these helpers while evaluating business conditions; repositories execute the resulting queries.

## Validation versus conditions

**Input validation belongs inside the current controller file:** whether a field exists, whether it has the right type/length/format, whether a UUID is valid, whether a mapping key is registered, whether arrays contain duplicates, and whether the request attempts to change read-only fields. A valid input becomes a typed object before the controller calls the service. Keep validation functions in that file; do not introduce a validation subfolder for this architecture.

**Business conditions belong in services:** whether a role is system-managed, whether a global role can be the default, whether a role is assigned and deletable, whether an email already belongs to an account, whether selected roles are available for a company membership, and whether a login account has an organization profile.

Services receive validated values and dependencies, return data, or raise safe `ApplicationError` subclasses (`UserError`, `RoleError`). They never accept Express request/response objects, write response bodies, or redirect the browser. These exceptions carry response status metadata; controllers decide how to send it. Validation helpers may use the same typed errors for consistent responses.

`handleController` in `src/server/utils/errors.ts` sends known application/validation errors as `{ error }`, translates configured persistence error codes and forwards unexpected errors to the Express error boundary. Database-error mappings are controller-owned. The user service completes Auth cleanup before rethrowing a persistence failure to the controller.

Authentication middleware delegates access conditions to `authService` and rejects disallowed requests before resource controllers. Middleware still owns the HTTP/session-cookie response for that rejection.

Origin/CORS middleware lives in the existing `src/server/security/middleware.ts`. `getAppOrigin` validates the shared browser origin; `createOriginMiddleware` handles CORS, preflights and mutation-origin checks. The Google controller imports that same helper for redirects. Server binding (`API_HOST`, `API_PORT`, `listen`) stays in `index.ts` because it is startup configuration rather than request middleware.

Token verification lives in `src/server/security/jwt.ts` as `verifyUserToken`. Authentication and Google services call it before applying profile/access conditions. Supabase remains responsible for issuing/signing JWTs; token verification remains separate from database authorization.

Endpoint registration belongs in `src/server/routes/index.ts`: health, OpenAPI, resource-router mounts and the final 404 fallback. `app.ts` installs shared middleware, mounts `routesRouter`, and installs the error handler. New resource routes are registered in the routes index.

## Naming format

Use **camelCase, action + singular entity** for named resource operations. List results and database model/JSON collection names can remain plural. Files continue to use the project's existing snake_case backend names.

| Operation | Role naming | User naming | Meaning |
| --- | --- | --- | --- |
| List | `listRole` | `listUser` | Fetch a collection, with filters/pagination |
| Create | `createRole` | `createUser` | Save a new record |
| Load for editing | `editRole` | `editUser` | Read the existing record for an edit form; does not save changes |
| Update | `updateRole` | `updateUser` | Persist changes to an existing record |
| Delete | `deleteRole` | `deleteUser` | Remove a record after checking conditions |
| Form choices | `getRoleOption` | `getUserOption` | Load available values |

`editUser`, `updateUser` and `deleteUser` are future naming examples; the current Users API implements listing, creation and options. Do not add placeholder operations just to fill this table.

Use the same operation name across controller, service and Redux exports. Repository reads can use `getRole` because a database read has no edit-form intent. Transaction-bound update/delete queries use the same operation names as their service.

Supporting functions use descriptive camelCase: `validateRoleId`, `serializeRole`, `buildUserFilter`, `runRoleTransaction`, `getUserProfile`, `listUserGlobalRole`, `handleController`, `startGoogleLogin`, `finishGoogleLogin`. Avoid ambiguous bare resource functions such as `list`, `find`, `create`, `update` or `delete` on application repository/service objects. Avoid snake_case function names such as the former sidebar helpers; those are now `listSidebarMenu` and `formatRoleLabel`.

React component names remain PascalCase, custom hooks use `use...`, and external APIs retain their prescribed names: Prisma `findMany`, Supabase `signInWithOAuth`, React state setters and Radix callbacks are not renamed.

## Current operation exports

- Users controllers/services/Redux: `listUser`, `createUser`, `getUserOption`, `getUserFilterOption`; Redux selector `selectUser` reads the complete Users slice.
- Roles controllers/services/Redux: `listRole`, `createRole`, `editRole`, `updateRole`, `deleteRole`, `getRoleOption`; `selectRole` reads the Roles slice.
- Authentication: `loginUser`, `logoutUser`, `getUserSession`, `startGoogleLogin`, `finishGoogleLogin`. Redux currently exports password login and Google initiation; the other operations run on the backend.

Redux async thunks for roles support `.unwrap()`. `createUser` and `loginUser` are manual thunks that keep passwords out of plain actions, async-thunk metadata and state; await their dispatch directly. Naming changes do not change this behavior.

## Transactions and concurrency

Role update/delete services run their conditions inside `runRoleTransaction`. The repository supplies queries bound to that same transaction. Update/delete statements include the role attributes observed by the service, so a concurrent change cannot silently bypass the decision. A zero-row write is returned to the service, which raises a conflict.

Database constraints remain the final protection against races: unique slugs, the single company-default index, scope CHECK constraints and assignment foreign keys. Repository query predicates and database constraints are persistence safeguards, not duplicated controller validation.

## Adding a resource

1. Define shared request/response types without backend imports.
2. Add validation functions for the raw input inside the resource's current controller file.
3. Add database-only repository operations with singular entity names.
4. Add services that decide conditions and coordinate transactions/external operations.
5. Add controllers that validate, call services and map response/error status.
6. Mount protected routes and document them in Swagger.
7. Add matching Redux actions and update component imports.
8. Test validation, business conditions, authorization, transaction behavior and failures; run lint/typecheck/tests/build.

This refactor preserves existing HTTP URLs, query conventions, response keys and permissions. No schema migration is required.
