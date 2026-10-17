"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createProductType, getProductTypeOption, selectProductType } from "@/lib/store/product-types-slice";
import type { ProductTypeSummary } from "@/types/product-types";

export function CreateProductTypeDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (row: ProductTypeSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { optionsStatus, mutationStatus, mutationError } = useAppSelector(selectProductType);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    const request = dispatch(getProductTypeOption());
    return () => request.abort();
  }, [dispatch]);

  useEffect(() => {
    if (mutationError?.status === 401) router.replace("/login");
  }, [mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Create product type</DialogTitle>
          <DialogDescription>Types such as New and Refill are used when creating products.</DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? (
          <CreateProductTypeFields onCancel={onClose} onSaved={onSaved} />
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateProductTypeFields({
  onSaved,
  onCancel,
}: {
  onSaved: (row: ProductTypeSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectProductType);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [companyId, setCompanyId] = useState(options.companies.length === 1 ? options.companies[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin);
  const chooseCompany = !shared && options.companies.length > 1;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a product type name.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(createProductType({
        name: name.trim(),
        key: key.trim() || name.trim(),
        ...(shared || !companyId ? {} : { company_id: companyId }),
      })).unwrap();
      toast.success(`${result.product_type.name} was created successfully.`);
      onSaved(result.product_type);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the product type."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          Name <span className="text-destructive">*</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New" required maxLength={160} />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Key
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="new (optional — derived from name)" maxLength={64} />
        </label>
        {chooseCompany && (
          <label className="block space-y-2 text-sm font-medium">
            Company
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Select a company</option>
              {options.companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending || (!shared && !options.companies.length)}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Create product type"}
        </Button>
      </div>
    </form>
  );
}
