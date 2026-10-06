const errorResponse = { description: "Request failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

export const openapi = {
  openapi: "3.0.3",
  info: { title: "B1G Fuel API", version: "0.1.0", description: "Express API accessed through the Next.js /api proxy." },
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Health" }],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "supabase-session", description: "Sign in through /api/auth/login to set the project-specific Supabase session cookies. This name is illustrative; Swagger sends actual browser cookies." } },
    schemas: {
      Error: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
      Credentials: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } },
    },
  },
  paths: {
    "/api/health": { get: { tags: ["Health"], summary: "API liveness", responses: { "200": { description: "API is running" } } } },
    "/api/auth/session": { get: { tags: ["Auth"], summary: "Get verified user and global roles", security: [{ session: [] }], responses: { "200": { description: "Verified user and global role slugs" }, "401": errorResponse } } },
    "/api/auth/login": { post: { tags: ["Auth"], summary: "Sign in", requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }), responses: { "200": { description: "Session cookies set" }, "400": errorResponse, "401": errorResponse, "403": errorResponse, "429": errorResponse } } },
    "/api/auth/logout": { post: { tags: ["Auth"], summary: "Sign out", responses: { "200": { description: "Session cleared" }, "400": errorResponse, "403": errorResponse, "429": errorResponse } } },
  },
};
