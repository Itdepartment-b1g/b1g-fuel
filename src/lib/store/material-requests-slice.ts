import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { MaterialRequest, MaterialRequestInput, CreateMaterialRequestInput, MaterialRequestAction, MaterialRequestsPage, RequestOptions, RequestCatalog } from "@/types/material-requests";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
type Failure = { status: number; message: string };
type Config = { state: RootState; rejectValue: Failure };
type Query = { page?: number; page_size?: number; search?: string; status?: string; hub_id?: string; supplier_id?: string; sort_by?: string; sort_order?: "asc" | "desc"; filters?: QuickFilterState };
type Slot<T> = { data: T | null; loading: boolean; error: Failure | null; requestId: string | null; query?: Query };
function slot<T>(): Slot<T> { return { data: null, loading: false, error: null, requestId: null }; }
const initialState = { list: slot<MaterialRequestsPage>(), detail: slot<MaterialRequest>(), options: slot<RequestOptions>(), catalog: slot<RequestCatalog>(), mutation: slot<MaterialRequest>(), filterOptions: slot<ManagementFilterOptions>() };
function params(query: Query) { const result = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") result.set(key, key === "filters" ? JSON.stringify(value) : String(value)); return result; }
function failure(error: unknown): Failure { return error && typeof error === "object" && "status" in error && "message" in error ? error as Failure : { status: 0, message: "Unable to reach the API. Try again." }; }
async function request<T>(path: string, signal?: AbortSignal, method?: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/material-requests${path}`, { credentials: "include", signal, method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, message: data.error ?? "Request failed." };
  return data;
}
export const listMaterialRequest = createAsyncThunk<MaterialRequestsPage, Query, Config>("materialRequests/list", async (query, api) => {
  try { return await request(`?${params(query)}`, api.signal); } catch (error) { return api.rejectWithValue(failure(error)); }
});
export const getMaterialRequestFilterOption = createAsyncThunk<ManagementFilterOptions, void, Config>("materialRequests/filter-options", async (_, api) => {
  try { return await request("/filter-options", api.signal); } catch (error) { return api.rejectWithValue(failure(error)); }
});
export const getMaterialRequest = createAsyncThunk<MaterialRequest, string, Config>("materialRequests/detail", async (id, api) => {
  try { return (await request<{ request: MaterialRequest }>(`?id=${encodeURIComponent(id)}`, api.signal)).request; } catch (error) { return api.rejectWithValue(failure(error)); }
});
export const getMaterialRequestOptions = createAsyncThunk<RequestOptions, Query, Config>("materialRequests/options", async (query, api) => {
  try { return await request(`/options?${params(query)}`, api.signal); } catch (error) { return api.rejectWithValue(failure(error)); }
});
export const getMaterialRequestCatalog = createAsyncThunk<RequestCatalog, Query, Config>("materialRequests/catalog", async (query, api) => {
  try { return await request(`/catalog?${params(query)}`, api.signal); } catch (error) { return api.rejectWithValue(failure(error)); }
});
const canMutate = (_: unknown, api: { getState: () => RootState }) => !api.getState().materialRequests.mutation.loading;
export const createMaterialRequest = createAsyncThunk<MaterialRequest, CreateMaterialRequestInput, Config>("materialRequests/create", async (input, api) => {
  try { return (await request<{ request: MaterialRequest }>("", undefined, "POST", input)).request; } catch (error) { return api.rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const updateMaterialRequest = createAsyncThunk<MaterialRequest, { id: string; input: MaterialRequestInput }, Config>("materialRequests/update", async ({ id, input }, api) => {
  try { return (await request<{ request: MaterialRequest }>(`?id=${encodeURIComponent(id)}`, undefined, "PATCH", input)).request; } catch (error) { return api.rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const actionMaterialRequest = createAsyncThunk<MaterialRequest, MaterialRequestAction, Config>("materialRequests/action", async (input, api) => {
  try { return (await request<{ request: MaterialRequest }>("/action", undefined, "POST", input)).request; } catch (error) { return api.rejectWithValue(failure(error)); }
}, { condition: canMutate });

const slice = createSlice({ name: "materialRequests", initialState, reducers: { clearMaterialRequestMutation(state) { if (!state.mutation.loading) state.mutation = slot<MaterialRequest>(); } }, extraReducers(builder) {
  builder
    .addCase(getMaterialRequestFilterOption.pending, (state, action) => { state.filterOptions = { ...slot<ManagementFilterOptions>(), loading: true, requestId: action.meta.requestId }; })
    .addCase(getMaterialRequestFilterOption.fulfilled, (state, action) => { if (state.filterOptions.requestId === action.meta.requestId) { state.filterOptions.data = action.payload; state.filterOptions.loading = false; state.filterOptions.requestId = null; } })
    .addCase(getMaterialRequestFilterOption.rejected, (state, action) => { if (state.filterOptions.requestId === action.meta.requestId) { state.filterOptions.loading = false; state.filterOptions.error = action.meta.aborted ? null : action.payload ?? failure(action.error); state.filterOptions.requestId = null; } })
    .addCase(listMaterialRequest.pending, (state, action) => { state.list = { ...slot<MaterialRequestsPage>(), loading: true, requestId: action.meta.requestId, query: action.meta.arg }; })
    .addCase(listMaterialRequest.fulfilled, (state, action) => { if (state.list.requestId === action.meta.requestId) { state.list.data = action.payload; state.list.loading = false; state.list.requestId = null; } })
    .addCase(listMaterialRequest.rejected, (state, action) => { if (state.list.requestId === action.meta.requestId) { state.list.loading = false; state.list.error = action.meta.aborted ? null : action.payload ?? failure(action.error); state.list.requestId = null; } })
    .addCase(getMaterialRequest.pending, (state, action) => { state.detail = { ...slot<MaterialRequest>(), loading: true, requestId: action.meta.requestId }; })
    .addCase(getMaterialRequest.fulfilled, (state, action) => { if (state.detail.requestId === action.meta.requestId) { state.detail.data = action.payload; state.detail.loading = false; state.detail.requestId = null; } })
    .addCase(getMaterialRequest.rejected, (state, action) => { if (state.detail.requestId === action.meta.requestId) { state.detail.loading = false; state.detail.error = action.meta.aborted ? null : action.payload ?? failure(action.error); state.detail.requestId = null; } })
    .addCase(getMaterialRequestOptions.pending, (state, action) => { state.options = { ...slot<RequestOptions>(), loading: true, requestId: action.meta.requestId, query: action.meta.arg }; })
    .addCase(getMaterialRequestOptions.fulfilled, (state, action) => { if (state.options.requestId === action.meta.requestId) { state.options.data = action.payload; state.options.loading = false; state.options.requestId = null; } })
    .addCase(getMaterialRequestOptions.rejected, (state, action) => { if (state.options.requestId === action.meta.requestId) { state.options.loading = false; state.options.error = action.meta.aborted ? null : action.payload ?? failure(action.error); state.options.requestId = null; } })
    .addCase(getMaterialRequestCatalog.pending, (state, action) => { state.catalog = { ...slot<RequestCatalog>(), loading: true, requestId: action.meta.requestId, query: action.meta.arg }; })
    .addCase(getMaterialRequestCatalog.fulfilled, (state, action) => { if (state.catalog.requestId === action.meta.requestId) { state.catalog.data = action.payload; state.catalog.loading = false; state.catalog.requestId = null; } })
    .addCase(getMaterialRequestCatalog.rejected, (state, action) => { if (state.catalog.requestId === action.meta.requestId) { state.catalog.loading = false; state.catalog.error = action.meta.aborted ? null : action.payload ?? failure(action.error); state.catalog.requestId = null; } })
    .addMatcher(isAnyOf(createMaterialRequest.pending, updateMaterialRequest.pending, actionMaterialRequest.pending), (state, action) => { state.mutation = { ...slot<MaterialRequest>(), loading: true, requestId: action.meta.requestId }; })
    .addMatcher(isAnyOf(createMaterialRequest.fulfilled, updateMaterialRequest.fulfilled, actionMaterialRequest.fulfilled), (state, action) => { if (state.mutation.requestId !== action.meta.requestId) return; state.mutation = { ...slot<MaterialRequest>(), data: action.payload }; state.list.requestId = null; state.list.loading = false; state.detail.requestId = null; state.detail.loading = false; state.detail.data = action.payload; })
    .addMatcher(isAnyOf(createMaterialRequest.rejected, updateMaterialRequest.rejected, actionMaterialRequest.rejected), (state, action) => { if (state.mutation.requestId !== action.meta.requestId) return; state.mutation.loading = false; state.mutation.error = action.payload ?? failure(action.error); state.mutation.requestId = null; });
} });
export const materialRequestsReducer = slice.reducer;
export const { clearMaterialRequestMutation } = slice.actions;
