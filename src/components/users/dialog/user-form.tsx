"use client";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createUser, getUserOption, selectUser } from "@/lib/store/users-slice";
import type { CreateUserInput, UserSummary } from "@/server/schema/users_schema";

export function UserForm({ onCreated, onCancel }: { onCreated: (user: UserSummary) => void; onCancel: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const router = useRouter();
  const { options, optionsStatus, optionsError, createStatus, createError } = useAppSelector(selectUser);
  const pending = createStatus === "loading";
  const busy = useRef(false);
  const [companyId, setCompanyId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    const request = dispatch(getUserOption());
    return () => request.abort();
  }, [dispatch]);
  useEffect(() => {
    if (optionsError?.status === 401) router.replace("/login");
  }, [optionsError, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirm_password")) { setFormError("The passwords do not match."); return; }
    const name = String(form.get("name") ?? "").trim();
    if (!name) { setFormError("Enter the user's name."); return; }
    busy.current = true; setFormError(null);
    const input: CreateUserInput = {
      name, email: String(form.get("email") ?? "").trim(), password,
      ...(companyId ? { company_id: companyId, ...(roleIds.length ? { role_ids: roleIds } : {}) } : {}),
    };
    try { onCreated(await dispatch(createUser(input))); }
    catch (error) {
      toast.error(toastErrorMessage(error, "Could not create the user."));
      if (error && typeof error === "object" && "status" in error && error.status === 401) router.replace("/login");
    } finally { busy.current = false; }
  }
  const companyRoles = options.roles.filter((role) => !role.company_id || role.company_id === companyId);
  const field = "space-y-2";
  const label = "block text-sm font-medium";
  return <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
    <fieldset disabled={pending} className="space-y-5">
      <div className={field}><label htmlFor="user-name" className={label}>Full name <span className="text-destructive">*</span></label><Input id="user-name" name="name" placeholder="Juan Dela Cruz" autoComplete="name" maxLength={250} required /></div>
      <div className={field}><label htmlFor="user-email" className={label}>Email address <span className="text-destructive">*</span></label><Input id="user-email" name="email" type="email" placeholder="juan@example.com" autoComplete="off" maxLength={254} required /><p className="text-xs text-muted-foreground">Use their Google email if they will sign in with Google.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}><label htmlFor="user-password" className={label}>Password <span className="text-destructive">*</span></label><div className="relative"><Input id="user-password" name="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} maxLength={128} required className="pr-10" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground">{showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button></div></div>
        <div className={field}><label htmlFor="user-confirm-password" className={label}>Confirm password <span className="text-destructive">*</span></label><Input id="user-confirm-password" name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required /></div>
      </div>
      <div className="rounded-lg border bg-slate-50/70 p-4">
        <p className="mb-1 text-sm font-medium">Company and roles <span className="font-normal text-muted-foreground">(optional)</span></p>
        <p className="mb-4 text-xs text-muted-foreground">You can create this account without any assignments.</p>
        <div className={field}><label htmlFor="user-company" className={label}>Company</label><select id="user-company" value={companyId} disabled={optionsStatus !== "succeeded"} onChange={(event) => { setCompanyId(event.target.value); setRoleIds([]); }} className="h-10 w-full rounded-md border bg-white px-3 text-sm disabled:opacity-50"><option value="">No company assigned</option>{options.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
        {optionsStatus === "loading" && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading companies and roles…</p>}
        {optionsError && <div className="mt-3"><p role="alert" className="text-xs text-destructive">Assignments could not be loaded. You can still create an unassigned account.</p><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => dispatch(getUserOption())}>Retry loading assignments</Button></div>}
        {optionsStatus === "succeeded" && !options.companies.length && <p className="mt-3 text-xs text-muted-foreground">No companies have been created yet.</p>}
        {companyId && <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">Company roles</legend>{companyRoles.length ? <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border bg-white p-3">{companyRoles.map((role) => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roleIds.includes(role.id)} onChange={(event) => setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} className="size-4 accent-primary" />{role.name}</label>)}</div> : <p className="text-xs text-muted-foreground">No company roles are available. The membership can be created without roles.</p>}</fieldset>}
      </div>
    </fieldset>
    {(formError || createError) && <p role="alert" className="text-sm text-destructive">{formError ?? createError?.message}</p>}
    <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Creating user…" : "Create user"}</Button></div>
  </form>;
}
