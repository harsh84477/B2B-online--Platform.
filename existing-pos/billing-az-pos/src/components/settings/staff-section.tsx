import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmButton, GroupGrid, SaveBar, SelectField, SettingsCard, TextField } from "./kit";
import { staffQuery } from "@/lib/admin-queries";
import { useSettingsSection } from "@/lib/settings-store";
import { downloadCsv, dateLabel } from "@/lib/export";
import type { SettingsValues } from "@/lib/settings-schema";
import { readStoredStaffAccessCode, writeStoredStaffAccessCode, type AppRole } from "@/lib/auth";

const ROLES = ["ADMIN", "ACCOUNTANT", "STOCK_MANAGER", "SALES"] as const;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Owner / Admin",
  ACCOUNTANT: "Accountant",
  STOCK_MANAGER: "Warehouse manager",
  SALES: "Cashier / Sales",
};

const PERMISSIONS = [
  "Dashboard",
  "Billing",
  "Customers",
  "Products",
  "Inventory",
  "Reports",
  "Expenses",
  "Purchase",
  "Settings",
  "Delete bills",
  "Edit bills",
  "Stock transfer",
  "Backup",
  "Export",
  "Import",
] as const;

const permKey = (role: string, perm: string) => `${role}:${perm}`;

const PERMISSION_DEFAULTS: SettingsValues = (() => {
  const out: SettingsValues = {};
  for (const role of ROLES)
    for (const p of PERMISSIONS) {
      const all = role === "ADMIN";
      const salesAllowed = ["Dashboard", "Billing", "Customers", "Products"].includes(p);
      const stockAllowed = [
        "Dashboard",
        "Products",
        "Inventory",
        "Purchase",
        "Stock transfer",
        "Import",
        "Export",
      ].includes(p);
      const acctAllowed = ["Dashboard", "Reports", "Expenses", "Customers", "Export"].includes(p);
      out[permKey(role, p)] =
        all ||
        (role === "SALES" && salesAllowed) ||
        (role === "STOCK_MANAGER" && stockAllowed) ||
        (role === "ACCOUNTANT" && acctAllowed);
    }
  return out;
})();

