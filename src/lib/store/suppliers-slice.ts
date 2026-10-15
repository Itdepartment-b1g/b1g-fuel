import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { SUPPLIER_FILTER_OPTIONS } from "@/utils/management-filters";
import type {
  CreateSupplierInput,
  DeleteSupplierResponse,
  SupplierOptions,
  SupplierResponse,
  SupplierSummary,
  SuppliersPage,
  UpdateSupplierInput,
} from "@/types/suppliers";

export type SupplierFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type SuppliersQuery = { page?: number; page_size?: number; search?: string; company_id?: string; sort_by?: string; sort_order?: TableSort["direction"]; filters?: QuickFilterState };
type State = {
  suppliers: SupplierSummary[];
  total: number;
  selectedSupplier: SupplierSummary | null;
  options: SupplierOptions;
  filterOptions: ManagementFilterOptions;
  filterOptionsStatus: Status;
  filterOptionsError: SupplierFailure | null;
  filterOptionsRequestId: string | null;
  listStatus: Status;
  detailStatus: Status;
  optionsStatus: Status;
  mutationStatus: Status;
  listError: SupplierFailure | null;
  detailError: SupplierFailure | null;
  optionsError: SupplierFailure | null;
  mutationError: SupplierFailure | null;
  listRequestId: string | null;
  detailRequestId: string | null;
  optionsRequestId: string | null;
  mutationRequestId: string | null;
};

const initialState: State = {
  suppliers: [],
  total: 0,
  selectedSupplier: null,
  options: { companies: [] },
  filterOptions: SUPPLIER_FILTER_OPTIONS,
  filterOptionsStatus: "idle",
  filterOptionsError: null,
  filterOptionsRequestId: null,
  listStatus: "idle",
  detailStatus: "idle",
  optionsStatus: "idle",
  mutationStatus: "idle",
  listError: null,
  detailError: null,
  optionsError: null,
  mutationError: null,
  listRequestId: null,
  detailRequestId: null,
  optionsRequestId: null,
  mutationRequestId: null,
};

function failure(error: unknown): SupplierFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") {
    return { status: error.status, message: error.message };
  }
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

type Config = { state: RootState; rejectValue: SupplierFailure };

export const listSupplier = createAsyncThunk<SuppliersPage, SuppliersQuery, Config>("suppliers/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, key === "filters" ? JSON.stringify(value) : String(value));
  try { return await request<SuppliersPage>(`/api/suppliers?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});

export const getSupplierFilterOption = createAsyncThunk<ManagementFilterOptions, void, Config>("suppliers/filter-options", async (_, { signal, rejectWithValue }) => {
  try { return await request<ManagementFilterOptions>("/api/suppliers/filter-options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getSupplierOption = createAsyncThunk<SupplierOptions, void, Config>("suppliers/options", async (_, { signal, rejectWithValue }) => {
  try { return await request<SupplierOptions>("/api/suppliers/options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const editSupplier = createAsyncThunk<SupplierResponse, string, Config>("suppliers/detail", async (id, { signal, rejectWithValue }) => {
  try { return await request<SupplierResponse>(`/api/suppliers?id=${encodeURIComponent(id)}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});

const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().suppliers.mutationStatus !== "loading";

export const createSupplier = createAsyncThunk<SupplierResponse, CreateSupplierInput, Config>("suppliers/create", async (input, { rejectWithValue }) => {
  try { return await request<SupplierResponse>("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

export const updateSupplier = createAsyncThunk<SupplierResponse, UpdateSupplierInput, Config>("suppliers/update", async (input, { rejectWithValue }) => {
  try { return await request<SupplierResponse>("/api/suppliers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

export const deleteSupplier = createAsyncThunk<DeleteSupplierResponse, string, Config>("suppliers/delete", async (id, { rejectWithValue }) => {
  try { return await request<DeleteSupplierResponse>(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

const slice = createSlice({
  name: "suppliers",
  initialState,
  reducers: {
    resetSuppliers: () => initialState,
    clearSupplierMutation(state) {
      if (state.mutationStatus !== "loading") {
        state.mutationStatus = "idle";
        state.mutationError = null;
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(listSupplier.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listSupplier.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.suppliers = action.payload.suppliers;
        state.total = action.payload.total;
        state.listStatus = "succeeded";
        state.listRequestId = null;
      })
      .addCase(listSupplier.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listStatus = action.meta.aborted ? "idle" : "failed";
        state.listError = action.meta.aborted ? null : action.payload ?? failure(action.error);
        state.listRequestId = null;
      })
      .addCase(getSupplierFilterOption.pending, (state, action) => { state.filterOptionsStatus = "loading"; state.filterOptionsError = null; state.filterOptionsRequestId = action.meta.requestId; })
      .addCase(getSupplierFilterOption.fulfilled, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId || !action.payload?.fields) return;
        state.filterOptions = action.payload;
        state.filterOptionsStatus = "succeeded";
        state.filterOptionsRequestId = null;
      })
      .addCase(getSupplierFilterOption.rejected, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId) return;
        state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed";
        state.filterOptionsError = action.meta.aborted ? null : action.payload ?? failure(action.error);
        state.filterOptionsRequestId = null;
      })
      .addCase(getSupplierOption.pending, (state, action) => { state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; })
      .addCase(getSupplierOption.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.options = action.payload;
        state.optionsStatus = "succeeded";
        state.optionsRequestId = null;
      })
      .addCase(getSupplierOption.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsStatus = action.meta.aborted ? "idle" : "failed";
        state.optionsError = action.meta.aborted ? null : action.payload ?? failure(action.error);
        state.optionsRequestId = null;
      })
      .addCase(editSupplier.pending, (state, action) => { state.detailStatus = "loading"; state.selectedSupplier = null; state.detailError = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editSupplier.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.selectedSupplier = action.payload.supplier;
        state.detailStatus = "succeeded";
        state.detailRequestId = null;
      })
      .addCase(editSupplier.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.detailStatus = action.meta.aborted ? "idle" : "failed";
        state.detailError = action.meta.aborted ? null : action.payload ?? failure(action.error);
        state.detailRequestId = null;
      })
      .addMatcher(isAnyOf(createSupplier.pending, updateSupplier.pending, deleteSupplier.pending), (state, action) => {
        state.mutationStatus = "loading";
        state.mutationError = null;
        state.mutationRequestId = action.meta.requestId;
      })
      .addMatcher(isAnyOf(createSupplier.fulfilled, updateSupplier.fulfilled, deleteSupplier.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded";
        state.mutationRequestId = null;
        state.listRequestId = null;
        state.listStatus = "idle";
        state.listError = null;
        state.detailRequestId = null;
        state.detailError = null;
        if ("supplier" in action.payload) state.selectedSupplier = action.payload.supplier;
        else state.selectedSupplier = null;
        state.detailStatus = state.selectedSupplier ? "succeeded" : "idle";
      })
      .addMatcher(isAnyOf(createSupplier.rejected, updateSupplier.rejected, deleteSupplier.rejected), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "failed";
        state.mutationError = action.payload ?? failure(action.error);
        state.mutationRequestId = null;
      });
  },
});

export const suppliersReducer = slice.reducer;
export const { resetSuppliers, clearSupplierMutation } = slice.actions;
export function selectSupplier(state: RootState) {
  const suppliers = state.suppliers;
  return {
    ...suppliers,
    filterOptions: suppliers.filterOptions ?? SUPPLIER_FILTER_OPTIONS,
    options: suppliers.options ?? { companies: [] },
  };
}
