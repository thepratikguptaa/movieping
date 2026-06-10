"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

/**
 * Wrap authenticated pages. Redirects to /login if signed out, and to
 * /onboarding until preferences are set. `allowUnonboarded` skips that second
 * check (used by the onboarding page itself).
 */
export function RouteGuard({
  children,
  allowUnonboarded = false,
}: {
  children: React.ReactNode;
  allowUnonboarded?: boolean;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowUnonboarded && profile && !profile.onboarded) {
      router.replace("/onboarding");
    }
  }, [user, profile, loading, allowUnonboarded, router, pathname]);

  if (loading || !user || (!allowUnonboarded && profile && !profile.onboarded)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
