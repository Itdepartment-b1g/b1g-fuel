"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess, useRefreshRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { ACCESS_SCOPE_LABELS, STAFF_ACCESS_SCOPES, type AccessScope } from "@/lib/auth/access-scope";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { staff_role_slug } from "@/lib/auth/role-slug";
import { clearCreateStatus, createUser, getUserOption, selectUser } from "@/lib/store/users-slice";
import type { AssignableRole, CreateUserInput, UserSummary } from "@/types/users";

function staffScope(scope: AccessScope | undefined) {
  return scope === "own" ? "own" : "company";
}

function applyStaffRole(role: AssignableRole, actorPages: string[]) {
  const pages = role.pages.filter((key) => key !== "users" && actorPages.includes(key));
  const permissions = role.permissions.filter((key) => pages.some((page) => key.startsWith(`${page}.`)));
  return {
    pages,
    permissions,
    scopes: Object.fromEntries(permissions.filter((key) => !key.endsWith(".add")).map((key) => [key, staffScope(role.permission_scopes[key])])) as Record<string, AccessScope>,
  };
}

function toggleKey(keys: string[], key: string, checked: boolean) {
  return checked ? [...keys, key] : keys.filter((item) => item !== key);
}

export function CreateUserDialog({ onCreated }: { onCreated: (user: UserSummary) => void }) {
  const access = useRecordAccess();
  const refreshAccess = useRefreshRecordAccess();
  const supervisor = Boolean(access && !access.superAdmin);
  const dispatch = useAppDispatch();
  const { createStatus } = useAppSelector(selectUser);
  const pending = createStatus === "loading";
  const [open, setOpen] = useState(false);

  function changeOpen(value: boolean) {
    if (pending) return;
    if (value) { void refreshAccess(); dispatch(clearCreateStatus()); }
    setOpen(value);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button className="w-full lg:w-auto"><UserPlus className="size-4" aria-hidden="true" />Add user</Button>
      </DialogTrigger>
      <DialogContent
        className={`max-h-[90svh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{supervisor ? "Create staff" : "Create a user"}</DialogTitle>
          <DialogDescription>
            {supervisor
              ? "Add a staff account in your company, choose their role, and choose the dashboards they can open."
              : "Add an account. Assign a company and roles after the user is created."}
          </DialogDescription>
        </DialogHeader>
        {open && <CreateUserFields supervisor={supervisor} actorPages={access?.pages ?? []} onCancel={() => changeOpen(false)} onCreated={(user) => { setOpen(false); onCreated(user); }} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateUserFields({
  supervisor,
  actorPages,
  onCreated,
  onCancel,
}: {
  supervisor: boolean;
  actorPages: string[];
  onCreated: (user: UserSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const router = useRouter();
  const { createStatus, createError, options, optionsStatus, optionsError } = useAppSelector(selectUser);
  const pending = createStatus === "loading";
  const busy = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [roleChoice, setRoleChoice] = useState("new");
  const [roleName, setRoleName] = useState("");
  const [pageKeys, setPageKeys] = useState<string[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [permissionScopes, setPermissionScopes] = useState<Record<string, AccessScope>>({});
  const pickedRole = useRef(false);
  const staffRoles = useMemo(() => options.roles
    .filter((role) => role.company_id?.toLowerCase() === companyId.toLowerCase() && !role.pages.includes("users"))
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at)), [options.roles, companyId]);
  const selectedRole = staffRoles.find((role) => role.id === roleChoice);
  const pages = PAGE_CATALOG.filter((page) => page.key !== "users" && actorPages.includes(page.key) && (!selectedRole || selectedRole.pages.includes(page.key)));
  const slug = staff_role_slug(roleName);
  const creatingRole = roleChoice === "new";

  useEffect(() => {
    if (!supervisor) return;
    const request = dispatch(getUserOption());
    return () => request.abort();
  }, [dispatch, supervisor]);

  useEffect(() => {
    if (!supervisor || options.companies.length !== 1) return;
    setCompanyId(options.companies[0].id);
  }, [supervisor, options.companies]);

  useEffect(() => {
    if (!supervisor || !companyId || pickedRole.current || optionsStatus !== "succeeded") return;
    const latest = staffRoles[0];
    if (!latest) return;
    pickedRole.current = true;
    const access = applyStaffRole(latest, actorPages);
    setRoleChoice(latest.id);
    setPageKeys(access.pages);
    setPermissionKeys(access.permissions);
    setPermissionScopes(access.scopes);
  }, [supervisor, companyId, optionsStatus, staffRoles, actorPages]);

  function chooseRole(next: string) {
    pickedRole.current = true;
    setRoleChoice(next);
    const role = staffRoles.find((item) => item.id === next);
    if (!role) {
      setRoleName("");
      setPageKeys([]);
      setPermissionKeys([]);
      setPermissionScopes({});
      return;
    }
    const access = applyStaffRole(role, actorPages);
    setPageKeys(access.pages);
    setPermissionKeys(access.permissions);
    setPermissionScopes(access.scopes);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirm_password")) {
      setFormError("The passwords do not match.");
      return;
    }
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setFormError("Enter the user's name.");
      return;
    }
    if (supervisor && !companyId) {
      setFormError("Select the company.");
      return;
    }
    if (supervisor && creatingRole && !roleName.trim()) {
      setFormError("Enter a role name.");
      return;
    }
    if (supervisor && creatingRole && !slug) {
      setFormError("Enter a role name using letters or numbers.");
      return;
    }
    if (supervisor && !creatingRole && !selectedRole) {
      setFormError("Select a role.");
      return;
    }
    busy.current = true;
    setFormError(null);
    const input: CreateUserInput = {
      name,
      email: String(form.get("email") ?? "").trim(),
      password,
      ...(supervisor ? {
        company_id: companyId,
        ...(creatingRole ? { role_name: roleName.trim() } : { role_id: roleChoice }),
        page_keys: pageKeys,
        permissions: permissionKeys,
        permission_scopes: Object.fromEntries(permissionKeys.filter((key) => !key.endsWith(".add")).map((key) => [key, staffScope(permissionScopes[key])])),
      } : {}),
    };
    try {
      onCreated(await dispatch(createUser(input)));
    } catch (error) {
      toast.error(toastErrorMessage(error, "Could not create the user."));
      if (error && typeof error === "object" && "status" in error && error.status === 401) router.replace("/login");
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="user-name" className="block text-sm font-medium">Full name <span className="text-destructive">*</span></label>
          <Input id="user-name" name="name" placeholder="Juan Dela Cruz" autoComplete="name" maxLength={250} required />
        </div>
        <div className="space-y-2">
          <label htmlFor="user-email" className="block text-sm font-medium">Email address <span className="text-destructive">*</span></label>
          <Input id="user-email" name="email" type="email" placeholder="juan@example.com" autoComplete="off" maxLength={254} required />
          <p className="text-xs text-muted-foreground">Use their Google email if they will sign in with Google.</p>
        </div>
        {supervisor && (
          <>
            <label className="block space-y-2 text-sm font-medium">
              Company <span className="text-destructive">*</span>
              <select
                aria-label="Staff company"
                value={companyId}
                disabled={pending || options.companies.length <= 1}
                onChange={(event) => setCompanyId(event.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm disabled:opacity-70"
              >
                <option value="">Select a company</option>
                {options.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            {optionsStatus === "loading" && <p role="status" className="text-xs text-muted-foreground">Loading company…</p>}
            {optionsError && (
              <div>
                <p role="alert" className="text-xs text-destructive">Company could not be loaded.</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => dispatch(getUserOption())}>Retry</Button>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="staff-role-name" className="block text-sm font-medium">Role name <span className="text-destructive">*</span></label>
              <Input
                id="staff-role-name"
                name="role_name"
                value={selectedRole ? selectedRole.name : roleName}
                readOnly={Boolean(selectedRole)}
                onChange={(event) => {
                  if (!creatingRole) chooseRole("new");
                  setRoleName(event.target.value);
                }}
                placeholder="Warehouse Staff"
                maxLength={100}
                required={creatingRole}
              />
              <p className="text-xs text-muted-foreground">
                {selectedRole ? "This role already exists and will be reused." : slug ? `Slug: ${slug}` : "Use letters or numbers. Warehouse Staff becomes warehouse_staff."}
              </p>
              {staffRoles.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">Choose a role this company already has.</p>
                  <div role="group" aria-label="Existing roles" className="flex flex-wrap gap-2 border-gray-200 border rounded-md p-3">
                    {staffRoles.map((role) => {
                      const selected = role.id === roleChoice;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={pending}
                          onClick={() => chooseRole(selected ? "new" : role.id)}
                          className={`rounded-full border px-3 py-1 text-sm ${selected ? "border-primary bg-primary/10 font-medium text-primary" : "bg-white text-foreground hover:bg-slate-50"}`}
                        >
                          {role.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="user-password" className="block text-sm font-medium">Password <span className="text-destructive">*</span></label>
            <div className="relative">
              <Input id="user-password" name="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} maxLength={128} required className="pr-10" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground">
                {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="user-confirm-password" className="block text-sm font-medium">Confirm password <span className="text-destructive">*</span></label>
            <Input id="user-confirm-password" name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
          </div>
        </div>
        {supervisor && (
          <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Pages and permissions</legend>
              <p className="text-xs text-muted-foreground">Select a page, then choose what this role can do on that page.</p>
              {pages.length ? pages.map((page) => {
                const choices = PERMISSION_CATALOG.filter((item) => item.page_key === page.key && (!selectedRole || selectedRole.permissions.includes(item.key)));
                const selected = pageKeys.includes(page.key);
                return (
                  <div key={page.key} className="rounded-lg border">
                    <label className="flex cursor-pointer items-center gap-3 p-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={pending}
                        onChange={(event) => {
                          setPageKeys((current) => toggleKey(current, page.key, event.target.checked));
                          if (!event.target.checked) setPermissionKeys((current) => current.filter((key) => !choices.some((choice) => choice.key === key)));
                        }}
                        className="size-4 accent-primary"
                      />
                      {page.label}
                    </label>
                    {selected && (
                      <details open className="border-t px-3 py-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground">Permissions for {page.label}</summary>
                        <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-5">
                          {choices.map((choice) => (
                            <div key={choice.key} className="space-y-2">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={permissionKeys.includes(choice.key)}
                                  disabled={pending}
                                  onChange={(event) => setPermissionKeys((current) => toggleKey(current, choice.key, event.target.checked))}
                                  className="size-4 accent-primary"
                                />
                                {choice.label}
                              </label>
                              {choice.action !== "add" && permissionKeys.includes(choice.key) && (
                                <select
                                  aria-label={`${page.label} ${choice.label} access scope`}
                                  value={staffScope(permissionScopes[choice.key])}
                                  disabled={pending}
                                  onChange={(event) => setPermissionScopes((current) => ({ ...current, [choice.key]: event.target.value as AccessScope }))}
                                  className="h-9 w-full rounded-md border bg-white px-2 text-xs"
                                >
                                  {STAFF_ACCESS_SCOPES.map((value) => <option key={value} value={value}>{ACCESS_SCOPE_LABELS[value]}</option>)}
                                </select>
                              )}
                              {choice.action === "add" && permissionKeys.includes(choice.key) && <p className="text-xs text-muted-foreground">Creator is set to the signed-in user.</p>}
                            </div>
                          ))}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={choices.length > 0 && choices.every((choice) => permissionKeys.includes(choice.key))}
                                disabled={pending}
                                onChange={(event) => {
                                  const keys = choices.map((choice) => choice.key);
                                  setPermissionKeys((current) => event.target.checked ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.includes(key)));
                                }}
                                className="size-4 accent-primary"
                              />
                              All
                            </label>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground">No pages available.</p>}
          </fieldset>
        )}
      </fieldset>
      {(formError || createError) && <p role="alert" className="text-sm text-destructive">{formError ?? createError?.message}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending || (supervisor && (!companyId || (creatingRole && !roleName.trim())))}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Creating user…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
