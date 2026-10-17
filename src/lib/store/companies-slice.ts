import type { QuickFilterState } from "@/types/quick-filter";
import { COMPANY_FILTER_OPTIONS } from "@/utils/management-filters";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { CompanySummary, CompaniesPage, CompanyMember, CompanyMembersPage, CompanyResponse, CreateCompanyInput, UpdateCompanyInput, DeleteCompanyResponse } from "@/types/companies";
import { DEFAULT_PAGE_SIZE } from "@/utils/pagination";

export type CompanyFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type CompaniesQuery = { page?: number; page_size?: number; search?: string; sort_by?: string; sort_order?: TableSort["direction"]; filters?: QuickFilterState };
export type CompanyMembersQuery = { id: string; page?: number; page_size?: number };
export type CompaniesState = {
  filterOptions: ManagementFilterOptions; filterOptionsStatus: Status; filterOptionsError: CompanyFailure | null; filterOptionsRequestId: string | null;
  companies: CompanySummary[]; total: number; page: number; page_size: number; selectedCompany: CompanySummary | null;
  members: CompanyMember[]; membersTotal: number; membersPage: number; membersPageSize: number; membersCompanyId: string | null;
  membersStatus: Status; membersError: CompanyFailure | null; membersRequestId: string | null;
  listStatus: Status; detailStatus: Status; mutationStatus: Status; mutationOperation: "create" | "update" | "delete" | null;
  listError: CompanyFailure | null; detailError: CompanyFailure | null; mutationError: CompanyFailure | null;
  listRequestId: string | null; detailRequestId: string | null; mutationRequestId: string | null;
};
const initialState: CompaniesState = { filterOptions: COMPANY_FILTER_OPTIONS, filterOptionsStatus: "idle", filterOptionsError: null, filterOptionsRequestId: null, companies: [], total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE, selectedCompany: null, members: [], membersTotal: 0, membersPage: 1, membersPageSize: DEFAULT_PAGE_SIZE, membersCompanyId: null, membersStatus: "idle", membersError: null, membersRequestId: null, listStatus: "idle", detailStatus: "idle", mutationStatus: "idle", mutationOperation: null, listError: null, detailError: null, mutationError: null, listRequestId: null, detailRequestId: null, mutationRequestId: null };
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
export const listCompanyMembers = createAsyncThunk<
  CompanyMembersPage,
  CompanyMembersQuery,
  Config
>("companies/members", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams({
    id: query.id,
    page: String(query.page ?? 1),
    page_size: String(query.page_size ?? DEFAULT_PAGE_SIZE),
  });
  try {
    return await requestCompany<CompanyMembersPage>(
      `/api/companies/members?${params}`,
      { signal },
    );
  } catch (error) {
    return rejectWithValue(getCompanyError(error));
  }
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
      .addCase(listCompanyMembers.pending, (state, action) => {
        state.membersStatus = "loading";
        state.membersError = null;
        state.membersRequestId = action.meta.requestId;
        if (state.membersCompanyId !== action.meta.arg.id) {
          state.members = [];
          state.membersTotal = 0;
          state.membersCompanyId = action.meta.arg.id;
        }
      })
      .addCase(listCompanyMembers.fulfilled, (state, action) => {
        if (state.membersRequestId !== action.meta.requestId) return;
        state.members = action.payload.members;
        state.membersTotal = action.payload.total;
        state.membersPage = action.payload.page;
        state.membersPageSize = action.payload.page_size;
        state.membersCompanyId = action.meta.arg.id;
        state.membersStatus = "succeeded";
        state.membersRequestId = null;
      })
      .addCase(listCompanyMembers.rejected, (state, action) => {
        if (state.membersRequestId !== action.meta.requestId) return;
        state.membersRequestId = null;
        state.membersStatus = action.meta.aborted ? "idle" : "failed";
        state.membersError = action.meta.aborted
          ? null
          : (action.payload ?? getCompanyError(action.error));
      })
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
