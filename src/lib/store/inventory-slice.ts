import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { InventoryBrandsPage, InventoryHistoryPage } from "@/types/inventory";

type Failure = { status: number; message: string };
type Config = { state: RootState; rejectValue: Failure };
type ReadState<T> = { data: T | null; loading: boolean; error: Failure | null; requestId: string | null };
export type InventoryQuery = { search?: string; page?: number; page_size?: number; filters?: QuickFilterState; sort_by?: string; sort_order?: "asc" | "desc" };
export type InventoryHistoryQuery = InventoryQuery & { inventory_id: string };
const initialState: { brands: ReadState<InventoryBrandsPage>; history: ReadState<InventoryHistoryPage>; filters: ReadState<ManagementFilterOptions>; exporting: boolean } = {
  brands: { data: null, loading: false, error: null, requestId: null },
  history: { data: null, loading: false, error: null, requestId: null },
  filters: { data: null, loading: false, error: null, requestId: null }, exporting: false,
};

export function inventoryQueryString(query: InventoryQuery & { inventory_id?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return params.toString();
}

function failure(error: unknown): Failure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") return { status: error.status, message: error.message };
  return { status: 0, message: "Unable to reach inventory. Please try again." };
}

async function request<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, message: typeof data?.error === "string" ? data.error : "Inventory request failed." };
  return data as T;
}

export const listInventoryBrands = createAsyncThunk<InventoryBrandsPage, InventoryQuery, Config>("inventory/brands", async (query, { signal, rejectWithValue }) => {
  try { return await request<InventoryBrandsPage>(`/api/inventory/brands?${inventoryQueryString(query)}`, signal); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getInventoryHistory = createAsyncThunk<InventoryHistoryPage, InventoryHistoryQuery, Config>("inventory/history", async (query, { signal, rejectWithValue }) => {
  try { return await request<InventoryHistoryPage>(`/api/inventory/history?${inventoryQueryString(query)}`, signal); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getInventoryFilters = createAsyncThunk<ManagementFilterOptions, void, Config>("inventory/filters", async (_, { signal, rejectWithValue }) => {
  try { return await request<ManagementFilterOptions>("/api/inventory/filter-options", signal); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const exportInventoryHistory = createAsyncThunk<void, InventoryHistoryQuery, Config>("inventory/export", async (query, { signal, rejectWithValue }) => {
  try {
    const response = await fetch(`/api/inventory/export?${inventoryQueryString({ inventory_id: query.inventory_id, search: query.search, filters: query.filters, sort_by: query.sort_by, sort_order: query.sort_order })}`, { credentials: "include", cache: "no-store", signal });
    if (!response.ok) {
      const data = await response.json();
      throw { status: response.status, message: typeof data?.error === "string" ? data.error : "Export failed." };
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock-movements.xml";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { return rejectWithValue(failure(error)); }
}, { condition: (_, { getState }) => !getState().inventory.exporting });

const slice = createSlice({ name: "inventory", initialState, reducers: {}, extraReducers: (builder) => {
  builder.addCase(listInventoryBrands.pending, (state, action) => { state.brands = { data: null, loading: true, error: null, requestId: action.meta.requestId }; });
  builder.addCase(listInventoryBrands.fulfilled, (state, action) => { if (state.brands.requestId === action.meta.requestId) state.brands = { data: action.payload, loading: false, error: null, requestId: null }; });
  builder.addCase(listInventoryBrands.rejected, (state, action) => { if (state.brands.requestId === action.meta.requestId) { state.brands.loading = false; state.brands.error = action.meta.aborted ? null : action.payload ?? { status: 0, message: "Inventory could not be loaded." }; } });
  builder.addCase(getInventoryHistory.pending, (state, action) => { state.history = { data: null, loading: true, error: null, requestId: action.meta.requestId }; });
  builder.addCase(getInventoryHistory.fulfilled, (state, action) => { if (state.history.requestId === action.meta.requestId) state.history = { data: action.payload, loading: false, error: null, requestId: null }; });
  builder.addCase(getInventoryHistory.rejected, (state, action) => { if (state.history.requestId === action.meta.requestId) { state.history.loading = false; state.history.error = action.meta.aborted ? null : action.payload ?? { status: 0, message: "History could not be loaded." }; } });
  builder.addCase(getInventoryFilters.pending, (state, action) => { state.filters.loading = true; state.filters.error = null; state.filters.requestId = action.meta.requestId; });
  builder.addCase(getInventoryFilters.fulfilled, (state, action) => { if (state.filters.requestId === action.meta.requestId) state.filters = { data: action.payload, loading: false, error: null, requestId: null }; });
  builder.addCase(getInventoryFilters.rejected, (state, action) => { if (state.filters.requestId === action.meta.requestId) { state.filters.loading = false; state.filters.error = action.meta.aborted ? null : action.payload ?? { status: 0, message: "Filter choices could not be loaded." }; } });
  builder.addCase(exportInventoryHistory.pending, (state) => { state.exporting = true; });
  builder.addCase(exportInventoryHistory.fulfilled, (state) => { state.exporting = false; });
  builder.addCase(exportInventoryHistory.rejected, (state) => { state.exporting = false; });
} });

export const inventoryReducer = slice.reducer;
