"use client";

import { Navbar } from "@/components/navbar";
import { RouteGuard } from "@/components/route-guard";
import { useFcm } from "@/hooks/use-fcm";

function FcmBootstrap() {
  // Mounting this hook prompts for notification permission once after login
  // and wires up foreground message toasts.
  useFcm();
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <FcmBootstrap />
      <Navbar />
      <main className="container py-6 md:py-8">{children}</main>
    </RouteGuard>
  );
}
