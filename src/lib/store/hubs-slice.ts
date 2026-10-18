import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { HUB_FILTER_OPTIONS } from "@/utils/hubs-filters";
import type { HubOptions, HubResponse, HubSummary, HubsPage, CreateHubInput, DeactivateHubResponse, UpdateHubInput } from "@/types/hubs";

import type { AssignHubInput, HubAssignment, HubAssignmentResponse, HubAssignmentsPage, HubAssignmentOptions, UnassignHubResponse } from "@/types/hubs";

export type HubFailure = { status: number; message: string; assigned_user_company_ids?: string[] };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type HubsQuery = { page?: number; page_size?: number; search?: string; company_id?: string; sort_by?: string; sort_order?: TableSort["direction"]; filters?: QuickFilterState; is_active?: boolean };
type State = {
  assignments: HubAssignmentsPage | null; assignmentOptions: HubAssignmentOptions | null;
  assignmentsLocationId: string | null; assignmentOptionsLocationId: string | null;
  assignmentsStatus: Status; assignmentOptionsStatus: Status;
  assignmentsError: HubFailure | null; assignmentOptionsError: HubFailure | null;
  assignmentsRequestId: string | null; assignmentOptionsRequestId: string | null;
  hubs: HubSummary[]; total: number; selectedHub: HubSummary | null;
  options: HubOptions;
  filterOptions: ManagementFilterOptions; filterOptionsStatus: Status; filterOptionsError: HubFailure | null; filterOptionsRequestId: string | null;
  listStatus: Status; detailStatus: Status; optionsStatus: Status; mutationStatus: Status;
  listError: HubFailure | null; detailError: HubFailure | null; optionsError: HubFailure | null; mutationError: HubFailure | null;
  listRequestId: string | null; detailRequestId: string | null; optionsRequestId: string | null; mutationRequestId: string | null;
};
const initialState: State = {
  assignments: null, assignmentOptions: null, assignmentsLocationId: null, assignmentOptionsLocationId: null,
  assignmentsStatus: "idle", assignmentOptionsStatus: "idle", assignmentsError: null, assignmentOptionsError: null,
  assignmentsRequestId: null, assignmentOptionsRequestId: null,
  hubs: [], total: 0, selectedHub: null, options: { companies: [] },
  filterOptions: HUB_FILTER_OPTIONS, filterOptionsStatus: "idle", filterOptionsError: null, filterOptionsRequestId: null,
  listStatus: "idle", detailStatus: "idle", optionsStatus: "idle", mutationStatus: "idle",
  listError: null, detailError: null, optionsError: null, mutationError: null,
  listRequestId: null, detailRequestId: null, optionsRequestId: null, mutationRequestId: null,
};
function failure(error: unknown): HubFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") return { status: error.status, message: error.message };
  return { status: 0, message: "Unable to reach the API. Please try again." };
}
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  let data;
  try { data = await response.json(); }
  catch { throw { status: response.status, message: "The API returned an unreadable response." }; }
  if (!response.ok) throw { status: response.status, message: typeof data?.error === "string" ? data.error : "The request failed." };
  return data as T;
}
type Config = { state: RootState; rejectValue: HubFailure };
export const listHub = createAsyncThunk<HubsPage, HubsQuery, Config>("hubs/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, key === "filters" ? JSON.stringify(value) : String(value));
  try { return await request<HubsPage>(`/api/hubs?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const editHub = createAsyncThunk<HubResponse, string, Config>("hubs/detail", async (id, { signal, rejectWithValue }) => {
  try { return await request<HubResponse>(`/api/hubs?id=${encodeURIComponent(id)}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getHubFilterOption = createAsyncThunk<ManagementFilterOptions, void, Config>("hubs/filter-options", async (_, { signal, rejectWithValue }) => {
  try { return await request<ManagementFilterOptions>("/api/hubs/filter-options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getHubOption = createAsyncThunk<HubOptions, void, Config>("hubs/options", async (_, { signal, rejectWithValue }) => {
  try { return await request<HubOptions>("/api/hubs/options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().hubs.mutationStatus !== "loading";
export const createHub = createAsyncThunk<HubResponse, CreateHubInput, Config>("hubs/create", async (input, { rejectWithValue }) => {
  try { return await request<HubResponse>("/api/hubs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const updateHub = createAsyncThunk<HubResponse, UpdateHubInput, Config>("hubs/update", async (input, { rejectWithValue }) => {
  try { return await request<HubResponse>("/api/hubs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const deactivateHub = createAsyncThunk<DeactivateHubResponse, string, Config>("hubs/deactivate", async (id, { rejectWithValue }) => {
  try { return await request<DeactivateHubResponse>(`/api/hubs?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

export type HubAssignmentQuery = { location_id: string; page?: number; page_size?: number; search?: string };
export const listHubAssignment = createAsyncThunk<HubAssignmentsPage, HubAssignmentQuery, Config>("hubs/assignments", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  try { return await request<HubAssignmentsPage>(`/api/hubs/assignments?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getHubAssignmentOption = createAsyncThunk<HubAssignmentOptions, HubAssignmentQuery, Config>("hubs/assignment-options", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  try { return await request<HubAssignmentOptions>(`/api/hubs/assignment-options?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const assignHub = createAsyncThunk<HubAssignmentResponse, AssignHubInput, Config>("hubs/assign", async (input, { rejectWithValue }) => {
  try { return await request<HubAssignmentResponse>("/api/hubs/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const assignHubStaff = createAsyncThunk<{ assignments: HubAssignment[] }, { location_id: string; user_company_ids: string[] }, Config>(
  "hubs/assign-staff",
  async (input, { rejectWithValue }) => {
    const assignments: HubAssignment[] = [];
    try {
      for (const user_company_id of new Set(input.user_company_ids)) {
        const result = await request<HubAssignmentResponse>("/api/hubs/assignments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location_id: input.location_id, user_company_id }),
        });
        assignments.push(result.assignment);
      }
      return { assignments };
    } catch (error) {
      return rejectWithValue({ ...failure(error), assigned_user_company_ids: assignments.map((assignment) => assignment.user_company_id) });
    }
  },
  { condition: canMutate },
);
export const unassignHub = createAsyncThunk<UnassignHubResponse, AssignHubInput, Config>("hubs/unassign", async (input, { rejectWithValue }) => {
  const params = new URLSearchParams({ location_id: input.location_id, user_company_id: input.user_company_id });
  try { return await request<UnassignHubResponse>(`/api/hubs/assignments?${params}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

const slice = createSlice({
  name: "hubs", initialState,
  reducers: {
    resetHubs: () => initialState,
    clearHubMutation(state) { if (state.mutationStatus !== "loading") { state.mutationStatus = "idle"; state.mutationError = null; } },
  },
  extraReducers(builder) {
    builder
      .addCase(listHub.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listHub.fulfilled, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.hubs = action.payload.hubs; state.total = action.payload.total; state.listStatus = "succeeded"; state.listRequestId = null; })
      .addCase(listHub.rejected, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.listStatus = action.meta.aborted ? "idle" : "failed"; state.listError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.listRequestId = null; })
      .addCase(editHub.pending, (state, action) => { state.detailStatus = "loading"; state.selectedHub = null; state.detailError = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editHub.fulfilled, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.selectedHub = action.payload.hub; state.detailStatus = "succeeded"; state.detailRequestId = null; })
      .addCase(editHub.rejected, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.detailStatus = action.meta.aborted ? "idle" : "failed"; state.detailError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.detailRequestId = null; })
      .addCase(getHubFilterOption.pending, (state, action) => { state.filterOptionsStatus = "loading"; state.filterOptionsError = null; state.filterOptionsRequestId = action.meta.requestId; })
      .addCase(getHubFilterOption.fulfilled, (state, action) => { if (state.filterOptionsRequestId !== action.meta.requestId) return; state.filterOptions = action.payload; state.filterOptionsStatus = "succeeded"; state.filterOptionsRequestId = null; })
      .addCase(getHubFilterOption.rejected, (state, action) => { if (state.filterOptionsRequestId !== action.meta.requestId) return; state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed"; state.filterOptionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.filterOptionsRequestId = null; })
      .addCase(getHubOption.pending, (state, action) => { state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; })
      .addCase(getHubOption.fulfilled, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.options = action.payload; state.optionsStatus = "succeeded"; state.optionsRequestId = null; })
      .addCase(getHubOption.rejected, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.optionsStatus = action.meta.aborted ? "idle" : "failed"; state.optionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.optionsRequestId = null; })

      .addCase(listHubAssignment.pending, (state, action) => {
        state.assignmentsStatus = "loading"; state.assignmentsError = null; state.assignmentsRequestId = action.meta.requestId;
        state.assignmentsLocationId = action.meta.arg.location_id; state.assignments = null;
      })
      .addCase(listHubAssignment.fulfilled, (state, action) => {
        if (state.assignmentsRequestId !== action.meta.requestId) return;
        state.assignments = action.payload; state.assignmentsStatus = "succeeded"; state.assignmentsRequestId = null;
      })
      .addCase(listHubAssignment.rejected, (state, action) => {
        if (state.assignmentsRequestId !== action.meta.requestId) return;
        state.assignmentsStatus = action.meta.aborted ? "idle" : "failed"; state.assignmentsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.assignmentsRequestId = null;
      })
      .addCase(getHubAssignmentOption.pending, (state, action) => {
        state.assignmentOptionsStatus = "loading"; state.assignmentOptionsError = null; state.assignmentOptionsRequestId = action.meta.requestId;
        state.assignmentOptionsLocationId = action.meta.arg.location_id; state.assignmentOptions = null;
      })
      .addCase(getHubAssignmentOption.fulfilled, (state, action) => {
        if (state.assignmentOptionsRequestId !== action.meta.requestId) return;
        state.assignmentOptions = action.payload; state.assignmentOptionsStatus = "succeeded"; state.assignmentOptionsRequestId = null;
      })
      .addCase(getHubAssignmentOption.rejected, (state, action) => {
        if (state.assignmentOptionsRequestId !== action.meta.requestId) return;
        state.assignmentOptionsStatus = action.meta.aborted ? "idle" : "failed"; state.assignmentOptionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.assignmentOptionsRequestId = null;
      })
      .addMatcher(isAnyOf(createHub.pending, updateHub.pending, deactivateHub.pending, assignHub.pending, assignHubStaff.pending, unassignHub.pending), (state, action) => { state.mutationStatus = "loading"; state.mutationError = null; state.mutationRequestId = action.meta.requestId; })
      .addMatcher(isAnyOf(createHub.fulfilled, updateHub.fulfilled, deactivateHub.fulfilled, assignHub.fulfilled, assignHubStaff.fulfilled, unassignHub.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded"; state.mutationRequestId = null;
        state.assignmentsRequestId = null; state.assignmentOptionsRequestId = null;
        state.assignmentsStatus = "idle"; state.assignmentOptionsStatus = "idle";
        state.listRequestId = null; state.listStatus = "idle"; state.listError = null;
        state.detailRequestId = null; state.detailError = null;
        if ("hub" in action.payload) state.selectedHub = action.payload.hub;
        else state.selectedHub = null;
        state.detailStatus = state.selectedHub ? "succeeded" : "idle";
      })
      .addMatcher(isAnyOf(createHub.rejected, updateHub.rejected, deactivateHub.rejected, assignHub.rejected, assignHubStaff.rejected, unassignHub.rejected), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "failed"; state.mutationError = action.payload ?? failure(action.error); state.mutationRequestId = null;
        if (assignHubStaff.rejected.match(action)) {
          state.listRequestId = null; state.listStatus = "idle";
          state.assignmentsRequestId = null; state.assignmentOptionsRequestId = null;
          state.assignmentsStatus = "idle"; state.assignmentOptionsStatus = "idle";
        }
      });
  },
});
export const hubsReducer = slice.reducer;
export const { resetHubs, clearHubMutation } = slice.actions;
export const selectHub = (state: RootState) => state.hubs;
