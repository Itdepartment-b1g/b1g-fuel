import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { TableSort } from "@/types/table-views";
import type { CreateMeasurementInput, DeleteMeasurementResponse, MeasurementOptions, MeasurementResponse, MeasurementSummary, MeasurementsPage, UpdateMeasurementInput } from "@/types/measurements";

export type MeasurementFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type MeasurementsQuery = { page?: number; page_size?: number; search?: string; company_id?: string; sort_by?: string; sort_order?: TableSort["direction"] };
type State = {
  measurements: MeasurementSummary[]; total: number; selectedMeasurement: MeasurementSummary | null;
  options: MeasurementOptions;
  listStatus: Status; detailStatus: Status; optionsStatus: Status; mutationStatus: Status;
  listError: MeasurementFailure | null; detailError: MeasurementFailure | null; optionsError: MeasurementFailure | null; mutationError: MeasurementFailure | null;
  listRequestId: string | null; detailRequestId: string | null; optionsRequestId: string | null; mutationRequestId: string | null;
};
const initialState: State = {
  measurements: [], total: 0, selectedMeasurement: null, options: { companies: [] },
  listStatus: "idle", detailStatus: "idle", optionsStatus: "idle", mutationStatus: "idle",
  listError: null, detailError: null, optionsError: null, mutationError: null,
  listRequestId: null, detailRequestId: null, optionsRequestId: null, mutationRequestId: null,
};
function failure(error: unknown): MeasurementFailure {
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
type Config = { state: RootState; rejectValue: MeasurementFailure };
export const listMeasurement = createAsyncThunk<MeasurementsPage, MeasurementsQuery, Config>("measurements/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  try { return await request<MeasurementsPage>(`/api/measurements?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const editMeasurement = createAsyncThunk<MeasurementResponse, string, Config>("measurements/detail", async (id, { signal, rejectWithValue }) => {
  try { return await request<MeasurementResponse>(`/api/measurements?id=${encodeURIComponent(id)}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getMeasurementOption = createAsyncThunk<MeasurementOptions, void, Config>("measurements/options", async (_, { signal, rejectWithValue }) => {
  try { return await request<MeasurementOptions>("/api/measurements/options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().measurements.mutationStatus !== "loading";
export const createMeasurement = createAsyncThunk<MeasurementResponse, CreateMeasurementInput, Config>("measurements/create", async (input, { rejectWithValue }) => {
  try { return await request<MeasurementResponse>("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const updateMeasurement = createAsyncThunk<MeasurementResponse, UpdateMeasurementInput, Config>("measurements/update", async (input, { rejectWithValue }) => {
  try { return await request<MeasurementResponse>("/api/measurements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const deleteMeasurement = createAsyncThunk<DeleteMeasurementResponse, string, Config>("measurements/delete", async (id, { rejectWithValue }) => {
  try { return await request<DeleteMeasurementResponse>(`/api/measurements?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
const slice = createSlice({
  name: "measurements", initialState,
  reducers: {
    resetMeasurements: () => initialState,
    clearMeasurementMutation(state) { if (state.mutationStatus !== "loading") { state.mutationStatus = "idle"; state.mutationError = null; } },
  },
  extraReducers(builder) {
    builder
      .addCase(listMeasurement.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listMeasurement.fulfilled, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.measurements = action.payload.measurements; state.total = action.payload.total; state.listStatus = "succeeded"; state.listRequestId = null; })
      .addCase(listMeasurement.rejected, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.listStatus = action.meta.aborted ? "idle" : "failed"; state.listError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.listRequestId = null; })
      .addCase(editMeasurement.pending, (state, action) => { state.detailStatus = "loading"; state.selectedMeasurement = null; state.detailError = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editMeasurement.fulfilled, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.selectedMeasurement = action.payload.measurement; state.detailStatus = "succeeded"; state.detailRequestId = null; })
      .addCase(editMeasurement.rejected, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.detailStatus = action.meta.aborted ? "idle" : "failed"; state.detailError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.detailRequestId = null; })
      .addCase(getMeasurementOption.pending, (state, action) => { state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; })
      .addCase(getMeasurementOption.fulfilled, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.options = action.payload; state.optionsStatus = "succeeded"; state.optionsRequestId = null; })
      .addCase(getMeasurementOption.rejected, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.optionsStatus = action.meta.aborted ? "idle" : "failed"; state.optionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.optionsRequestId = null; })
      .addMatcher(isAnyOf(createMeasurement.pending, updateMeasurement.pending, deleteMeasurement.pending), (state, action) => { state.mutationStatus = "loading"; state.mutationError = null; state.mutationRequestId = action.meta.requestId; })
      .addMatcher(isAnyOf(createMeasurement.fulfilled, updateMeasurement.fulfilled, deleteMeasurement.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded"; state.mutationRequestId = null;
        // Invalidate outstanding reads so an older response cannot overwrite a successful change.
        state.listRequestId = null; state.listStatus = "idle"; state.listError = null;
        state.detailRequestId = null; state.detailError = null;
        if ("measurement" in action.payload) state.selectedMeasurement = action.payload.measurement;
        else state.selectedMeasurement = null;
        state.detailStatus = state.selectedMeasurement ? "succeeded" : "idle";
      })
      .addMatcher(isAnyOf(createMeasurement.rejected, updateMeasurement.rejected, deleteMeasurement.rejected), (state, action) => { if (state.mutationRequestId !== action.meta.requestId) return; state.mutationStatus = "failed"; state.mutationError = action.payload ?? failure(action.error); state.mutationRequestId = null; });
  },
});
export const measurementsReducer = slice.reducer;
export const { resetMeasurements, clearMeasurementMutation } = slice.actions;
export const selectMeasurement = (state: RootState) => state.measurements;
