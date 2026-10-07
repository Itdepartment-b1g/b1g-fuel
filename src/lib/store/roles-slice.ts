import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { CreateRoleInput, UpdateRoleInput, RoleResponse, RoleScope, RoleSummary, RolesPage, RoleOptions, DeleteRoleResponse } from "@/lib/roles";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export type RoleFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type RolesQuery = { page?: number; page_size?: number; search?: string; scope?: RoleScope };
export type RolesState = {
  roles: RoleSummary[]; total: number; page: number; page_size: number;
  selectedRole: RoleSummary | null; options: RoleOptions; lastChangedRole: RoleSummary | null;
  listStatus: Status; detailStatus: Status; optionsStatus: Status; mutationStatus: Status;
  mutationOperation: "create" | "update" | "delete" | null;
  listError: RoleFailure | null; detailError: RoleFailure | null; optionsError: RoleFailure | null; mutationError: RoleFailure | null;
  listRequestId: string | null; detailRequestId: string | null; optionsRequestId: string | null; mutationRequestId: string | null;
};
const initialState: RolesState = {
  roles: [], total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE,
  selectedRole: null, options: { scopes: [], pages: [], permissions: [] }, lastChangedRole: null,
  listStatus: "idle", detailStatus: "idle", optionsStatus: "idle", mutationStatus: "idle", mutationOperation: null,
  listError: null, detailError: null, optionsError: null, mutationError: null,
  listRequestId: null, detailRequestId: null, optionsRequestId: null, mutationRequestId: null,
};
function getRoleError(error: unknown): RoleFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") return { status: error.status, message: error.message };
  return { status: 0, message: "Unable to reach the API. Please try again." };
}
async function requestRole<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  let data;
  try { data = await response.json(); }
  catch { throw { status: response.status, message: "The API returned an unreadable response." } satisfies RoleFailure; }
  if (!response.ok) throw { status: response.status, message: typeof data?.error === "string" ? data.error : "The request failed." } satisfies RoleFailure;
  return data as T;
}
type ThunkConfig = { rejectValue: RoleFailure; state: RootState };
export const listRole = createAsyncThunk<RolesPage, RolesQuery | undefined, ThunkConfig>("roles/fetch", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== "") params.set(key, String(value));
  try { return await requestRole<RolesPage>(`/api/roles?${params}`, { signal }); }
  catch (error) { return rejectWithValue(getRoleError(error)); }
});
export const editRole = createAsyncThunk<RoleResponse, string, ThunkConfig>("roles/detail", async (id, { signal, rejectWithValue }) => {
  try { return await requestRole<RoleResponse>(`/api/roles?id=${encodeURIComponent(id)}`, { signal }); }
  catch (error) { return rejectWithValue(getRoleError(error)); }
});
export const getRoleOption = createAsyncThunk<RoleOptions, void, ThunkConfig>("roles/options", async (_, { signal, rejectWithValue }) => {
  try { return await requestRole<RoleOptions>("/api/roles/options", { signal }); }
  catch (error) { return rejectWithValue(getRoleError(error)); }
});
const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().roles.mutationStatus !== "loading";
export const createRole = createAsyncThunk<RoleResponse, CreateRoleInput, ThunkConfig>("roles/create", async (input, { rejectWithValue }) => {
  try { return await requestRole<RoleResponse>("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(getRoleError(error)); }
}, { condition: canMutate });
export const updateRole = createAsyncThunk<RoleResponse, UpdateRoleInput, ThunkConfig>("roles/update", async (input, { rejectWithValue }) => {
  try { return await requestRole<RoleResponse>("/api/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(getRoleError(error)); }
}, { condition: canMutate });
export const deleteRole = createAsyncThunk<DeleteRoleResponse, string, ThunkConfig>("roles/delete", async (id, { rejectWithValue }) => {
  try { return await requestRole<DeleteRoleResponse>(`/api/roles?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(getRoleError(error)); }
}, { condition: canMutate });

const rolesSlice = createSlice({
  name: "roles", initialState,
  reducers: {
    resetRoles: () => initialState,
    clearRoleMutation(state) {
      if (state.mutationStatus === "loading") return;
      state.mutationStatus = "idle"; state.mutationError = null; state.mutationOperation = null; state.lastChangedRole = null;
    },
  },
  extraReducers(builder) {
    builder.addCase(listRole.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listRole.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        Object.assign(state, action.payload); state.listStatus = "succeeded"; state.listRequestId = null;
      }).addCase(listRole.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listRequestId = null; state.listStatus = action.meta.aborted ? "idle" : "failed";
        state.listError = action.meta.aborted ? null : action.payload ?? getRoleError(action.error);
      }).addCase(editRole.pending, (state, action) => { state.detailStatus = "loading"; state.detailError = null; state.selectedRole = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editRole.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.selectedRole = action.payload.role; state.detailStatus = "succeeded"; state.detailRequestId = null;
      }).addCase(editRole.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.detailRequestId = null; state.detailStatus = action.meta.aborted ? "idle" : "failed";
        state.detailError = action.meta.aborted ? null : action.payload ?? getRoleError(action.error);
      }).addCase(getRoleOption.pending, (state, action) => { state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; })
      .addCase(getRoleOption.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.options = action.payload; state.optionsStatus = "succeeded"; state.optionsRequestId = null;
      }).addCase(getRoleOption.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsRequestId = null; state.optionsStatus = action.meta.aborted ? "idle" : "failed";
        state.optionsError = action.meta.aborted ? null : action.payload ?? getRoleError(action.error);
      }).addMatcher(isAnyOf(createRole.pending, updateRole.pending, deleteRole.pending), (state, action) => {
        state.mutationRequestId = action.meta.requestId; state.mutationStatus = "loading"; state.mutationError = null; state.lastChangedRole = null;
        state.mutationOperation = action.type === createRole.pending.type ? "create" : action.type === updateRole.pending.type ? "update" : "delete";
      }).addMatcher(isAnyOf(createRole.fulfilled, updateRole.fulfilled, deleteRole.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationRequestId = null; state.mutationStatus = "succeeded";
        state.listStatus = "idle"; state.listRequestId = null; state.listError = null;
        state.detailRequestId = null;
        if ("role" in action.payload) {
          state.lastChangedRole = action.payload.role;
          if (state.selectedRole?.id === action.payload.role.id) state.selectedRole = action.payload.role;
        } else if (state.selectedRole?.id === action.payload.id) state.selectedRole = null;
        state.detailStatus = state.selectedRole ? "succeeded" : "idle";
      }).addMatcher(isAnyOf(createRole.rejected, updateRole.rejected, deleteRole.rejected), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationRequestId = null; state.mutationStatus = "failed"; state.mutationError = action.payload ?? getRoleError(action.error);
      });
  },
});
export const rolesReducer = rolesSlice.reducer;
export const { resetRoles, clearRoleMutation } = rolesSlice.actions;
export const selectRole = (state: RootState) => state.roles;
