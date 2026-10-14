import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { BRAND_FILTER_OPTIONS } from "@/utils/management-filters";
import type { BrandOptions, BrandResponse, BrandSummary, BrandsPage, CreateBrandInput, DeleteBrandResponse, UpdateBrandInput } from "@/types/brands";

export type BrandFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type BrandsQuery = { page?: number; page_size?: number; search?: string; company_id?: string; sort_by?: string; sort_order?: TableSort["direction"]; filters?: QuickFilterState };
type State = {
  brands: BrandSummary[]; total: number; selectedBrand: BrandSummary | null;
  options: BrandOptions;
  filterOptions: ManagementFilterOptions; filterOptionsStatus: Status; filterOptionsError: BrandFailure | null; filterOptionsRequestId: string | null;
  listStatus: Status; detailStatus: Status; optionsStatus: Status; mutationStatus: Status;
  listError: BrandFailure | null; detailError: BrandFailure | null; optionsError: BrandFailure | null; mutationError: BrandFailure | null;
  listRequestId: string | null; detailRequestId: string | null; optionsRequestId: string | null; mutationRequestId: string | null;
};
const initialState: State = {
  brands: [], total: 0, selectedBrand: null, options: { companies: [] },
  filterOptions: BRAND_FILTER_OPTIONS, filterOptionsStatus: "idle", filterOptionsError: null, filterOptionsRequestId: null,
  listStatus: "idle", detailStatus: "idle", optionsStatus: "idle", mutationStatus: "idle",
  listError: null, detailError: null, optionsError: null, mutationError: null,
  listRequestId: null, detailRequestId: null, optionsRequestId: null, mutationRequestId: null,
};
function failure(error: unknown): BrandFailure {
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
type Config = { state: RootState; rejectValue: BrandFailure };
export const listBrand = createAsyncThunk<BrandsPage, BrandsQuery, Config>("brands/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, key === "filters" ? JSON.stringify(value) : String(value));
  try { return await request<BrandsPage>(`/api/brands?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const editBrand = createAsyncThunk<BrandResponse, string, Config>("brands/detail", async (id, { signal, rejectWithValue }) => {
  try { return await request<BrandResponse>(`/api/brands?id=${encodeURIComponent(id)}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getBrandFilterOption = createAsyncThunk<ManagementFilterOptions, void, Config>("brands/filter-options", async (_, { signal, rejectWithValue }) => {
  try { return await request<ManagementFilterOptions>("/api/brands/filter-options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getBrandOption = createAsyncThunk<BrandOptions, void, Config>("brands/options", async (_, { signal, rejectWithValue }) => {
  try { return await request<BrandOptions>("/api/brands/options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().brands.mutationStatus !== "loading";
export const createBrand = createAsyncThunk<BrandResponse, CreateBrandInput, Config>("brands/create", async (input, { rejectWithValue }) => {
  try { return await request<BrandResponse>("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const updateBrand = createAsyncThunk<BrandResponse, UpdateBrandInput, Config>("brands/update", async (input, { rejectWithValue }) => {
  try { return await request<BrandResponse>("/api/brands", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const deleteBrand = createAsyncThunk<DeleteBrandResponse, string, Config>("brands/delete", async (id, { rejectWithValue }) => {
  try { return await request<DeleteBrandResponse>(`/api/brands?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
const slice = createSlice({
  name: "brands", initialState,
  reducers: {
    resetBrands: () => initialState,
    clearBrandMutation(state) { if (state.mutationStatus !== "loading") { state.mutationStatus = "idle"; state.mutationError = null; } },
  },
  extraReducers(builder) {
    builder
      .addCase(listBrand.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listBrand.fulfilled, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.brands = action.payload.brands; state.total = action.payload.total; state.listStatus = "succeeded"; state.listRequestId = null; })
      .addCase(listBrand.rejected, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.listStatus = action.meta.aborted ? "idle" : "failed"; state.listError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.listRequestId = null; })
      .addCase(editBrand.pending, (state, action) => { state.detailStatus = "loading"; state.selectedBrand = null; state.detailError = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editBrand.fulfilled, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.selectedBrand = action.payload.brand; state.detailStatus = "succeeded"; state.detailRequestId = null; })
      .addCase(editBrand.rejected, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.detailStatus = action.meta.aborted ? "idle" : "failed"; state.detailError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.detailRequestId = null; })
      .addCase(getBrandFilterOption.pending, (state, action) => { state.filterOptionsStatus = "loading"; state.filterOptionsError = null; state.filterOptionsRequestId = action.meta.requestId; })
      .addCase(getBrandFilterOption.fulfilled, (state, action) => { if (state.filterOptionsRequestId !== action.meta.requestId) return; state.filterOptions = action.payload; state.filterOptionsStatus = "succeeded"; state.filterOptionsRequestId = null; })
      .addCase(getBrandFilterOption.rejected, (state, action) => { if (state.filterOptionsRequestId !== action.meta.requestId) return; state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed"; state.filterOptionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.filterOptionsRequestId = null; })
      .addCase(getBrandOption.pending, (state, action) => { state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; })
      .addCase(getBrandOption.fulfilled, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.options = action.payload; state.optionsStatus = "succeeded"; state.optionsRequestId = null; })
      .addCase(getBrandOption.rejected, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.optionsStatus = action.meta.aborted ? "idle" : "failed"; state.optionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.optionsRequestId = null; })
      .addMatcher(isAnyOf(createBrand.pending, updateBrand.pending, deleteBrand.pending), (state, action) => { state.mutationStatus = "loading"; state.mutationError = null; state.mutationRequestId = action.meta.requestId; })
      .addMatcher(isAnyOf(createBrand.fulfilled, updateBrand.fulfilled, deleteBrand.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded"; state.mutationRequestId = null;
        state.listRequestId = null; state.listStatus = "idle"; state.listError = null;
        state.detailRequestId = null; state.detailError = null;
        if ("brand" in action.payload) state.selectedBrand = action.payload.brand;
        else state.selectedBrand = null;
        state.detailStatus = state.selectedBrand ? "succeeded" : "idle";
      })
      .addMatcher(isAnyOf(createBrand.rejected, updateBrand.rejected, deleteBrand.rejected), (state, action) => { if (state.mutationRequestId !== action.meta.requestId) return; state.mutationStatus = "failed"; state.mutationError = action.payload ?? failure(action.error); state.mutationRequestId = null; });
  },
});
export const brandsReducer = slice.reducer;
export const { resetBrands, clearBrandMutation } = slice.actions;
export const selectBrand = (state: RootState) => state.brands;
