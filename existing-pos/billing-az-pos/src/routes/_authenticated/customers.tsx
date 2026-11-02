import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, Pencil, IndianRupee, Download, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageShell, EmptyState } from "@/components/page";
import { customersQuery, type CustomerRow } from "@/lib/queries";
import { customerLedgerQuery } from "@/lib/admin-queries";
import { rupees, PAYMENT_MODES, paymentLabel } from "@/lib/pos";
import { downloadCsv, dateLabel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — BillingAZ Wholesale POS" },
      {
        name: "description",
        content: "Customer master with credit limits, outstanding balances and payment ledgers.",
      },
      { property: "og:title", content: "Customers — BillingAZ" },
      { property: "og:description", content: "Track wholesale customer credit and collections." },
    ],
  }),
  component: CustomersPage,
});

type Draft = Partial<CustomerRow> & { city?: string | null; state?: string | null };

function CustomersPage() {
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery(customersQuery());
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ledgerFor, setLedgerFor] = useState<CustomerRow | null>(null);
  const [payFor, setPayFor] = useState<CustomerRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.mobile ?? "").includes(q),
    );
  }, [customers, search]);

  const totalDue = customers.reduce((s, c) => s + Number(c.outstanding_balance), 0);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: (d.name ?? "").trim(),
        mobile: d.mobile || null,
        gstin: d.gstin || null,
        address: d.address || null,
        city: d.city || null,
        state: d.state || null,
        credit_limit: Number(d.credit_limit) || 0,
      };
      if (!payload.name) throw new Error("Customer name is required");
      if (d.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Customer saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers · ${rupees(totalDue)} outstanding`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv("customers.csv", [
                  ["Name", "Mobile", "GSTIN", "Credit limit", "Outstanding"],
                  ...filtered.map((c) => [
                    c.name,
                    c.mobile ?? "",
                    c.gstin ?? "",
                    c.credit_limit,
                    c.outstanding_balance,
                  ]),
                ])
              }
            >
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setDraft({ credit_limit: 0 })}>
              <Plus className="size-4" /> New customer
            </Button>
          </>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or mobile"
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add shops and traders you bill regularly."
            action={<Button onClick={() => setDraft({ credit_limit: 0 })}>Add customer</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Credit limit</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const over = Number(c.credit_limit) > 0 && Number(c.outstanding_balance) > Number(c.credit_limit);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.mobile ?? "—"}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.gstin ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(c.credit_limit))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          Number(c.outstanding_balance) > 0
                            ? "font-mono font-semibold text-destructive"
                            : "font-mono text-muted-foreground"
                        }
                      >
                        {rupees(Number(c.outstanding_balance))}
                      </span>
                      {over && (
                        <Badge variant="destructive" className="ml-2">
                          Over limit
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setLedgerFor(c)}>
                        <BookOpen className="size-4" /> Ledger
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPayFor(c)}>
                        <IndianRupee className="size-4" /> Collect
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit customer"
                        onClick={() => setDraft({ ...c })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit customer" : "New customer"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Row label="Name">
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Row>
              <Row label="Mobile">
                <Input
                  value={draft.mobile ?? ""}
                  onChange={(e) => setDraft({ ...draft, mobile: e.target.value })}
                />
              </Row>
              <Row label="GSTIN">
                <Input
                  value={draft.gstin ?? ""}
                  onChange={(e) => setDraft({ ...draft, gstin: e.target.value })}
                />
              </Row>
              <Row label="Credit limit">
                <Input
                  type="number"
                  value={String(draft.credit_limit ?? 0)}
                  onChange={(e) => setDraft({ ...draft, credit_limit: Number(e.target.value) })}
                />
              </Row>
              <Row label="City">
                <Input
                  value={draft.city ?? ""}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </Row>
              <Row label="State">
                <Input
                  value={draft.state ?? ""}
                  onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                />
              </Row>
              <div className="sm:col-span-2">
                <Row label="Address">
                  <Input
                    value={draft.address ?? ""}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  />
                </Row>
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

      <LedgerDialog customer={ledgerFor} onClose={() => setLedgerFor(null)} />
      <CollectDialog customer={payFor} onClose={() => setPayFor(null)} />
    </PageShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function LedgerDialog({
  customer,
  onClose,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
}) {
  const { data } = useQuery(customerLedgerQuery(customer?.id ?? null));
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer?.name} — ledger</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Outstanding balance:{" "}
          <span className="font-mono font-semibold text-destructive">
            {rupees(Number(customer?.outstanding_balance ?? 0))}
          </span>
        </p>
        <h3 className="mt-4 text-sm font-semibold text-foreground">Invoices</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.bills ?? []).map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.invoice_number}</TableCell>
                <TableCell className="text-sm">{dateLabel(b.invoice_date)}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rupees(Number(b.grand_total))}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rupees(Number(b.amount_due))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <h3 className="mt-4 text-sm font-semibold text-foreground">Payments received</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.payments ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{dateLabel(p.paid_at)}</TableCell>
                <TableCell className="text-sm">{paymentLabel(p.mode)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.reference_number ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-primary">
                  {rupees(Number(p.amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

function CollectDialog({
  customer,
  onClose,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [reference, setReference] = useState("");

  const collect = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!customer || !value || value <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("bill_payments").insert({
        customer_id: customer.id,
        mode: mode as never,
        amount: value,
        reference_number: reference || null,
      });
      if (error) throw error;
      const next = Number(customer.outstanding_balance) - value;
      const { error: upErr } = await supabase
        .from("customers")
        .update({ outstanding_balance: next })
        .eq("id", customer.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setAmount("");
      setReference("");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-ledger"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect payment — {customer?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Current due:{" "}
          <span className="font-mono font-semibold text-destructive">
            {rupees(Number(customer?.outstanding_balance ?? 0))}
          </span>
        </p>
        <Row label="Amount">
          <Input
            type="number"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Row>
        <Row label="Mode">
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_MODES.filter((m) => m !== "SPLIT" && m !== "CREDIT").map((m) => (
                <SelectItem key={m} value={m}>
                  {paymentLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Reference (optional)">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Row>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={collect.isPending} onClick={() => collect.mutate()}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
