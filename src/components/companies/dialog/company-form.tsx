"use client";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  createCompany,
  updateCompany,
  selectCompany,
} from "@/lib/store/companies-slice";
import type { CompanySummary } from "@/types/companies";

export function CompanyForm({
  company,
  onSaved,
  onCancel,
}: {
  company?: CompanySummary;
  onSaved: (company: CompanySummary, detail?: { locationName?: string }) => void;
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
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const location_name = String(form.get("location_name") ?? "").trim();
    const location_address = String(form.get("location_address") ?? "").trim();
    if (!name) {
      setError("Enter a company name.");
      return;
    }
    if (location_address && !location_name) {
      setError("Enter a warehouse name to save a location.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      if (company) {
        const result = await dispatch(
          updateCompany({ id: company.id, name }),
        ).unwrap();
        onSaved(result.company);
      } else {
        const result = await dispatch(
          createCompany({
            name,
            ...(location_name ? { location_name, location_address } : {}),
          }),
        ).unwrap();
        onSaved(result.company, {
          locationName: result.location?.name,
        });
      }
    } catch (error) {
      toast.error(
        toastErrorMessage(
          error,
          company
            ? "Could not update the company."
            : "Could not create the company.",
        ),
      );
    } finally {
      busy.current = false;
    }
  }
  return (
    <form onSubmit={saveCompany} className="space-y-5" aria-busy={pending}>
      <label className="block space-y-2 text-sm font-medium">
        Company name <span className="text-destructive">*</span>
        <Input
          name="name"
          defaultValue={company?.name}
          maxLength={160}
          required
          placeholder="B1G Fuel Manila"
          disabled={pending}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Use the name your team recognizes. Memberships can be assigned when
        creating users.
      </p>
      {!company && (
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">
            Default warehouse{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <p className="text-xs text-muted-foreground">
            Create a warehouse location under this company now, or add locations
            later from the Locations module.
          </p>
          <label className="block space-y-2 text-sm font-medium">
            Warehouse name
            <Input
              name="location_name"
              maxLength={160}
              placeholder="Central Warehouse"
              disabled={pending}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Warehouse address
            <Input
              name="location_address"
              maxLength={160}
              placeholder="Optional address"
              disabled={pending}
            />
          </label>
        </fieldset>
      )}
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? mutationError?.message}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          variant="outline"
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {pending ? "Saving…" : company ? "Save changes" : "Create company"}
        </Button>
      </div>
    </form>
  );
}
