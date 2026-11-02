import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ScanBarcode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAuth,
  ROLE_HOME,
  type AppRole,
  writeStoredAuthState,
  readStoredStaffAccessCode,
} from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Sign in to your BillingAZ counter to bill orders, manage stock and track customer credit.",
      },
      { property: "og:title", content: "Sign in — BillingAZ" },
      {
        property: "og:description",
        content: "Staff sign-in for the BillingAZ wholesale point of sale.",
      },
    ],
  }),
  component: AuthPage,
});

type SignInRole = "owner" | "manager" | "cashier";

const SIGN_IN_ROLE_TO_APP_ROLE: Record<SignInRole, AppRole> = {
  owner: "ADMIN",
  manager: "STOCK_MANAGER",
  cashier: "SALES",
};

function AuthPage() {
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [roleSelection, setRoleSelection] = useState<SignInRole>("owner");
  const [staffCode, setStaffCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && role) navigate({ to: ROLE_HOME[role], replace: true });
  }, [session, role, navigate]);

  async function validateAccessCode(selectedRole: SignInRole) {
    if (selectedRole === "owner") return;
    const trimmedCode = staffCode.trim();
    if (!trimmedCode) {
      throw new Error("Enter the owner access code.");
    }

    const storedCode = readStoredStaffAccessCode();
    if (storedCode && storedCode === trimmedCode) return;

    try {
      const { data, error } = await (supabase.rpc as unknown as Function)("validate_staff_access_code", {
        _code: trimmedCode,
      });
      if (!error && data) return;
    } catch {
      // fall through to the stored-code fallback below
    }

    throw new Error("That access code is not valid.");
  }

  async function bootstrapAndGo(displayName: string, selectedRole: SignInRole) {
    const targetRole = SIGN_IN_ROLE_TO_APP_ROLE[selectedRole];
    const fallbackName = displayName || email;

    let assigned = targetRole;
    try {
      const { data, error } = await supabase.rpc("bootstrap_current_user", {
        _name: fallbackName,
        _role: targetRole,
        _email: email,
        _is_active: true,
      } as never);
      if (!error) {
        assigned = (data as unknown as AppRole) ?? targetRole;
      }
    } catch {
      // fall back to the local role state below
    }

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      writeStoredAuthState(userId, assigned, fallbackName, email);
    }
    navigate({ to: ROLE_HOME[assigned], replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await validateAccessCode(roleSelection);

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { name, role: roleSelection } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created — check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }
        await bootstrapAndGo(name || email, roleSelection);
        toast.success("Welcome to BillingAZ");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) {
          throw new Error("Sign in did not return a session.");
        }
        await bootstrapAndGo(name || email, roleSelection);
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ScanBarcode className="size-6" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">BillingAZ</span>
        </div>
        <div className="max-w-md space-y-5">
          <h2 className="text-4xl font-extrabold leading-tight">
            Bill a wholesale order in under 10 seconds.
          </h2>
          <p className="text-sidebar-foreground/75">
            Case and piece quantities, multi-slab GST, FIFO batch stock, customer credit ledgers and
            80mm thermal invoices — built for the counter.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/70">
            <li>• 2 Case + 6 Piece quantity entry, exact base-unit stock</li>
            <li>• Split payments: cash, UPI, credit, cheque, bank</li>
            <li>• Thermal, A4 PDF and WhatsApp invoice delivery</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          The first account created becomes the Admin of this shop.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ScanBarcode className="size-6 text-primary" />
            <span className="text-xl font-extrabold">BillingAZ</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Sign in to your counter" : "Create your shop account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Use your staff email and password."
              : "The first account becomes Admin; later staff start as Sales."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ramesh Sharma"
                  className="touch-target"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role">Who are you?</Label>
              <Select
                value={roleSelection}
                onValueChange={(value) => setRoleSelection(value as SignInRole)}
              >
                <SelectTrigger id="role" className="touch-target">
                  <SelectValue placeholder="Choose your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {roleSelection !== "owner" && (
              <div className="space-y-2">
                <Label htmlFor="staffCode">Owner access code</Label>
                <Input
                  id="staffCode"
                  value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value)}
                  placeholder="Enter the code from owner settings"
                  className="touch-target"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The code only appears inside the owner account under Settings → Staff.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@shop.in"
                className="touch-target"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="touch-target"
                minLength={6}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(Boolean(v))}
              />
              <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                Remember me on this device
              </Label>
            </div>
            <Button type="submit" className="w-full touch-target text-base" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "First time setting up this shop?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
