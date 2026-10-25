import type { MaterialRequestStatus } from "@/types/material-requests";

export const MATERIAL_REQUEST_PROGRESS_LABEL: Record<MaterialRequestStatus, string> = {
  draft: "Draft",
  submitted: "Pending",
  approved: "Approved",
  partially_dispatched: "Partially Dispatched",
  fully_dispatched: "Fully Dispatched",
  partially_received: "Partially Received",
  received: "Completed",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const MATERIAL_REQUEST_PROGRESS_BADGE: Record<MaterialRequestStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-50 text-amber-800",
  approved: "bg-sky-50 text-sky-800",
  partially_dispatched: "bg-orange-50 text-orange-800",
  fully_dispatched: "bg-indigo-50 text-indigo-800",
  partially_received: "bg-violet-50 text-violet-800",
  received: "bg-emerald-50 text-emerald-800",
  closed: "bg-slate-100 text-slate-600",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
};
