import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { expenseCategoriesQuery, expensesQuery } from "@/lib/admin-queries";
import { rupees } from "@/lib/pos";
import { dateLabel, downloadCsv, monthStartIso, todayIso } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — BillingAZ Wholesale POS" },
      {
        name: "description",
        content: "Track shop expenses by category with monthly totals and CSV export.",
      },
      { property: "og:title", content: "Expenses — BillingAZ" },
      { property: "og:description", content: "Daily and monthly expense tracking for your counter." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const { data: expenses = [] } = useQuery(expensesQuery());
  const { data: categories = [] } = useQuery(expenseCategoriesQuery());
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [newCategory, setNewCategory] = useState("");

  const filtered = useMemo(
    () => expenses.filter((e) => e.date >= from && e.date <= to),
    [expenses, from, to],
  );
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const name = (e.expense_categories as { name?: string } | null)?.name ?? "Uncategorised";
      map.set(name, (map.get(name) ?? 0) + Number(e.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const add = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!value || value <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("expenses").insert({
        amount: value,
        expense_category_id: categoryId || null,
        description: description || null,
        date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setOpen(false);
      setAmount("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!newCategory.trim()) throw new Error("Enter a category name");
      const { error } = await supabase
        .from("expense_categories")
        .insert({ name: newCategory.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added");
      setNewCategory("");
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Expenses"
        subtitle={`${rupees(total)} in the selected period`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv("expenses.csv", [
                  ["Date", "Category", "Description", "Amount"],
                  ...filtered.map((e) => [
                    e.date,
                    (e.expense_categories as { name?: string } | null)?.name ?? "",
                    e.description ?? "",
                    e.amount,
                  ]),
                ])
              }
            >
              Export
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No expenses in this period"
              action={<Button onClick={() => setOpen(true)}>Add expense</Button>}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{dateLabel(e.date)}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {(e.expense_categories as { name?: string } | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(e.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete expense"
                        onClick={() => remove.mutate(e.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">By category</h2>
              <div className="space-y-2">
                {byCategory.map(([name, value]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono font-medium">{rupees(value)}</span>
                  </div>
                ))}
                {byCategory.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Categories</h2>
              <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
                {categories.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  placeholder="New category"
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <Button variant="outline" onClick={() => addCategory.mutate()}>
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount
              </Label>
              <Input
                type="number"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Description
              </Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={add.isPending} onClick={() => add.mutate()}>
              Save expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
