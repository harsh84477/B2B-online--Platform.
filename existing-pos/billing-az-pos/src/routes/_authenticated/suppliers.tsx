import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageShell, EmptyState } from "@/components/page";
import { suppliersQuery, type SupplierRow } from "@/lib/admin-queries";
import { rupees } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — BillingAZ Wholesale POS" },
      {
        name: "description",
        content: "Supplier master with GSTIN, contact details and payable balances.",
      },
      { property: "og:title", content: "Suppliers — BillingAZ" },
      { property: "og:description", content: "Manage distributors and payables." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery(suppliersQuery());
  const [draft, setDraft] = useState<Partial<SupplierRow> | null>(null);

  const save = useMutation({
    mutationFn: async (d: Partial<SupplierRow>) => {
      const payload = {
        name: (d.name ?? "").trim(),
        mobile: d.mobile || null,
        email: d.email || null,
        gstin: d.gstin || null,
        address: d.address || null,
      };
      if (!payload.name) throw new Error("Supplier name is required");
      if (d.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Supplier saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payable = suppliers.reduce((s, x) => s + Number(x.outstanding_balance), 0);

  return (
    <PageShell>
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} suppliers · ${rupees(payable)} payable`}
        actions={
          <Button onClick={() => setDraft({})}>
            <Plus className="size-4" /> New supplier
          </Button>
        }
      />
      <Card className="overflow-hidden p-0">
        {suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            description="Add the distributors you purchase stock from."
            action={<Button onClick={() => setDraft({})}>Add supplier</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.mobile ?? "—"}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.gstin ?? "—"}</TableCell>
                  <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                    {s.address ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {rupees(Number(s.outstanding_balance))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit supplier"
                      onClick={() => setDraft({ ...s })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit supplier" : "New supplier"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["name", "Name"],
                  ["mobile", "Mobile"],
                  ["email", "Email"],
                  ["gstin", "GSTIN"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </Label>
                  <Input
                    value={(draft[key] as string) ?? ""}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Address
                </Label>
                <Input
                  value={draft.address ?? ""}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
