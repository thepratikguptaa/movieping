"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Bell, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useFcm } from "@/hooks/use-fcm";
import { updateProfile } from "@/lib/firebase/db";
import { FALLBACK_GENRES, LANGUAGES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  const { profile, user, logout, refreshProfile } = useAuth();
  const { permission, registering, enableNotifications } = useFcm();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile]);

  if (!profile) return null;

  const genreNames = profile.preferences.genres
    .map((id) => FALLBACK_GENRES.find((g) => g.id === id)?.name)
    .filter(Boolean) as string[];
  const langNames = profile.preferences.languages
    .map((c) => LANGUAGES.find((l) => l.code === c)?.label)
    .filter(Boolean) as string[];

  async function saveName() {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await updateProfile(user.uid, { displayName: name.trim() });
      await refreshProfile();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const initials = profile.displayName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Profile</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile.photoURL && <AvatarImage src={profile.photoURL} alt="" />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{profile.displayName}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <div className="flex gap-2">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={saveName} disabled={saving || name === profile.displayName}>
                {saving && <Loader2 className="animate-spin" />} Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Preferences</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/onboarding"><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-2 text-muted-foreground">Genres</p>
            <div className="flex flex-wrap gap-2">
              {genreNames.length ? genreNames.map((g) => <Badge key={g} variant="secondary">{g}</Badge>) : <span className="text-muted-foreground">None set</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-muted-foreground">Languages</p>
            <div className="flex flex-wrap gap-2">
              {langNames.length ? langNames.map((l) => <Badge key={l} variant="secondary">{l}</Badge>) : <span className="text-muted-foreground">None set</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-muted-foreground">Industries</p>
            <div className="flex flex-wrap gap-2">
              {profile.preferences.industries.length ? profile.preferences.industries.map((i) => <Badge key={i} variant="secondary">{i}</Badge>) : <span className="text-muted-foreground">None set</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {permission === "granted"
              ? "Push notifications are enabled on this device."
              : permission === "denied"
              ? "Blocked. Enable notifications in your browser settings."
              : permission === "unsupported"
              ? "This browser doesn't support push notifications."
              : "Enable push to get release alerts."}
          </p>
          {permission !== "granted" && permission !== "unsupported" && (
            <Button onClick={enableNotifications} disabled={registering}>
              <Bell className="h-4 w-4" /> {registering ? "Enabling…" : "Enable"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-full"
        onClick={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <LogOut /> Log out
      </Button>
    </div>
  );
}
