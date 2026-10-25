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
import { useRecordAccess } from "@/components/providers/access-provider";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  createBrand,
  getBrandOption,
  selectBrand,
} from "@/lib/store/brands-slice";
import type { BrandSummary } from "@/types/brands";

export function CreateBrandDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (brand: BrandSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const {
    optionsStatus,
    optionsError,
    options,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectBrand);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    const request = dispatch(getBrandOption());
    return () => request.abort();
  }, [dispatch]);

  useEffect(() => {
    if ([optionsError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [optionsError, mutationError, router]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create a brand</DialogTitle>
          <DialogDescription>
            Name the brand people will use for variants.
          </DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? (
          !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">
              No companies are available for creating brands. Ask an
              administrator to check your company access.
            </p>
          ) : (
            <CreateBrandFields onCancel={onClose} onSaved={onSaved} />
          )
        ) : optionsError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {optionsError.message}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => dispatch(getBrandOption())}
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

function CreateBrandFields({
  onSaved,
  onCancel,
}: {
  onSaved: (brand: BrandSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } =
    useAppSelector(selectBrand);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(
    options.companies.length === 1 ? options.companies[0].id : "",
  );
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin);
  const chooseCompany = !shared && options.companies.length > 1;
  const suppliers = options.suppliers.filter(
    (supplier) =>
      !supplier.company_id ||
      (Boolean(companyId) && supplier.company_id === companyId),
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a brand name.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
      return;
    }
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(
        createBrand({
          ...(shared || !companyId ? {} : { company_id: companyId }),
          supplier_id: supplierId,
          name: name.trim(),
        }),
      ).unwrap();
      toast.success(`${result.brand.name} was created successfully.`);
      onSaved(result.brand);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the brand."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="space-y-2 text-sm font-medium">
          Supplier
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            required
            className="h-10 w-full rounded-md border bg-white px-3 text-sm"
          >
            <option value="">Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Brand name
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Shell"
            required
            maxLength={160}
          />
        </label>
        {chooseCompany && (
          <label className="space-y-2 text-sm font-medium">
            Company
            <select
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setSupplierId("");
              }}
              required
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="">Select a company</option>
              {options.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? mutationError?.message}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending || (!shared && !options.companies.length)}
        >
          {pending && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {pending ? "Saving…" : "Create brand"}
        </Button>
      </div>
    </form>
  );
}
