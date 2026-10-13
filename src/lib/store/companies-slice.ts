import type { QuickFilterState } from "@/lib/quick-filter";
import { COMPANY_FILTER_OPTIONS, type ManagementFilterOptions } from "@/lib/management-filters";
import type { TableSort } from "@/lib/table";
import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { CompanySummary, CompaniesPage, CompanyResponse, CreateCompanyInput, UpdateCompanyInput, DeleteCompanyResponse } from "@/server/schema/companies_schema";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export type CompanyFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type CompaniesQuery = { page?: number; page_size?: number; search?: string; sort_by?: string; sort_order?: TableSort["direction"]; filters?: QuickFilterState };
export type CompaniesState = {
  filterOptions: ManagementFilterOptions; filterOptionsStatus: Status; filterOptionsError: CompanyFailure | null; filterOptionsRequestId: string | null;
  companies: CompanySummary[]; total: number; page: number; page_size: number; selectedCompany: CompanySummary | null;
  listStatus: Status; detailStatus: Status; mutationStatus: Status; mutationOperation: "create" | "update" | "delete" | null;
  listError: CompanyFailure | null; detailError: CompanyFailure | null; mutationError: CompanyFailure | null;
  listRequestId: string | null; detailRequestId: string | null; mutationRequestId: string | null;
};
const initialState: CompaniesState = { filterOptions: COMPANY_FILTER_OPTIONS, filterOptionsStatus: "idle", filterOptionsError: null, filterOptionsRequestId: null, companies: [], total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE, selectedCompany: null, listStatus: "idle", detailStatus: "idle", mutationStatus: "idle", mutationOperation: null, listError: null, detailError: null, mutationError: null, listRequestId: null, detailRequestId: null, mutationRequestId: null };
function getCompanyError(error: unknown): CompanyFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") return { status: error.status, message: error.message };
  return { status: 0, message: "Unable to reach the API. Please try again." };
}
async function requestCompany<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  let data;
  try { data = await response.json(); } catch { throw { status: response.status, message: "The API returned an unreadable response." } satisfies CompanyFailure; }
  if (!response.ok) throw { status: response.status, message: typeof data?.error === "string" ? data.error : "The request failed." } satisfies CompanyFailure;
  return data as T;
}
type Config = { state: RootState; rejectValue: CompanyFailure };
export const listCompany = createAsyncThunk<CompaniesPage, CompaniesQuery | undefined, Config>("companies/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams(); for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== "") params.set(key, key === "filters" ? JSON.stringify(value) : String(value));
  try { return await requestCompany<CompaniesPage>(`/api/companies?${params}`, { signal }); } catch (error) { return rejectWithValue(getCompanyError(error)); }
});
export const getCompanyFilterOption = createAsyncThunk<ManagementFilterOptions, void, Config>("companies/filter-options", async (_, { signal, rejectWithValue }) => {
  try { return await requestCompany<ManagementFilterOptions>("/api/companies/filter-options", { signal }); }
  catch (error) { return rejectWithValue(getCompanyError(error)); }
});
export const editCompany = createAsyncThunk<CompanyResponse, string, Config>("companies/edit", async (id, { signal, rejectWithValue }) => {
  try { return await requestCompany<CompanyResponse>(`/api/companies?id=${encodeURIComponent(id)}`, { signal }); } catch (error) { return rejectWithValue(getCompanyError(error)); }
});
const canMutateCompany = (_: unknown, { getState }: { getState: () => RootState }) => getState().companies.mutationStatus !== "loading";
export const createCompany = createAsyncThunk<CompanyResponse, CreateCompanyInput, Config>("companies/create", async (input, { rejectWithValue }) => {
  try { return await requestCompany<CompanyResponse>("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); } catch (error) { return rejectWithValue(getCompanyError(error)); }
}, { condition: canMutateCompany });
export const updateCompany = createAsyncThunk<CompanyResponse, UpdateCompanyInput, Config>("companies/update", async (input, { rejectWithValue }) => {
  try { return await requestCompany<CompanyResponse>("/api/companies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); } catch (error) { return rejectWithValue(getCompanyError(error)); }
}, { condition: canMutateCompany });
export const deleteCompany = createAsyncThunk<DeleteCompanyResponse, string, Config>("companies/delete", async (id, { rejectWithValue }) => {
  try { return await requestCompany<DeleteCompanyResponse>(`/api/companies?id=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch (error) { return rejectWithValue(getCompanyError(error)); }
}, { condition: canMutateCompany });
const companiesSlice = createSlice({
  name: "companies", initialState,
  reducers: {
    resetCompanies: () => initialState,
    clearCompanyMutation(state) { if (state.mutationStatus === "loading") return; state.mutationStatus = "idle"; state.mutationError = null; state.mutationOperation = null; },
  },
  extraReducers(builder) {
    builder.addCase(getCompanyFilterOption.pending, (state, action) => { state.filterOptionsStatus = "loading"; state.filterOptionsError = null; state.filterOptionsRequestId = action.meta.requestId; })
      .addCase(getCompanyFilterOption.fulfilled, (state, action) => { if (state.filterOptionsRequestId !== action.meta.requestId) return; state.filterOptions = action.payload; state.filterOptionsStatus = "succeeded"; state.filterOptionsRequestId = null; })
      .addCase(getCompanyFilterOption.rejected, (state, action) => { if (state.filterOptionsRequestId !== action.meta.requestId) return; state.filterOptionsRequestId = null; state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed"; state.filterOptionsError = action.meta.aborted ? null : action.payload ?? getCompanyError(action.error); })
      .addCase(listCompany.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listCompany.fulfilled, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; Object.assign(state, action.payload); state.listStatus = "succeeded"; state.listRequestId = null; })
      .addCase(listCompany.rejected, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.listRequestId = null; state.listStatus = action.meta.aborted ? "idle" : "failed"; state.listError = action.meta.aborted ? null : action.payload ?? getCompanyError(action.error); })
      .addCase(editCompany.pending, (state, action) => { state.detailStatus = "loading"; state.detailError = null; state.selectedCompany = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editCompany.fulfilled, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.detailStatus = "succeeded"; state.selectedCompany = action.payload.company; state.detailRequestId = null; })
      .addCase(editCompany.rejected, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.detailRequestId = null; state.detailStatus = action.meta.aborted ? "idle" : "failed"; state.detailError = action.meta.aborted ? null : action.payload ?? getCompanyError(action.error); })
      .addMatcher(isAnyOf(createCompany.pending, updateCompany.pending, deleteCompany.pending), (state, action) => { state.mutationRequestId = action.meta.requestId; state.mutationStatus = "loading"; state.mutationError = null; state.mutationOperation = action.type === createCompany.pending.type ? "create" : action.type === updateCompany.pending.type ? "update" : "delete"; })
      .addMatcher(isAnyOf(createCompany.fulfilled, updateCompany.fulfilled, deleteCompany.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationRequestId = null; state.mutationStatus = "succeeded"; state.listStatus = "idle"; state.listRequestId = null; state.listError = null; state.detailRequestId = null; state.detailError = null;
        if ("company" in action.payload) { if (state.selectedCompany?.id === action.payload.company.id) state.selectedCompany = action.payload.company; }
        else if (state.selectedCompany?.id === action.payload.id) state.selectedCompany = null;
        state.detailStatus = state.selectedCompany ? "succeeded" : "idle";
      }).addMatcher(isAnyOf(createCompany.rejected, updateCompany.rejected, deleteCompany.rejected), (state, action) => { if (state.mutationRequestId !== action.meta.requestId) return; state.mutationRequestId = null; state.mutationStatus = "failed"; state.mutationError = action.payload ?? getCompanyError(action.error); });
  },
});
export const companiesReducer = companiesSlice.reducer;
export const { resetCompanies, clearCompanyMutation } = companiesSlice.actions;
export const selectCompany = (state: RootState) => state.companies;
