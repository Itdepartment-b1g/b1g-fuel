# Authentication Redux slice

`src/lib/store/auth-slice.ts` handles requests for password login and Google OAuth initiation. Its reducer is registered as `state.auth` in `store.ts`.

| Export | Usage |
| --- | --- |
| `loginUser({ email, password })` | POST `/api/auth/login`; returns `{ user, message }` |
| `startGoogleLogin()` | POST `/api/auth/google`; returns `{ url }` for browser navigation |
| `selectAuth` | Read user, request status, operation, error and message |
| `clearAuthError()` | Clear request feedback |
| `resetAuth()` | Clear auth state and invalidate pending request results |

Both requests include cookies. Failures reject with `{ status, message }` and populate the Redux error state. The slice prevents concurrent sign-in requests and ignores results after a reset.

These are manual thunks: await their dispatch directly, without `.unwrap()`:

```ts
const result = await dispatch(loginUser({ email, password }));
const { url } = await dispatch(startGoogleLogin());
```

Passwords, session tokens and Google redirect URLs are not stored in Redux state or dispatched plain actions. The slice contains only identity and request feedback; Supabase cookies remain the session authority. The `user` field is the password-login result, not a persistent session check. A reload or return from Google starts a new store; `/api/auth/session` verifies the session.

`AuthForm` handles form input, remembered email storage, browser redirects and callback notices. It reads Redux for loading/errors and dispatches the two requests. Google navigation keeps the controls disabled until the browser leaves the page. Remember email stores only the email address after successful password login.
