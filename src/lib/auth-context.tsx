"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  getAdditionalUserInfo,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase/client";
import { ensureUserProfile, getUserProfile } from "./firebase/db";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Google popup sign-in. Resolves to true when this is a brand-new user. */
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    const p = await getUserProfile(auth.currentUser.uid);
    setProfile(p);
  }, []);

  // Complete any pending redirect sign-in (Google fallback). onAuthStateChanged
  // does the profile work; this just surfaces redirect errors to the console.
  useEffect(() => {
    getRedirectResult(auth).catch((err) =>
      console.error("[auth] google redirect failed:", err)
    );
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await ensureUserProfile(
          u.uid,
          u.email ?? "",
          u.displayName ?? u.email?.split("@")[0] ?? "Movie Fan",
          u.photoURL ?? undefined
        );
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateAuthProfile(cred.user, { displayName: name });
    await ensureUserProfile(cred.user.uid, email, name);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      // Create the profile immediately so onboarding has it ready.
      await ensureUserProfile(
        cred.user.uid,
        cred.user.email ?? "",
        cred.user.displayName ?? cred.user.email?.split("@")[0] ?? "Movie Fan",
        cred.user.photoURL ?? undefined
      );
      return getAdditionalUserInfo(cred)?.isNewUser ?? false;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // Popups are unreliable (blockers, COOP, some browsers). Fall back to a
      // full-page redirect, which always works. getRedirectResult (handled on
      // mount below) finishes the flow when the page reloads.
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/internal-error"
      ) {
        await signInWithRedirect(auth, provider);
        return false; // page navigates away; never actually returns
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signup, login, loginWithGoogle, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
