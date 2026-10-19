import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { CompanySupplyPage, CompanySupplyOptions, CompanySupplyResponse, CreateCompanySupplyInput, UpdateCompanySupplyInput, SupplyDirection, SupplyStatus } from "@/types/company-supply";

export type CompanySupplyFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type CompanySupplyQuery = { company_id: string; direction: SupplyDirection; page?: number; page_size?: number; search?: string; status?: SupplyStatus };
type State = {
  page: CompanySupplyPage | null; options: CompanySupplyOptions | null;
  listStatus: Status; optionsStatus: Status; mutationStatus: Status;
  listError: CompanySupplyFailure | null; optionsError: CompanySupplyFailure | null; mutationError: CompanySupplyFailure | null;
  listRequestId: string | null; optionsRequestId: string | null; mutationRequestId: string | null;
  listQuery: CompanySupplyQuery | null; optionsQuery: CompanySupplyQuery | null;
};
const initialState: State = {
  page: null, options: null, listStatus: "idle", optionsStatus: "idle", mutationStatus: "idle",
  listError: null, optionsError: null, mutationError: null,
  listRequestId: null, optionsRequestId: null, mutationRequestId: null, listQuery: null, optionsQuery: null,
};
function failure(error: unknown): CompanySupplyFailure {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number" && "message" in error && typeof error.message === "string")
    return { status: error.status, message: error.message };
  return { status: 0, message: "Unable to reach the API. Please try again." };
}
async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  let data;
  try { data = await response.json(); }
  catch { throw { status: response.status, message: "The API returned an unreadable response." }; }
  if (!response.ok) throw { status: response.status, message: typeof data?.error === "string" ? data.error : "The request failed." };
  return data as T;
}
function queryParams(query: CompanySupplyQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}
type Config = { state: RootState; rejectValue: CompanySupplyFailure };
const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().companySupply.mutationStatus !== "loading";

export const listCompanySupply = createAsyncThunk<CompanySupplyPage, CompanySupplyQuery, Config>("companySupply/list", async (query, { signal, rejectWithValue }) => {
  try { const params = queryParams(query);
    return await request<CompanySupplyPage>(`/api/company-supply-relationships?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});

export const getCompanySupplyOption = createAsyncThunk<CompanySupplyOptions, CompanySupplyQuery, Config>("companySupply/options", async (query, { signal, rejectWithValue }) => {
  try { const params = queryParams(query);
    return await request<CompanySupplyOptions>(`/api/company-supply-relationships/options?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});

export const createCompanySupply = createAsyncThunk<CompanySupplyResponse, CreateCompanySupplyInput, Config>("companySupply/create", async (query, { rejectWithValue }) => {
  try { return await request<CompanySupplyResponse>("/api/company-supply-relationships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

export const updateCompanySupply = createAsyncThunk<CompanySupplyResponse, UpdateCompanySupplyInput, Config>("companySupply/update", async (query, { rejectWithValue }) => {
  try { return await request<CompanySupplyResponse>("/api/company-supply-relationships", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });

const slice = createSlice({
  name: "companySupply", initialState,
  reducers: {
    resetCompanySupply: () => initialState,
    clearCompanySupplyMutation(state) { if (state.mutationStatus !== "loading") { state.mutationStatus = "idle"; state.mutationError = null; } },
  },
  extraReducers(builder) {
    builder
      .addCase(listCompanySupply.pending, (state, action) => {
        state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; state.listQuery = action.meta.arg; state.page = null;
      })
      .addCase(listCompanySupply.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listStatus = "succeeded"; state.page = action.payload; state.listRequestId = null;
      })
      .addCase(listCompanySupply.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listStatus = action.meta.aborted ? "idle" : "failed"; state.listError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.listRequestId = null;
      })
      .addCase(getCompanySupplyOption.pending, (state, action) => {
        state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; state.optionsQuery = action.meta.arg; state.options = null;
      })
      .addCase(getCompanySupplyOption.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsStatus = "succeeded"; state.options = action.payload; state.optionsRequestId = null;
      })
      .addCase(getCompanySupplyOption.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsStatus = action.meta.aborted ? "idle" : "failed"; state.optionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.optionsRequestId = null;
      })
      .addMatcher(isAnyOf(createCompanySupply.pending, updateCompanySupply.pending), (state, action) => { state.mutationStatus = "loading"; state.mutationError = null; state.mutationRequestId = action.meta.requestId; })
      .addMatcher(isAnyOf(createCompanySupply.fulfilled, updateCompanySupply.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded"; state.mutationRequestId = null;
        state.listRequestId = null; state.optionsRequestId = null; state.listStatus = "idle"; state.optionsStatus = "idle";
      })
      .addMatcher(isAnyOf(createCompanySupply.rejected, updateCompanySupply.rejected), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "failed"; state.mutationError = action.payload ?? failure(action.error); state.mutationRequestId = null;
      });
  },
});
export const companySupplyReducer = slice.reducer;
export const { resetCompanySupply, clearCompanySupplyMutation } = slice.actions;
export const selectCompanySupply = (state: RootState) => state.companySupply;
