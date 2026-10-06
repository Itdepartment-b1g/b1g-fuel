"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_PATHS } from "@/lib/auth/dashboard";
import { get_side_bar_menu_items, sideBarMenuItems, type SideBarAccess } from "./sideBarMenuItems";

type AppSideBarProps = SideBarAccess & {
  open?: boolean;
  onClose?: () => void;
};

const noop = () => {};

export default function AppSideBar({ open = false, onClose = noop, pages, permissions, role }: AppSideBarProps = {}) {
  const pathname = usePathname();
  const signingOut = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (signingOut.current) return;
    signingOut.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to sign out. Please try again.");
      window.location.replace("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
      signingOut.current = false;
      setLoading(false);
    }
  }
  const items = pages === undefined
    ? sideBarMenuItems
    : get_side_bar_menu_items(pages, { pages, permissions, role });
  const isActive = (href: string) => pathname === href || (href !== APP_PATHS.home && pathname.startsWith(`${href}/`));
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", handleChange);
    return () => desktop.removeEventListener("change", handleChange);
  }, [onClose]);

  const menu = items.length > 0 ? (
    <nav aria-label="Sidebar navigation" className="p-3">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={`${item.label}:${item.href}`}>
              {item.children?.length ? (
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true"><Icon className="size-4 shrink-0" /></span>
                    <span className="flex-1">{item.label}</span>
                    {item.showChevron && <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />}
                  </summary>
                  <ul className="ml-5 mt-1 space-y-1 border-l pl-3">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link href={child.href} onClick={onClose} aria-current={isActive(child.href) ? "page" : undefined} className={cn("block rounded-md px-3 py-2 text-sm hover:bg-accent", isActive(child.href) && "bg-accent font-medium")}>
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <Link href={item.href} onClick={onClose} aria-current={isActive(item.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent", isActive(item.href) && "bg-accent font-medium")}>
                  <span aria-hidden="true"><Icon className="size-4 shrink-0" /></span>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  ) : null;

  const footer = (
    <div className="shrink-0 border-t p-3">
      {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
      <Button type="button" variant="ghost" className="w-full justify-start" onClick={signOut} disabled={loading} aria-busy={loading}>
        <LogOut aria-hidden="true" className="size-4" />
        {loading ? "Signing out..." : "Logout"}
      </Button>
    </div>
  );

  return (
    <>
      <aside aria-label="Sidebar" className="hidden h-full w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">{menu}</div>
        {footer}
      </aside>

      <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <Dialog.Content
            id="app-sidebar"
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-3rem)] flex-col border-r bg-card shadow-xl outline-none lg:hidden"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("sidebar-toggle")?.focus();
            }}
          >
            <Dialog.Title className="sr-only">Sidebar</Dialog.Title>
            <div className="flex shrink-0 justify-end p-2">
              <Dialog.Close className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-accent" aria-label="Close menu">
                <X aria-hidden="true" className="size-5" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{menu}</div>
            {footer}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
