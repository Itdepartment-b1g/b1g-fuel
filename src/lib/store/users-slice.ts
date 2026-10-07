import {
  createAsyncThunk,
  createSlice,
  nanoid,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "./store";
import type {
  CreateUserInput,
  CreateUserResponse,
  UserOptions,
  UserSummary,
  UsersPage,
} from "@/lib/users";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export type ApiFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type UsersQuery = { page?: number; page_size?: number; search?: string };
export type UsersState = {
  users: UserSummary[];
  total: number;
  page: number;
  page_size: number;
  options: UserOptions;
  listStatus: Status;
  optionsStatus: Status;
  createStatus: Status;
  listError: ApiFailure | null;
  optionsError: ApiFailure | null;
  createError: ApiFailure | null;
  listRequestId: string | null;
  optionsRequestId: string | null;
  createRequestId: string | null;
  lastCreated: UserSummary | null;
};
const initialState: UsersState = {
  users: [],
  total: 0,
  page: 1,
  page_size: DEFAULT_PAGE_SIZE,
  options: { companies: [], roles: [] },
  listStatus: "idle",
  optionsStatus: "idle",
  createStatus: "idle",
  listError: null,
  optionsError: null,
  createError: null,
  listRequestId: null,
  optionsRequestId: null,
  createRequestId: null,
  lastCreated: null,
};

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: "include" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw {
      status: 0,
      message: "Unable to reach the API. Please try again.",
    } satisfies ApiFailure;
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw {
      status: response.status,
      message: "The API returned an unreadable response.",
    } satisfies ApiFailure;
  }
  if (!response.ok)
    throw {
      status: response.status,
      message:
        typeof data?.error === "string" ? data.error : "The request failed.",
    } satisfies ApiFailure;
  return data as T;
}
function failure(error: unknown): ApiFailure {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "message" in error &&
    typeof error.status === "number" &&
    typeof error.message === "string"
  )
    return { status: error.status, message: error.message };
  return { status: 0, message: "The request failed. Please try again." };
}

export const fetchUsers = createAsyncThunk<
  UsersPage,
  UsersQuery | undefined,
  { rejectValue: ApiFailure }
>("users/fetch", async (query, { rejectWithValue, signal }) => {
  const params = new URLSearchParams();
  if (query?.page !== undefined) params.set("page", String(query.page));
  if (query?.page_size !== undefined)
    params.set("page_size", String(query.page_size));
  if (query?.search) params.set("search", query.search);
  try {
    return await request<UsersPage>(`/api/users?${params}`, { signal });
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});
export const fetchUserOptions = createAsyncThunk<
  UserOptions,
  void,
  { rejectValue: ApiFailure }
>("users/options", async (_, { rejectWithValue, signal }) => {
  try {
    return await request<UserOptions>("/api/users/options", { signal });
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    resetUsers: () => initialState,
    clearCreateStatus(state) {
      if (state.createStatus === "loading") return;
      state.createStatus = "idle";
      state.createError = null;
      state.lastCreated = null;
    },
    creationStarted(state, action: PayloadAction<string>) {
      state.createRequestId = action.payload;
      state.createStatus = "loading";
      state.createError = null;
      state.lastCreated = null;
    },
    creationSucceeded(
      state,
      action: PayloadAction<{ requestId: string; user: UserSummary }>,
    ) {
      if (state.createRequestId !== action.payload.requestId) return;
      state.createRequestId = null;
      state.createStatus = "succeeded";
      state.lastCreated = action.payload.user;
      // Refetch the current list: inserting locally would break filtering and pagination.
      state.listStatus = "idle";
      state.listRequestId = null;
    },
    creationFailed(
      state,
      action: PayloadAction<{ requestId: string; error: ApiFailure }>,
    ) {
      if (state.createRequestId !== action.payload.requestId) return;
      state.createRequestId = null;
      state.createStatus = "failed";
      state.createError = action.payload.error;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchUsers.pending, (state, action) => {
        state.listStatus = "loading";
        state.listError = null;
        state.listRequestId = action.meta.requestId;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        Object.assign(state, action.payload);
        state.listStatus = "succeeded";
        state.listRequestId = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listRequestId = null;
        state.listStatus = action.meta.aborted ? "idle" : "failed";
        state.listError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
      })
      .addCase(fetchUserOptions.pending, (state, action) => {
        state.optionsStatus = "loading";
        state.optionsError = null;
        state.optionsRequestId = action.meta.requestId;
      })
      .addCase(fetchUserOptions.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.options = action.payload;
        state.optionsStatus = "succeeded";
        state.optionsRequestId = null;
      })
      .addCase(fetchUserOptions.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsRequestId = null;
        state.optionsStatus = action.meta.aborted ? "idle" : "failed";
        state.optionsError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
      });
  },
});
export const { resetUsers, clearCreateStatus } = usersSlice.actions;
export const usersReducer = usersSlice.reducer;
export const selectUsers = (state: RootState) => state.users;

// A manual thunk keeps passwords out of Redux actions, async-thunk metadata and state.
// Await dispatch(createUser(input)); failures reject with { status, message }.
export const createUser =
  (input: CreateUserInput) =>
  async (
    dispatch: AppDispatch,
    getState: () => RootState,
  ): Promise<UserSummary> => {
    if (getState().users.createStatus === "loading")
      throw {
        status: 0,
        message: "User creation is already in progress.",
      } satisfies ApiFailure;
    const requestId = nanoid();
    dispatch(usersSlice.actions.creationStarted(requestId));
    try {
      const { user } = await request<CreateUserResponse>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      dispatch(usersSlice.actions.creationSucceeded({ requestId, user }));
      return user;
    } catch (error) {
      const problem = failure(error);
      dispatch(
        usersSlice.actions.creationFailed({ requestId, error: problem }),
      );
      throw problem;
    }
  };
