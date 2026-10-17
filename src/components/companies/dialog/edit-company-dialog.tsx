"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editCompany, selectCompany, updateCompany } from "@/lib/store/companies-slice";
import type { CompanySummary } from "@/types/companies";

export function EditCompanyDialog({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: (company: CompanySummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedCompany, detailStatus, detailError, mutationStatus, mutationError } =
    useAppSelector(selectCompany);
  const pending = mutationStatus === "loading";
  const company = selectedCompany?.id === companyId ? selectedCompany : null;
  const ready = detailStatus === "succeeded" && company;

  useEffect(() => {
    const request = dispatch(editCompany(companyId));
    return () => request.abort();
  }, [dispatch, companyId]);

  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
          <DialogDescription>
            Update the company name. Existing memberships will stay assigned.
          </DialogDescription>
        </DialogHeader>
        {ready && company ? (
          <EditCompanyFields company={company} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editCompany(companyId))}>
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

function EditCompanyFields({
  company,
  onSaved,
  onCancel,
}: {
  company: CompanySummary;
  onSaved: (company: CompanySummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectCompany);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("Enter a company name.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(updateCompany({ id: company.id, name })).unwrap();
      onSaved(result.company);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not update the company."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={saveCompany} className="space-y-5" aria-busy={pending}>
      <label className="block space-y-2 text-sm font-medium">
        Company name <span className="text-destructive">*</span>
        <Input name="name" defaultValue={company.name} maxLength={160} required placeholder="B1G Fuel Manila" disabled={pending} />
      </label>
      <p className="text-xs text-muted-foreground">
        Use the name your team recognizes. Memberships can be assigned when creating users.
      </p>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button variant="outline" type="button" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
