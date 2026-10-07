import type { ReactNode } from "react";
import DashboardLayout from "@/app/layout/dashboard-layout";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
