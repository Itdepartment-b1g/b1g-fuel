"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Fuel, Menu } from "lucide-react";
import AppSideBar from "./AppSideBar";
import type { SideBarAccess } from "./sideBarMenuItems";

type DashboardLayoutProps = SideBarAccess & { children: ReactNode };

export default function DashboardLayout({ children, pages = [], permissions, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-dvh overflow-hidden bg-card">
      <AppSideBar pages={pages} permissions={permissions} role={role} open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 lg:hidden">
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
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Fuel aria-hidden="true" className="size-4 text-primary-foreground" />
            </div>
            <span className="truncate text-sm font-bold">B1G Fuel</span>
          </div>
        </header>

        <main aria-label="Dashboard" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
