import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "ADMIN" | "SALES" | "ACCOUNTANT" | "STOCK_MANAGER";

interface StoredAuthState {
  userId: string;
  role: AppRole;
  name: string;
  email?: string;
}

const STORAGE_KEY = "billingaz-local-auth";
const STAFF_CODE_KEY = "billingaz-owner-access-code";

function readStoredAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuthState>;
    if (!parsed.userId || !parsed.role || !parsed.name) return null;
    return parsed as StoredAuthState;
  } catch {
    return null;
  }
}

export function writeStoredAuthState(userId: string, role: AppRole, name: string, email?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, role, name, email }));
}

function clearStoredAuthState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function generateStaffAccessCode() {
  const prefix = "BILL";
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${randomPart}-${randomSuffix}`;
}

export function readStoredStaffAccessCode() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(STAFF_CODE_KEY);
  if (existing) return existing;
  const generated = generateStaffAccessCode();
  window.localStorage.setItem(STAFF_CODE_KEY, generated);
  return generated;
}

export function writeStoredStaffAccessCode(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAFF_CODE_KEY, code);
}

export function clearStoredStaffAccessCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STAFF_CODE_KEY);
}

export interface AuthState {
  session: Session | null;
  role: AppRole | null;
  name: string;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setRole(null);
        setName("");
        clearStoredAuthState();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const stored = readStoredAuthState();
      const storedForUser = stored?.userId === session.user.id ? stored : null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;

      const serverRole = (data?.role as AppRole | undefined) ?? null;
      const serverName = profile?.name ?? session.user.email ?? "";
      const fallbackRole = serverRole ?? storedForUser?.role ?? null;
      const fallbackName = serverName || storedForUser?.name || session.user.email || "";

      if (fallbackRole) {
        setRole(fallbackRole);
        setName(fallbackName);
        writeStoredAuthState(session.user.id, fallbackRole, fallbackName, session.user.email ?? "");
      } else {
        setRole(null);
        setName(serverName);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { session, role, name, loading };
}

export const ROLE_HOME: Record<AppRole, string> = {
  ADMIN: "/dashboard",
  SALES: "/billing",
  ACCOUNTANT: "/dashboard",
  STOCK_MANAGER: "/inventory",
};
