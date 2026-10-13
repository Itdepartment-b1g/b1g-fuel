"use client";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createCompany, updateCompany, selectCompany } from "@/lib/store/companies-slice";
import type { CompanySummary } from "@/server/schema/companies_schema";

export function CompanyForm({ company, onSaved, onCancel }: { company?: CompanySummary; onSaved: (company: CompanySummary) => void; onCancel: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast(); const { mutationStatus, mutationError } = useAppSelector(selectCompany); const pending = mutationStatus === "loading";
  const busy = useRef(false); const [error, setError] = useState<string | null>(null);
  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) { setError("Enter a company name."); return; }
    busy.current = true; setError(null);
    try { const result = company ? await dispatch(updateCompany({ id: company.id, name })).unwrap() : await dispatch(createCompany({ name })).unwrap(); onSaved(result.company); }
    catch (error) { toast.error(toastErrorMessage(error, company ? "Could not update the company." : "Could not create the company.")); } finally { busy.current = false; }
  }
  return <form onSubmit={saveCompany} className="space-y-5" aria-busy={pending}><label className="block space-y-2 text-sm font-medium">Company name <span className="text-destructive">*</span><Input name="name" defaultValue={company?.name} maxLength={160} required placeholder="B1G Fuel Manila" disabled={pending} /></label><p className="text-xs text-muted-foreground">Use the name your team recognizes. Memberships can be assigned when creating users.</p>{(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}<div className="flex justify-end gap-3 border-t pt-4"><Button variant="outline" type="button" disabled={pending} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Saving…" : company ? "Save changes" : "Create company"}</Button></div></form>;
}
