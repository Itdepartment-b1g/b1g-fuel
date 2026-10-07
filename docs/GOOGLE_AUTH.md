## Production deployment checklist Google login: local setup and production readiness

Reviewed on 2026-10-07. This is a setup guide and implementation checklist. Google login is implemented in the application. The local stack has been restarted and reports Google enabled. The login page, PKCE initiation and redirect to Google passed a live smoke check; real Google consent and production setup still need verification.

## Current project status

| Item | Current state |
| --- | --- |
| Next.js frontend | `http://localhost:3000` |
| Express API | `http://127.0.0.1:4000`, accessed through the frontend's `/api` proxy |
| Local Supabase API | `http://127.0.0.1:56321` |
| Local Postgres | Port `56322` |
| Local Supabase Studio | `http://127.0.0.1:56323` |
| Authentication | Email/password with HttpOnly session cookies |
| Account provisioning | Super-admin seed and protected `POST /api/users` |
| Google provider | Enabled in configuration and verified on the running local stack |
| App OAuth endpoints | `POST /api/auth/google` and `GET /api/auth/google/callback` |
| Google button | Continue with Google on `/login` |
| App callback allowlist | Includes `/login` and `/api/auth/google/callback` |

These values come from `supabase/config.toml` and the current API/frontend configuration. This project uses Supabase port **56321**, not the CLI's usual example port 54321.

## Intended user experience

The super-admin creates an account using the person's real Google email and an app password. The person can use that app password in the login form or select Continue with Google. The app password is separate from the Google account password.

