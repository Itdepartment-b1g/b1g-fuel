"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  actionMaterialRequest,
  clearMaterialRequestMutation,
  getMaterialRequest,
} from "@/lib/store/material-requests-slice";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MaterialRequest } from "@/types/material-requests";
import { MaterialRequestDetails } from "../table-view/material-request-details";
import { ReviewMaterialRequestDialog } from "./review-material-request-dialog";

export function ViewMaterialRequestDialog({
  requestId,
  initialAction = "",
  onClose,
  onEdit,
  onDispatch,
  onReceive,
  onChanged,
}: {
  requestId: string;
  initialAction?: "approve" | "reject" | "";
  onClose: () => void;
  onEdit: () => void;
  onDispatch: (request: MaterialRequest) => void;
  onReceive: (request: MaterialRequest) => void;
  onChanged: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { detail, mutation } = useAppSelector(
    (state) => state.materialRequests,
  );
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<"submit" | "cancel" | "">("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const busy = useRef(false);
  const record =
    detail.data?.id === requestId && !detail.loading ? detail.data : null;
  const canAct = action && record?.permissions?.[action];
  const preview = record?.approval_warehouse
    ? { ...record, supplying_warehouse: record.approval_warehouse }
    : record;
  useEffect(() => {
    const request = dispatch(getMaterialRequest(requestId));
    return () => request.abort();
  }, [dispatch, requestId, revision]);

  function openReview(next: "approve" | "reject") {
    dispatch(clearMaterialRequestMutation());
    setAction("");
    setReviewAction(next);
  }
  async function perform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !canAct || mutation.loading || busy.current) return;
    const form = new FormData(event.currentTarget);
    busy.current = true;
    try {
      await dispatch(
        actionMaterialRequest({
          id: requestId,
          action,
          note: String(form.get("note") ?? ""),
        }),
      ).unwrap();
      toast.success(
        action === "submit"
          ? "Material request submitted."
          : "Material request cancelled.",
      );
      setAction("");
      setRevision((value) => value + 1);
      onChanged();
    } catch (error) {
      toast.error(toastErrorMessage(error, "Could not update the request."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !mutation.loading) onClose();
        }}
      >
        <DialogContent
          className={`max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-4xl [&>*]:min-w-0 ${mutation.loading ? "[&>button]:hidden" : ""}`}
          onEscapeKeyDown={(event) => {
            if (mutation.loading) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (mutation.loading) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {record?.request_no ?? "Material request draft"}
            </DialogTitle>
            <DialogDescription>
              {initialAction
                ? `Review the request details and requested items before you ${initialAction}.`
                : "Request details and requested items"}
            </DialogDescription>
          </DialogHeader>
          {detail.error ? (
            <p role="alert">
              {detail.error.message}{" "}
              <Button
                variant="outline"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </p>
          ) : !record || !preview ? (
            <p role="status">Loading request...</p>
          ) : (
            <>
              <MaterialRequestDetails record={preview} fit />
              {record.permissions?.review &&
                record.approval_warehouse_error && (
                  <p role="alert" className="text-sm text-destructive">
                    {record.approval_warehouse_error}{" "}
                    <Button
                      variant="outline"
                      onClick={() => setRevision((value) => value + 1)}
                    >
                      Refresh
                    </Button>
                  </p>
                )}
              <div className="flex flex-wrap gap-2">
                {record.permissions?.edit && (
                  <Button
                    variant="outline"
                    disabled={mutation.loading}
                    onClick={onEdit}
                  >
                    Edit draft
                  </Button>
                )}
                {record.permissions?.submit && (
                  <Button
                    disabled={mutation.loading}
                    onClick={() => setAction("submit")}
                  >
                    Submit request
                  </Button>
                )}
                {record.permissions?.review && (
                  <>
                    {initialAction !== "reject" && (
                      <Button
                        className="w-full"
                        disabled={
                          mutation.loading || !record.approval_warehouse
                        }
                        onClick={() => openReview("approve")}
                      >
                        Approve request
                      </Button>
                    )}
                    {initialAction !== "approve" && (
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled={mutation.loading}
                        onClick={() => openReview("reject")}
                      >
                        Reject request
                      </Button>
                    )}
                  </>
                )}
                {record.permissions?.dispatch && (
                  <Button
                    variant="outline"
                    disabled={mutation.loading}
                    onClick={() => onDispatch(record)}
                  >
                    Dispatch
                  </Button>
                )}
                {record.permissions?.receive && (
                  <Button
                    variant="outline"
                    disabled={mutation.loading}
                    onClick={() => onReceive(record)}
                  >
                    Receive
                  </Button>
                )}
                {record.permissions?.cancel && (
                  <Button
                    variant="outline"
                    disabled={mutation.loading}
                    onClick={() => setAction("cancel")}
                  >
                    Cancel request
                  </Button>
                )}
              </div>
              {action && !canAct && (
                <p role="alert">
                  This request can no longer be{" "}
                  {action === "submit" ? "submitted" : "cancelled"} with your
                  current access.
                </p>
              )}
              {action && canAct && (
                <form
                  key={action}
                  onSubmit={perform}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <h3 className="font-medium capitalize">Confirm {action}</h3>
                  <label className="block space-y-2 text-sm">
                    Note (optional)
                    <Input
                      name="note"
                      maxLength={1000}
                      disabled={mutation.loading}
                    />
                  </label>
                  {mutation.error && (
                    <p role="alert" className="text-sm text-destructive">
                      {mutation.error.message}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutation.loading}
                      onClick={() => setAction("")}
                    >
                      Back
                    </Button>
                    <Button disabled={mutation.loading}>
                      Confirm {action}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
          {/* <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={mutation.loading}
              onClick={onClose}
            >
              Done
            </Button>
          </div> */}
        </DialogContent>
      </Dialog>
      {record && reviewAction && (
        <ReviewMaterialRequestDialog
          key={`${record.id}-${reviewAction}`}
          record={record}
          action={reviewAction}
          onClose={() => setReviewAction(null)}
          onSaved={() => {
            setReviewAction(null);
            setRevision((value) => value + 1);
            onChanged();
          }}
        />
      )}
    </>
  );
}
