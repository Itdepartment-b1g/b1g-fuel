"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearCreateStatus, selectUser } from "@/lib/store/users-slice";
import type { UserSummary } from "@/server/schema/users_schema";
import { UserForm } from "./user-form";

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
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button><UserPlus className="size-4" aria-hidden="true" />Add user</Button></DialogTrigger>
    <DialogContent className={`max-h-[90svh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Create a user</DialogTitle><DialogDescription>Add an account. Assign a company and roles after the user is created.</DialogDescription></DialogHeader>
      {open && <UserForm onCancel={() => changeOpen(false)} onCreated={(user) => { setOpen(false); onCreated(user); }} />}
    </DialogContent>
  </Dialog>;
}
