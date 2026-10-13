import type { Metadata } from "next";
import { ReduxProvider } from "@/components/providers/redux-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "B1G Fuel", template: "%s | B1G Fuel" },
  description: "B1G Fuel management application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider><ToastProvider>{children}</ToastProvider></ReduxProvider>
      </body>
    </html>
  );
}
