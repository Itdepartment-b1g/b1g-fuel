import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "./store";

export type AuthUser = { id: string; name: string | null; email: string | null };
export type LoginInput = { email: string; password: string };
export type LoginResponse = { user: AuthUser | null; message: string };
export type GoogleLoginResponse = { url: string };
export type AuthFailure = { status: number; message: string };
export type AuthState = {
  user: AuthUser | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  operation: "password" | "google" | null;
  error: AuthFailure | null;
  message: string | null;
  requestId: string | null;
};
const initialState: AuthState = { user: null, status: "idle", operation: null, error: null, message: null, requestId: null };

function getAuthError(error: unknown): AuthFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") {
    return { status: error.status, message: error.message };
  }
  return { status: 0, message: "Unable to reach the API. Please try again." };
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "id" in value && typeof value.id === "string"
    && "email" in value && (value.email === null || typeof value.email === "string")
    && "name" in value && (value.name === null || typeof value.name === "string");
}

async function requestAuth(url: string, body?: LoginInput): Promise<{ data: Record<string, unknown>; status: number }> {
  const response = await fetch(url, {
    method: "POST", credentials: "include",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  let data: unknown;
  try { data = await response.json(); }
  catch { throw { status: response.status, message: "The API returned an unreadable response." } satisfies AuthFailure; }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw { status: response.status, message: "The API returned an invalid response." } satisfies AuthFailure;
  const result = data as Record<string, unknown>;
  if (!response.ok) throw { status: response.status, message: typeof result.error === "string" ? result.error : "Authentication failed." } satisfies AuthFailure;
  return { data: result, status: response.status };
}

const authSlice = createSlice({
  name: "auth", initialState,
  reducers: {
    resetAuth: () => initialState,
    clearAuthError(state) { state.error = null; state.message = null; if (state.status === "failed") state.status = "idle"; },
    started(state, action: PayloadAction<{ requestId: string; operation: "password" | "google" }>) {
      state.requestId = action.payload.requestId; state.operation = action.payload.operation;
      state.status = "loading"; state.error = null; state.message = null; state.user = null;
    },
    succeeded(state, action: PayloadAction<{ requestId: string; user: AuthUser | null; message: string | null }>) {
      if (state.requestId !== action.payload.requestId) return;
      state.requestId = null; state.status = "succeeded"; state.user = action.payload.user; state.message = action.payload.message;
    },
    failed(state, action: PayloadAction<{ requestId: string; error: AuthFailure }>) {
      if (state.requestId !== action.payload.requestId) return;
      state.requestId = null; state.status = "failed"; state.error = action.payload.error;
    },
  },
});

export const authReducer = authSlice.reducer;
export const { resetAuth, clearAuthError } = authSlice.actions;
export const selectAuth = (state: RootState) => state.auth;

function beginAuthRequest(dispatch: AppDispatch, getState: () => RootState, operation: "password" | "google") {
  if (getState().auth.status === "loading") throw { status: 0, message: "Sign-in is already in progress." } satisfies AuthFailure;
  const requestId = nanoid();
  dispatch(authSlice.actions.started({ requestId, operation }));
  return requestId;
}
function assertCurrentAuthRequest(getState: () => RootState, requestId: string) {
  if (getState().auth.requestId !== requestId) throw { status: 0, message: "Sign-in was canceled." } satisfies AuthFailure;
}

// Manual thunks prevent passwords entering async-thunk metadata, plain actions or state.
// Await dispatch(loginUser(input)) directly; these thunks do not use .unwrap().
export const loginUser = (input: LoginInput) => async (dispatch: AppDispatch, getState: () => RootState): Promise<LoginResponse> => {
  const requestId = beginAuthRequest(dispatch, getState, "password");
  try {
    const { data, status } = await requestAuth("/api/auth/login", input);
    const user = data.user;
    if (typeof data.message !== "string" || (user !== null && !isAuthUser(user))) {
      throw { status, message: "The API returned an invalid login response." } satisfies AuthFailure;
    }
    const result: LoginResponse = { user: user === null ? null : { id: user.id, name: user.name, email: user.email }, message: data.message };
    assertCurrentAuthRequest(getState, requestId);
    dispatch(authSlice.actions.succeeded({ requestId, ...result }));
    return result;
  } catch (error) {
    const problem = getAuthError(error);
    dispatch(authSlice.actions.failed({ requestId, error: problem }));
    throw problem;
  }
};

export const startGoogleLogin = () => async (dispatch: AppDispatch, getState: () => RootState): Promise<GoogleLoginResponse> => {
  const requestId = beginAuthRequest(dispatch, getState, "google");
  try {
    const { data, status } = await requestAuth("/api/auth/google");
    let valid = false;
    if (typeof data.url === "string") {
      try { valid = ["http:", "https:"].includes(new URL(data.url).protocol); } catch { /* Invalid URL. */ }
    }
    if (!valid || typeof data.url !== "string") throw { status, message: "Unable to start Google sign-in." } satisfies AuthFailure;
    assertCurrentAuthRequest(getState, requestId);
    dispatch(authSlice.actions.succeeded({ requestId, user: null, message: null }));
    return { url: data.url };
  } catch (error) {
    const problem = getAuthError(error);
    dispatch(authSlice.actions.failed({ requestId, error: problem }));
    throw problem;
  }
};