Supabase supports automatic identity linking for matching email addresses, with safeguards around unverified identities. Verify that Google login uses the same Auth UUID as the admin-created account; never merge accounts or assign roles based solely on browser-supplied email. [Identity linking documentation](https://supabase.com/docs/guides/auth/auth-identity-linking)

Company and role assignments remain optional. An approved account without assignments can sign in, but it receives no administrative privileges.

## The two callback URLs

```text
Browser → Google → Supabase Auth callback → App callback → Dashboard
```

| Setting | Local development | Production with hosted Supabase |
| --- | --- | --- |
| Google: Authorized JavaScript origins | `http://localhost:3000` | `https://YOUR_APP_DOMAIN` |
| Google: Authorized redirect URIs | `http://127.0.0.1:56321/auth/v1/callback` | Copy the exact callback from the production Supabase Google provider settings |
| Supabase: Site URL | `http://localhost:3000` | `https://YOUR_APP_DOMAIN` |
| Supabase: allowed app redirect | `http://localhost:3000/api/auth/google/callback` | `https://YOUR_APP_DOMAIN/api/auth/google/callback` |

The hosted Supabase callback normally has the form `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. A custom Auth domain changes it; copy the provider's actual value.

Our app callback is served by Express through the Next.js proxy. Use the public frontend URL, not the private API host or port 4000, so the callback receives the browser's cookies.

Google origins contain scheme, host and optional port, without a path. Redirect URIs must match exactly. Production uses HTTPS; Google permits HTTP for localhost. [Google OAuth client settings](https://support.google.com/cloud/answer/15549257)

Supabase must allow the app's `redirectTo` URL. Use explicit production callback URLs. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)

## Local Google and Supabase configuration

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview), select the project, and configure branding/audience for the intended users.
2. In Data Access, configure `openid`, `https://www.googleapis.com/auth/userinfo.email` and `https://www.googleapis.com/auth/userinfo.profile`.
3. Create a Web application OAuth client with the local origin and Supabase callback from the table above. Save its Client ID and Client Secret.
4. Add the following provider section to `supabase/config.toml` when ready to enable Google:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```

Provide both credentials through the environment used to start the Supabase CLI, for example in the ignored root `.env`. `.env.example` includes placeholders:

```dotenv
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
```

This is a Google OAuth secret, not `SUPABASE_SECRET_KEY`. Keep it out of committed files and browser variables.

For cookie-based OAuth, the app starts a PKCE flow and exchanges the returned code to establish a session. [Supabase Google setup and PKCE flow](https://supabase.com/docs/guides/auth/social-login/auth-google)

Extend the existing `[auth]` section rather than creating a second one:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000/login",
  "http://localhost:3000/api/auth/google/callback"
]
enable_signup = false
```

Retain `[auth.email].enable_signup = true` for the existing password provider. Keep public registration disabled for this admin-managed application.

Restart the local stack after applying configuration:

```powershell
supabase stop
supabase start
```

Do not reset the database to enable Google login. These snippets match the implemented configuration. Restarting the local stack applies them; Google Console settings are configured separately.

## Implemented application work

- [ ] Add a Continue with Google button to `src/components/auth/auth-form.tsx`.
- [ ] Add a Google start endpoint, `POST /api/auth/google`, in the Express auth router/controller. Return the provider URL for a full browser redirect and preserve the PKCE verifier cookie.
- [ ] Add `GET /api/auth/google/callback` to exchange the code with the existing cookie-aware Supabase client. Handle cancellation, missing/expired codes and exchange errors.
- [ ] Register explicit Google routes before the generic `POST /api/auth/:action` route.
- [ ] Construct redirects from trusted `APP_ORIGIN`; redirect successful logins to `/dashboard`. Do not accept arbitrary redirect destinations.
- [ ] Require an existing admin-created Prisma profile matching the verified Auth UUID. Reject an unprovisioned Google user and clear its app session.
- [ ] Apply that profile requirement in protected-request middleware, not only the OAuth callback. The current `requireAuthUser` requires a matching Prisma profile.
- [ ] Password login requires an existing profile and clears rejected sessions; login does not provision accounts.
- [ ] Keep `super_admin` and company permissions in database assignments. Google metadata must not grant roles.
- [ ] Add loading/error behavior for the Google button and readable callback failures. OAuth codes and tokens must not enter Redux state or logs.
- [ ] Document the start/callback endpoints in Swagger and add automated callback/access tests.

The existing origin check covers POST initiation. The GET callback must remain reachable after the Google/Supabase redirect and rely on the OAuth/PKCE validation rather than requiring a browser Origin header.

## Production deployment checklist

- [ ] Decide the final frontend domain and production Supabase project, or public self-hosted Supabase Auth domain.
- [ ] Create a separate production Google OAuth client to keep development URLs and credentials separate.
- [ ] Register the production origin and actual production Supabase callback in that client.
- [ ] Review Google Audience, publishing status and any branding/verification requirements before opening access to intended users.
- [ ] For hosted Supabase, enable Google and save the production Client ID/Secret in that project's provider settings. Local `supabase/config.toml` does not configure a hosted project.
- [ ] For self-hosted Supabase, configure Google in the deployment's Auth service and use its public callback URL rather than localhost.
- [ ] Set the production Supabase Site URL and exact app callback allowlist; keep new-user signup disabled.
- [ ] Set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and backend-only `SUPABASE_SECRET_KEY` for the same production project.
- [ ] Set Express `APP_ORIGIN=https://YOUR_APP_DOMAIN` and `NODE_ENV=production` for secure cookies.
- [ ] Set `API_ORIGIN` to the reachable private API service before the Next.js build. Confirm the proxy forwards cookies and `Set-Cookie` headers during OAuth.
- [ ] Apply committed migrations with `npm run db:deploy`, generate/build, and provision the production super-admin using production seed values.
- [ ] Deploy both Next.js and Express; the frontend deployment alone does not host this standalone API.
- [ ] Confirm deployed users are provisioned in production. Local Auth accounts and database profiles do not automatically transfer to another Supabase project.
- [ ] Complete the verification cases below before enabling Google login for users.

## Verification before release

| Test | Expected result |
| --- | --- |
| Provisioned email/password account signs in with Google | Same Auth UUID and Prisma profile; no duplicate user |
| Same user signs in with the app password afterward | Login still works |
| Provisioned user without company/roles | Can log in; cannot use super-admin operations |
| Unknown Google email | No application access and no automatic approved profile |
| Unknown account rejected because signup is disabled | Login shows Account not registered with instructions to contact the administrator or choose a registered account; handles provider query and fragment errors |
| Google login canceled or callback code missing/expired | Clear failure and return to login |
| Browser session refreshed or logged out | Cookies refresh/clear correctly through the proxy |
| Ordinary user calls `POST /api/users` | 403 while authenticated |
| No session calls a protected endpoint | 401 |
| Production login completes | Browser stays on the production host; no localhost redirect |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `redirect_uri_mismatch` | Google client contains the exact Supabase callback, including this project's port 56321 locally |
| Google provider unavailable | Provider configuration, secret environment and Supabase restart |
| Callback returns 404 | App route has not been implemented or the deployed proxy/API is missing it |
| Redirect lands on the wrong page | App `redirectTo`, Supabase Site URL and redirect allowlist |
| PKCE exchange fails or returns to login | Start/callback use the same browser/frontend host and verifier/session cookies survive the proxy |
| Password login says invalid credentials | Exact account email and app password; Gmail password is not the app password |

Keep this document updated after live Google consent testing and production deployment. Automated tests cover PKCE initiation, callback success/failures, profile rejection and cookies; real Google consent remains a manual verification step.
