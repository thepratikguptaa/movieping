"use client";

import { Navbar } from "@/components/navbar";
import { BottomNav } from "@/components/bottom-nav";
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
      {/* Soft ambient glow for depth — purely decorative. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]" />
      <Navbar />
      {/* extra bottom padding on mobile so content clears the bottom tab bar */}
      <main className="container py-6 pb-24 md:py-8 md:pb-8">{children}</main>
      <BottomNav />
    </RouteGuard>
  );
}
