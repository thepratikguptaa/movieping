"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "No account with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account already exists for that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/invalid-email": "That email address looks invalid.",
    "auth/operation-not-allowed":
      "Email/Password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.",
    "auth/configuration-not-found":
      "Firebase Auth isn't set up. Enable a sign-in provider and add this domain to Authorized domains.",
    "auth/network-request-failed": "Network error reaching Firebase. Check your connection / API key.",
    "auth/api-key-not-valid": "Invalid Firebase API key — check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local.",
    "auth/unauthorized-domain":
      "This domain isn't authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/popup-blocked": "Popup was blocked by the browser. Allow popups and try again.",
    "auth/account-exists-with-different-credential":
      "An account already exists with this email using a different sign-in method.",
  };
  // Fall back to showing the raw code so the real cause is never hidden.
  return map[code] ?? `Sign-up failed${code ? ` (${code})` : ""}. Check the console for details.`;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { user, loading: authLoading, login, signup, loginWithGoogle } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  // If already signed in (e.g. returning from a Google redirect), move along.
  // The route guard forwards un-onboarded users to /onboarding.
  useEffect(() => {
    if (!authLoading && user) router.replace(next);
  }, [authLoading, user, next, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, name.trim() || email.split("@")[0]);
        router.replace("/onboarding");
      } else {
        await login(email, password);
        router.replace(next);
      }
    } catch (err) {
      // Log the full error so the real Firebase code/message is always visible.
      console.error("[auth] sign-in/up failed:", err);
      const code = (err as { code?: string })?.code ?? "";
      toast.error(friendlyError(code));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      const isNewUser = await loginWithGoogle();
      // New users go through onboarding; returning users land where they intended.
      router.replace(isNewUser ? "/onboarding" : next);
    } catch (err) {
      console.error("[auth] google sign-in failed:", err);
      const code = (err as { code?: string })?.code ?? "";
      // Popup-closed/cancelled are user actions, not errors worth a toast.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error(friendlyError(code));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-dark/20 to-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-8 shadow-xl backdrop-blur">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="MoviePing" className="h-8 w-8" />
          <span className="text-2xl font-bold">Movie<span className="text-primary">Ping</span></span>
        </Link>

        <h1 className="text-2xl font-bold">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignup ? "Start tracking movies in seconds." : "Log in to your watchlist."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || googleLoading}>
            {loading && <Loader2 className="animate-spin" />}
            {isSignup ? "Sign up" : "Log in"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "New to MoviePing? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-primary hover:underline"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </div>
    </div>
  );
}
