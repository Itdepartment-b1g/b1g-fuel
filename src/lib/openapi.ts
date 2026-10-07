import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./pagination";
import { rolePaths, roleSchemas } from "./openapi-roles";
import { quickFilterSchemas } from "./openapi-quick-filter";

const errorResponse = { description: "Request failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

export const openapi = {
  openapi: "3.0.3",
  info: { title: "B1G Fuel API", version: "0.1.0", description: "Express API accessed through the Next.js /api proxy." },
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Health" }, { name: "Users" }, { name: "Roles" }],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "supabase-session", description: "Sign in through /api/auth/login to set the project-specific Supabase session cookies. This name is illustrative; Swagger sends actual browser cookies." } },
    schemas: {
      ...roleSchemas,
      ...quickFilterSchemas,
      Error: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
      Credentials: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } },
      CreateUser: { type: "object", additionalProperties: false, required: ["name", "email", "password"], properties: {
        name: { type: "string", minLength: 1, maxLength: 250, example: "Juan Dela Cruz", description: "Required display name; whitespace is trimmed before saving." },
        email: { type: "string", format: "email", maxLength: 254 }, password: { type: "string", minLength: 8, maxLength: 128, writeOnly: true },
        company_id: { type: "string", format: "uuid", description: "Optional company membership. Omit to create a user without a company." }, role_ids: { type: "array", maxItems: 50, uniqueItems: true, items: { type: "string", format: "uuid" }, description: "Optional company-scoped roles; defaults to an empty array. Nonempty role_ids require company_id." },
      } },
      RoleOption: { type: "object", required: ["id", "name", "slug"], properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, slug: { type: "string" } } },
      CompanyOption: { type: "object", required: ["id", "name"], properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } } },
      User: { type: "object", required: ["id", "name", "email", "created_at", "global_roles", "companies"], properties: {
        name: { type: "string", maxLength: 250 },
        id: { type: "string", format: "uuid" }, email: { type: "string", nullable: true }, created_at: { type: "string", format: "date-time" },
        global_roles: { type: "array", items: { $ref: "#/components/schemas/RoleOption" } },
        companies: { type: "array", items: { allOf: [{ $ref: "#/components/schemas/CompanyOption" }, { type: "object", required: ["roles"], properties: { roles: { type: "array", items: { $ref: "#/components/schemas/RoleOption" } } } }] } },
      } },
      UsersPage: { type: "object", required: ["users", "total", "page", "page_size"], properties: {
        users: { type: "array", items: { $ref: "#/components/schemas/User" } }, total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" },
      } },
      UserOptions: { type: "object", required: ["companies", "roles"], properties: {
        companies: { type: "array", items: { $ref: "#/components/schemas/CompanyOption" } }, roles: { type: "array", items: { $ref: "#/components/schemas/RoleOption" } },
      } },
      SessionUser: { type: "object", required: ["id", "email", "name"], properties: {
        id: { type: "string", format: "uuid" }, email: { type: "string", nullable: true }, name: { type: "string", nullable: true, maxLength: 250, description: "Database profile name when available; session lookup falls back to Auth metadata." },
      } },
      Session: { type: "object", required: ["user", "global_roles"], properties: {
        user: { $ref: "#/components/schemas/SessionUser" }, global_roles: { type: "array", items: { type: "string" } },
      } },
      LoginResponse: { type: "object", required: ["user", "message"], properties: {
        user: { allOf: [{ $ref: "#/components/schemas/SessionUser" }], nullable: true }, message: { type: "string" },
      } },
      CreateUserResponse: { type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/User" } } },
      GoogleLoginResponse: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri", description: "Navigate the browser to this URL to continue sign-in." } } },
    },
  },
  paths: {
    ...rolePaths,
    "/api/auth/google": { post: { tags: ["Auth"], summary: "Start Google login", description: "Requires APP_ORIGIN in the Origin header. Sets the HttpOnly PKCE verifier cookie and returns a URL for browser navigation. No credentials or bearer token are required.", responses: {
      "200": { description: "OAuth URL and verifier cookie", content: { "application/json": { schema: { $ref: "#/components/schemas/GoogleLoginResponse" } } } }, "403": errorResponse, "429": errorResponse, "502": errorResponse,
    } } },
    "/api/auth/google/callback": { get: { tags: ["Auth"], summary: "Finish Google login", description: "Browser callback from Supabase. Requires the verifier cookie from initiation and a valid PKCE code. Only existing admin-provisioned profiles can enter the app. Do not call this manually to start login.", parameters: [
      { name: "code", in: "query", schema: { type: "string" }, description: "Single-use code supplied by Supabase." },
      { name: "error", in: "query", schema: { type: "string" }, description: "Provider failure or cancellation." },
    ], responses: { "303": { description: "Redirect to /dashboard on success, or /login with a fixed auth_error code on failure", headers: { Location: { schema: { type: "string", format: "uri" } } } }, "429": errorResponse } } },
    "/api/users": {
      get: { tags: ["Users"], summary: "List users (global super_admin only)", security: [{ session: [] }], parameters: [
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } },
        { name: "page_size", in: "query", schema: { type: "integer", enum: [...PAGE_SIZE_OPTIONS], default: DEFAULT_PAGE_SIZE } },
        { name: "search", in: "query", description: "Case-insensitive name or email search", schema: { type: "string", maxLength: 254 } },
        { name: "filters", in: "query", description: "JSON-encoded QuickFilters. Same-field conditions use OR; different fields, date, role status, membership and search combine with AND. Applied before pagination; company/role values are UUIDs.", schema: { type: "string", maxLength: 12000 } },
      ], responses: { "200": { description: "Paginated users", content: { "application/json": { schema: { $ref: "#/components/schemas/UsersPage" } } } }, "400": errorResponse, "401": errorResponse, "403": errorResponse, "500": errorResponse } },
      post: { tags: ["Users"], summary: "Create an email-confirmed account with optional company roles (global super_admin only)", description: "Requires the application's Origin header. Admin sets the initial password; no invitation email is sent. Company and roles may be omitted. Roles require a company; a company can have no roles.", security: [{ session: [] }], requestBody: jsonBody({ $ref: "#/components/schemas/CreateUser" }), responses: {
        "201": { description: "User created", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserResponse" } } } },
        "400": errorResponse, "401": errorResponse, "403": errorResponse, "409": errorResponse, "429": errorResponse, "500": errorResponse, "502": errorResponse,
      } },
    },
    "/api/users/filter-options": { get: { tags: ["Users"], summary: "Get Quick Filter choices from the full user dataset (super_admin only)", security: [{ session: [] }], responses: { "200": { description: "Fields, role-status and membership choices. Counts describe the full dataset, not the current filtered result.", content: { "application/json": { schema: { $ref: "#/components/schemas/UserFilterOptions" } } } }, "401": errorResponse, "403": errorResponse, "500": errorResponse } } },
    "/api/users/options": { get: { tags: ["Users"], summary: "Get companies and company roles (global super_admin only)", security: [{ session: [] }], responses: {
      "200": { description: "Creation options", content: { "application/json": { schema: { $ref: "#/components/schemas/UserOptions" } } } }, "401": errorResponse, "403": errorResponse, "500": errorResponse,
    } } },
    "/api/health": { get: { tags: ["Health"], summary: "API liveness", responses: { "200": { description: "API is running" } } } },
    "/api/auth/session": { get: { tags: ["Auth"], summary: "Get verified user and global roles", security: [{ session: [] }], responses: { "200": { description: "Verified user with display name and global role slugs", content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } } }, "401": errorResponse, "403": errorResponse } } },
    "/api/auth/login": { post: { tags: ["Auth"], summary: "Sign in", requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }), responses: { "200": { description: "Session cookies set; user includes profile name", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } }, "400": errorResponse, "401": errorResponse, "403": errorResponse, "429": errorResponse } } },
    "/api/auth/logout": { post: { tags: ["Auth"], summary: "Sign out", responses: { "200": { description: "Session cleared" }, "400": errorResponse, "403": errorResponse, "429": errorResponse } } },
  },
};
