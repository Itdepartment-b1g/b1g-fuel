"use client";

import { useCallback, useState, type ReactNode } from "react";
import localFont from "next/font/local";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import AppSideBar from "./AppSideBar";
import type { SideBarAccess } from "./sideBarMenuItems";
import { PAGE_KEYS } from "@/lib/auth/catalog";

type DashboardLayoutProps = SideBarAccess & { children: ReactNode };

const designer = localFont({
  src: "../../../fonts/Designer.otf",
  display: "swap",
});

export default function DashboardLayout({ children, pages = [PAGE_KEYS.home], permissions, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-card">
      <AppSideBar pages={pages} permissions={permissions} role={role} open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 grid h-14 shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 border-b bg-card px-4 lg:hidden">
          <button
            id="sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition hover:bg-accent"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="flex min-w-0 items-center justify-center">
            <span className={cn(designer.className, "block truncate text-xl font-bold tracking-tight text-black")}>
              B1G <span className="text-primary">Fuel</span>
            </span>
          </div>
        </header>

        <main aria-label="Dashboard" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
