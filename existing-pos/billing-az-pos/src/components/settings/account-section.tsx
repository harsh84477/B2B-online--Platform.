import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ConfirmButton, FieldShell, GroupGrid, SettingsCard, TextField, UploadField } from "./kit";
import { downloadJson, dateLabel } from "@/lib/export";
import type { AppRole } from "@/lib/auth";

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s += 25;
  if (pw.length >= 12) s += 15;
  if (/[A-Z]/.test(pw)) s += 20;
  if (/[0-9]/.test(pw)) s += 20;
  if (/[^A-Za-z0-9]/.test(pw)) s += 20;
  return Math.min(100, s);
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function deviceInfo() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Safari/.test(ua)
        ? "Safari"
        : /Firefox/.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return { browser, os, ua };
}

export function AccountSection({ role }: { role: AppRole | null }) {
  const qc = useQueryClient();
  const { data: account, isLoading } = useQuery({
    queryKey: ["account", "me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,name,email,is_active,created_at")
        .eq("id", user.id)
        .maybeSingle();
      return { user, profile };
    },
  });

  const [name, setName] = useState("");
  const [recovery, setRecovery] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [cover, setCover] = useState("");
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (account?.profile) setName(account.profile.name ?? "");
    const meta = account?.user.user_metadata as Record<string, string> | undefined;
    setRecovery(meta?.['recovery_email'] ?? "");
    setPhone(meta?.['phone_number'] ?? account?.user.phone ?? "");
    setAvatar(meta?.['avatar_url'] ?? "");
    setCover(meta?.['cover_url'] ?? "");
  }, [account]);

  if (isLoading || !account) return null;
  const user = account.user;
  const dev = deviceInfo();
  const score = passwordScore(pw.next);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const { error: pErr } = await supabase.from("profiles").update({ name }).eq("id", user.id);
      if (pErr) throw pErr;
      const { error: uErr } = await supabase.auth.updateUser({
        data: { recovery_email: recovery, phone_number: phone, avatar_url: avatar, cover_url: cover },
      });
      if (uErr) throw uErr;
      toast.success("Account details updated");
      qc.invalidateQueries({ queryKey: ["account", "me"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (pw.next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw({ next: "", confirm: "" });
    toast.success("Password changed");
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/auth";
  }

  return (
    <div className="space-y-5">
      <SettingsCard className="p-0">
        <div className="-m-5 mb-5 sm:-m-6 sm:mb-6">
          <div
            className="h-28 w-full bg-gradient-to-r from-primary/80 to-primary/40"
            style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: "cover" } : undefined}
          />
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4 px-5 pb-1 sm:px-6">
            <div className="-mt-10 grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-muted text-2xl font-bold">
              {avatar ? <img src={avatar} alt="Profile" className="size-full object-cover" /> : (name[0] ?? "U")}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold">{name || "Account owner"}</h3>
                <Badge variant="secondary">{role ?? "—"}</Badge>
                {role === "ADMIN" && (
                  <Badge className="gap-1">
                    <BadgeCheck className="size-3" /> Owner
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        <GroupGrid columns={2}>
          <UploadField label="Profile picture" value={avatar} onChange={setAvatar} />
          <UploadField label="Cover photo" value={cover} onChange={setCover} hint="Wide image, 1200×300 recommended" />
          <TextField label="Owner name" value={name} onChange={setName} />
          <TextField label="Login email" value={user.email ?? ""} onChange={() => {}} disabled help="Sign-in email cannot be changed here." />
          <TextField label="Recovery email" type="email" value={recovery} onChange={setRecovery} />
          <TextField label="Phone number" value={phone} onChange={setPhone} />
        </GroupGrid>

        <div className="mt-5 flex flex-wrap gap-2">
          <StatusPill ok={!!user.email_confirmed_at} label="Email verified" />
          <StatusPill ok={!!user.phone_confirmed_at} label="Phone verified" />
          <StatusPill ok={role === "ADMIN"} label="Business verified" />
          <StatusPill ok={account.profile?.is_active !== false} label="Account active" />
        </div>

        <Separator className="my-5" />
        <GroupGrid columns={3}>
          <Meta label="Account created" value={dateLabel(user.created_at)} />
          <Meta label="Last sign-in" value={user.last_sign_in_at ? dateLabel(user.last_sign_in_at) : "—"} />
          <Meta label="User ID" value={user.id.slice(0, 8) + "…"} />
        </GroupGrid>

        <div className="mt-5 flex justify-end">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save account details"}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Password" description="Use a long, unique password. Minimum 8 characters.">
        <GroupGrid columns={3}>
          <FieldShell label="New password">
            <div className="flex gap-2">
              <Input
                type={showPw ? "text" : "password"}
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
              <Button variant="outline" size="icon" aria-label="Toggle password" onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </FieldShell>
          <FieldShell label="Confirm password">
            <Input
              type={showPw ? "text" : "password"}
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </FieldShell>
          <FieldShell label="Strength">
            <div className="pt-2">
              <Progress value={score} />
              <p className="mt-1 text-xs text-muted-foreground">
                {score < 40 ? "Weak" : score < 70 ? "Fair" : score < 90 ? "Strong" : "Excellent"}
              </p>
            </div>
          </FieldShell>
        </GroupGrid>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const gen = generatePassword();
              setPw({ next: gen, confirm: gen });
              setShowPw(true);
              toast.success("Secure password generated — copy it before saving");
            }}
          >
            <RefreshCw className="size-4" /> Generate secure password
          </Button>
          <Button size="sm" onClick={changePassword}>
            <KeyRound className="size-4" /> Update password
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Two-factor authentication" description="Add a second step at sign-in using an authenticator app.">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-4">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Two-factor is currently <strong className="text-foreground">disabled</strong> for this account. Enrol an
            authenticator app and store your backup codes safely.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
              toast[error ? "error" : "success"](
                error ? error.message : "Enrolment started — scan the QR in your authenticator app",
              );
            }}
          >
            Enable two-factor
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Devices & sessions" description="This browser and every other signed-in session.">
        <div className="rounded-lg border border-border/70">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
            <Laptop className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {dev.browser} on {dev.os} <Badge variant="secondary" className="ml-1">This device</Badge>
              </div>

              <p className="truncate text-xs text-muted-foreground">
                Last active now · {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">Trusted</Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))}>
            <LogOut className="size-4" /> Log out this device
          </Button>
          <ConfirmButton
            variant="outline"
            label="Log out everywhere"
            title="Sign out of all devices?"
            description="Every session, including this one, will be ended immediately."
            onConfirm={signOutEverywhere}
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Your data" description="Download everything tied to your account, or close it permanently.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadJson(`billingaz-account-${user.id.slice(0, 8)}.json`, {
                account: { id: user.id, email: user.email, created_at: user.created_at },
                profile: account.profile,
                role,
              })
            }
          >
            <Download className="size-4" /> Download personal data
          </Button>
          <ConfirmButton
            variant="destructive"
            destructive
            label="Delete account"
            title="Delete this account?"
            description="Account deletion must be approved by an administrator. We will mark your profile inactive and sign you out."
            onConfirm={async () => {
              await supabase.from("profiles").update({ is_active: false }).eq("id", user.id);
              toast.success("Account marked for deletion — signing out");
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          />
        </div>
      </SettingsCard>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className="gap-1">
      <span className={`size-1.5 rounded-full ${ok ? "bg-primary-foreground" : "bg-muted-foreground"}`} />
      {label}
      {ok ? "" : " — pending"}
    </Badge>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