function generateStaffAccessCode() {
  const prefix = "BILL";
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${randomPart}-${randomSuffix}`;
}

export function StaffSection({ canEdit, role }: { canEdit: boolean; role: AppRole | null }) {
  return (
    <Tabs defaultValue="staff">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
      </TabsList>
      <TabsContent value="staff" className="mt-5">
        <StaffTab canEdit={canEdit} role={role} />
      </TabsContent>
      <TabsContent value="roles" className="mt-5">
        <RolesTab canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}

function StaffTab({ canEdit, role }: { canEdit: boolean; role: AppRole | null }) {
  const qc = useQueryClient();
  const { data: staff = [] } = useQuery(staffQuery());
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [invite, setInvite] = useState({ email: "", role: "SALES" });
  const [staffCode, setStaffCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return staff.filter((s) => {
      if (term && ![s.name, s.email ?? ""].some((f) => String(f).toLowerCase().includes(term)))
        return false;
      if (roleFilter !== "ALL" && s.role !== roleFilter) return false;
      return true;
    });
  }, [staff, q, roleFilter]);

  useEffect(() => {
    if (role !== "ADMIN") return;
    let cancelled = false;

    const initializeCode = async () => {
      const storedCode = readStoredStaffAccessCode();
      if (storedCode) {
        if (!cancelled) setStaffCode(storedCode);
        return;
      }

      const nextCode = generateStaffAccessCode();
      writeStoredStaffAccessCode(nextCode);
      if (!cancelled) setStaffCode(nextCode);

      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("staff_access_code")
          .eq("id", userId)
          .maybeSingle();
        if (error) return;
        const existingCode = profile?.staff_access_code?.trim();
        if (existingCode) {
          writeStoredStaffAccessCode(existingCode);
          if (!cancelled) setStaffCode(existingCode);
          return;
        }
        await supabase.from("profiles").update({ staff_access_code: nextCode }).eq("id", userId);
      } catch {
        // fall back to the local-only storage above
      }
    };

    initializeCode();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff"] });

  async function setRole(userId: string, role: string) {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: role as never })
      .eq("user_id", userId);
    if (error)
      toast.error(
        error.message.includes("policy") ? "Only admins can change roles" : error.message,
      );
    else {
      toast.success("Role updated");
      refresh();
    }
  }

  async function setActive(userId: string, active: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: active })
      .eq("id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success(active ? "Staff reactivated" : "Staff deactivated");
      refresh();
    }
  }

  async function rotateStaffCode() {
    if (role !== "ADMIN") return;
    setCodeBusy(true);
    try {
      const nextCode = generateStaffAccessCode();
      writeStoredStaffAccessCode(nextCode);
      setStaffCode(nextCode);

      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("You need to be signed in to change the access code.");
        const { error } = await supabase
          .from("profiles")
          .update({ staff_access_code: nextCode })
          .eq("id", userId);
        if (error) throw error;
      } catch {
        // Keep the local version; the owner can still use it immediately.
      }

      toast.success("Access code regenerated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate the access code");
    } finally {
      setCodeBusy(false);
    }
  }

  async function copyStaffCode() {
    if (!staffCode) return;
    await navigator.clipboard.writeText(staffCode);
    toast.success("Access code copied to clipboard");
  }

  return (
    <div className="space-y-5">
      {role === "ADMIN" && (
        <SettingsCard
          title="Manager and cashier access code"
          description="Share this code with managers and cashiers so they can sign in securely."
        >
          <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Owner-only sign-in code</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Only the owner sees this code. Managers and cashiers must enter it during sign-in.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={staffCode} readOnly className="min-w-[220px] font-mono" />
              <Button variant="outline" size="sm" onClick={copyStaffCode} disabled={!staffCode}>
                <Copy className="size-4" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={rotateStaffCode} disabled={codeBusy}>
                {codeBusy ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Regenerate
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}
      <SettingsCard
        title="Staff members"
        description="Everyone with access to this BillingAZ workspace."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv("staff.csv", [
                  ["Name", "Email", "Role", "Status", "Joined"],
                  ...rows.map((s) => [
                    s.name,
                    s.email ?? "",
                    s.role,
                    s.is_active ? "Active" : "Inactive",
                    dateLabel(s.created_at),
                  ]),
                ])
              }
            >
              Export
            </Button>
            {canEdit && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="size-4" /> Invite staff
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite a staff member</DialogTitle>
                  </DialogHeader>
                  <GroupGrid columns={1}>
                    <TextField
                      label="Work email"
                      type="email"
                      value={invite.email}
                      onChange={(v) => setInvite({ ...invite, email: v })}
                    />
                    <SelectField
                      label="Role"
                      value={invite.role}
                      options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] ?? r }))}
                      onChange={(v) => setInvite({ ...invite, role: v })}
                    />
                  </GroupGrid>
                  <p className="text-sm text-muted-foreground">
                    Share the sign-up link with them. New sign-ups join as Sales; set their role
                    here once they appear in the list.
                  </p>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/auth`);
                        toast.success("Sign-up link copied to clipboard");
                      }}
                    >
                      <Mail className="size-4" /> Copy invite link
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <SelectField
            label=""
            value={roleFilter}
            options={[
              { value: "ALL", label: "All roles" },
              ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] ?? r })),
            ]}
            onChange={setRoleFilter}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(s.name ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.email ?? "—"}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <div className="w-44">
                        <SelectField
                          label=""
                          value={s.role}
                          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] ?? r }))}
                          onChange={(v) => setRole(s.id, v)}
                        />
                      </div>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABEL[s.role] ?? s.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{dateLabel(s.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!s.email) {
                              toast.error("No email on file for this user");
                              return;
                            }
                            const { error } = await supabase.auth.resetPasswordForEmail(s.email, {
                              redirectTo: `${window.location.origin}/auth`,
                            });
                            toast[error ? "error" : "success"](
                              error ? error.message : "Reset email sent",
                            );
                          }}
                        >
                          <KeyRound className="size-4" /> Reset
                        </Button>
                        <ConfirmButton
                          label=""
                          icon={<UserX className="size-4" />}
                          title={s.is_active ? `Deactivate ${s.name}?` : `Reactivate ${s.name}?`}
                          description={
                            s.is_active
                              ? "They lose access immediately but their history stays intact."
                              : "They regain access to the workspace."
                          }
                          onConfirm={() => setActive(s.id, !s.is_active)}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsCard>
    </div>
  );
}

function RolesTab({ canEdit }: { canEdit: boolean }) {
  const state = useSettingsSection("roles", PERMISSION_DEFAULTS);
  return (
    <div className="space-y-5">
      <SettingsCard
        title="Permission matrix"
        description="Control which modules each role can reach. Admins always retain full access."
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Permission</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r} className="text-center">
                    <span className="inline-flex items-center gap-1">
                      {r === "ADMIN" && <ShieldCheck className="size-3.5" />}
                      {ROLE_LABEL[r]}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((p) => (
                <TableRow key={p}>
                  <TableCell className="font-medium">{p}</TableCell>
                  {ROLES.map((r) => (
                    <TableCell key={r} className="text-center">
                      <Checkbox
                        aria-label={`${r} ${p}`}
                        checked={r === "ADMIN" ? true : !!state.values[permKey(r, p)]}
                        disabled={!canEdit || r === "ADMIN"}
                        onCheckedChange={(v) => state.set(permKey(r, p), !!v)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsCard>
      <SaveBar
        dirty={state.dirty}
        saving={state.saving}
        onSave={state.save}
        onDiscard={state.discard}
        onRestore={state.restoreDefaults}
        readOnly={!canEdit}
      />
    </div>
  );
}
