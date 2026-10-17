"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearCreateStatus, createUser, selectUser } from "@/lib/store/users-slice";
import type { CreateUserInput, UserSummary } from "@/types/users";

export function CreateUserDialog({ onCreated }: { onCreated: (user: UserSummary) => void }) {
  const dispatch = useAppDispatch();
  const { createStatus } = useAppSelector(selectUser);
  const pending = createStatus === "loading";
  const [open, setOpen] = useState(false);

  function changeOpen(value: boolean) {
    if (pending) return;
    if (value) dispatch(clearCreateStatus());
    setOpen(value);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="size-4" aria-hidden="true" />Add user</Button>
      </DialogTrigger>
      <DialogContent
        className={`max-h-[90svh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Create a user</DialogTitle>
          <DialogDescription>Add an account. Assign a company and roles after the user is created.</DialogDescription>
        </DialogHeader>
        {open && <CreateUserFields onCancel={() => changeOpen(false)} onCreated={(user) => { setOpen(false); onCreated(user); }} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateUserFields({
  onCreated,
  onCancel,
}: {
  onCreated: (user: UserSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const router = useRouter();
  const { createStatus, createError } = useAppSelector(selectUser);
  const pending = createStatus === "loading";
  const busy = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    busy.current = true;
    setFormError(null);
    const input: CreateUserInput = {
      name,
      email: String(form.get("email") ?? "").trim(),
      password,
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
      </fieldset>
      {(formError || createError) && <p role="alert" className="text-sm text-destructive">{formError ?? createError?.message}</p>}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Creating user…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
