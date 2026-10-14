"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editCompany, selectCompany } from "@/lib/store/companies-slice";
import type { CompanySummary } from "@/types/companies";
import { CompanyForm } from "./company-form";
import { Loading } from "@/components/common/loading";

export function CompanyDialog({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string | null;
  onClose: () => void;
  onSaved: (company: CompanySummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    selectedCompany,
    detailStatus,
    detailError,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectCompany);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = companyId ? dispatch(editCompany(companyId)) : null;
    return () => request?.abort();
  }, [dispatch, companyId]);
  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [detailError, mutationError, router]);
  const ready =
    !companyId ||
    (detailStatus === "succeeded" && selectedCompany?.id === companyId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {companyId ? "Edit company" : "Create a company"}
          </DialogTitle>
          <DialogDescription>
            {companyId
              ? "Update the company name. Existing memberships will stay assigned."
              : "Add a company to organize your team and user memberships."}
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <CompanyForm
            key={companyId ?? "create"}
            company={companyId ? selectedCompany! : undefined}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {detailError.message}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => dispatch(editCompany(companyId!))}
            >
              Try again
            </Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}
