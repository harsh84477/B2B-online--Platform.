import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  Printer,
  FileText,
  MessageCircle,
  PauseCircle,
  Eraser,
  UserPlus,
  Package,
  AlertTriangle,
  Loader2,
  Grid2X2,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  categoriesQuery,
  customersQuery,
  heldBillsQuery,
  productsQuery,
  shopProfileQuery,
  type CustomerRow,
  type HeldBillRow,
  type ProductRow,
} from "@/lib/queries";
import { settingsQuery } from "@/lib/settings-store";
import { formatQty, joinQty, paymentLabel, PAYMENT_MODES, rupees, splitQty } from "@/lib/pos";
import { cartTotals, lineTotals, saveBill, type CartLine, type PaymentSplit } from "@/lib/bill";
import { openInvoicePdf, printInvoiceBySettings, printThermal, shareOnWhatsApp, printPaperSavingReceipt, type PrintPayload } from "@/lib/print";
import { useShortcutBindings, formatCombo, describeTarget } from "@/lib/shortcuts";
import { usePosKeyboard, type PosZone } from "@/hooks/use-pos-keyboard";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing Counter — BillingAZ" },
      { name: "description", content: "Create wholesale invoices fast: case/piece quantities, GST slabs, split payments, thermal print and WhatsApp delivery." },
      { property: "og:title", content: "Billing Counter — BillingAZ" },
      { property: "og:description", content: "The fastest wholesale billing screen: search, add, print in seconds." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: customers = [] } = useQuery(customersQuery());
  const { data: shop = null } = useQuery(shopProfileQuery());
  const { data: heldBills = [] } = useQuery(heldBillsQuery());
  const { data: posSettings = {} } = useQuery(settingsQuery("pos"));
  const { data: printSettings = {} } = useQuery(settingsQuery("print"));
  const { data: invoiceSettings = {} } = useQuery(settingsQuery("invoice"));
  const { data: gstSettings = {} } = useQuery(settingsQuery("gst"));
  const { data: billingModeSettings = {} } = useQuery(settingsQuery("billing_modes"));
  const discountEnabled = posSettings.line_discount !== false;
  const gstEnabled = gstSettings.gst_enabled !== false;
  const professionalEnabled = billingModeSettings.professional_enabled !== false;

  const searchRef = useRef<HTMLInputElement>(null);
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  });
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("Auto");
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { mode: "CASH", amount: 0 },
    { mode: "UPI", amount: 0 },
  ]);
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [belowCostConfirm, setBelowCostConfirm] = useState<{
    lineIndex: number;
    attemptedPrice: number;
    costPrice: number;
    productName: string;
  } | null>(null);
  const [belowCostApproval, setBelowCostApproval] = useState<{
    lineIndex: number;
    approvedPrice: number;
  } | null>(null);
  const [billingMode, setBillingMode] = useState<"standard" | "professional">("standard");

  useEffect(() => {
    if (!professionalEnabled) {
      setBillingMode("standard");
    } else if (billingModeSettings.default_mode === "professional") {
      setBillingMode("professional");
    }
  }, [billingModeSettings.default_mode, professionalEnabled]);

  useEffect(() => {
    if (billingMode !== "professional") return;
    let active = true;
    const prefix = shop?.invoice_prefix || "INV";
    const fallbackNext = `${prefix}-00001`;
    setNextInvoiceNumber(fallbackNext);
    supabase
      .rpc("next_invoice_number")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNextInvoiceNumber(fallbackNext);
          return;
        }
        setNextInvoiceNumber(String(data ?? fallbackNext));
      })
      .catch(() => {
        if (active) setNextInvoiceNumber(fallbackNext);
      });
    return () => {
      active = false;
    };
  }, [billingMode, shop?.invoice_prefix]);

  useEffect(() => {
    if (billingMode === "standard") searchRef.current?.focus();
  }, [billingMode]);


  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const filtered = useMemo(() => {
    const matches = products
      .filter((p) => (categoryId === "all" ? true : p.category_id === categoryId))
      .map((p, index) => {
        const name = p.name.toLowerCase();
        const sku = p.sku.toLowerCase();
        const barcode = (p.barcode ?? "").toLowerCase();
        const score = !search
          ? 0
          : name === search
            ? 0
            : name.startsWith(search)
              ? 1
              : sku.startsWith(search) || barcode.startsWith(search)
                ? 2
                : name.includes(search)
                  ? 3
                  : sku.includes(search) || barcode.includes(search)
                    ? 4
                    : -1;

        return { product: p, score, index };
      })
      .filter(({ score }) => score >= 0)
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map(({ product }) => product);

    return matches.slice(0, 120);
  }, [products, categoryId, search]);

  const totals = cartTotals(lines);
  const amountPaid =
    paymentMode === "SPLIT"
      ? splits.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : paymentMode === "CREDIT"
        ? Number(amountPaidInput || 0)
        : amountPaidInput === ""
          ? totals.grandTotal
          : Number(amountPaidInput);
  const amountDue = Math.max(0, totals.grandTotal - amountPaid);

  const creditWarning =
    customer && customer.credit_limit > 0
      ? Number(customer.outstanding_balance) + amountDue > Number(customer.credit_limit)
      : false;

  function addProduct(p: ProductRow) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === p.id);
      const step = p.allow_pack_sale && p.pack_size > 1 ? p.pack_size : 1;
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + step };
        return next;
      }
      return [
        ...prev,
        {
          product: p,
          quantity: step,
          unitPrice: posSettings.default_billing_price === "wholesale"
            ? Number(p.wholesale_price)
            : posSettings.default_billing_price === "retail"
              ? Number(p.selling_price || p.wholesale_price)
              : Number(p.mrp > 0 ? p.mrp : p.wholesale_price),
          discountPercent: 0,
        },
      ];
    });
    setRawSearch("");
    searchRef.current?.focus();
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const merged = { ...l, ...patch };
        // MRP ceiling validation
        const mrp = Number(merged.product.mrp);
        if (mrp > 0 && merged.unitPrice > mrp) {
          toast.error(
            `Rate cannot exceed MRP (${rupees(mrp)}) for ${merged.product.name}.`,
          );
          return { ...merged, unitPrice: mrp };
        }
        return merged;
      }),
    );
  }

  function handleUnitPriceBlur(index: number, line: CartLine) {
    const costPrice = Number(line.product.purchase_price);
    if (costPrice <= 0 || line.unitPrice >= costPrice) return;
    if (
      belowCostApproval &&
      belowCostApproval.lineIndex === index &&
      belowCostApproval.approvedPrice === line.unitPrice
    ) {
      return;
    }
    setBelowCostConfirm({
      lineIndex: index,
      attemptedPrice: line.unitPrice,
      costPrice,
      productName: line.product.name,
    });
  }

  // ---- Keyboard: configured shortcuts + product-grid navigation ----
  const shortcutBindings = useShortcutBindings(categories);
  const gridRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLUListElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zone, setZone] = useState<PosZone>("products");
  const [cartIndex, setCartIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(filtered.length ? 0 : -1);
  }, [categoryId, search, filtered.length]);

  useEffect(() => {
    setCartIndex((prev) => (lines.length === 0 ? -1 : Math.min(prev < 0 ? 0 : prev, lines.length - 1)));
    if (lines.length === 0) setZone("products");
  }, [lines.length]);

  /** PageUp / PageDown steps the value of whichever cart field is focused. */
  function stepCartField(index: number, field: "pack" | "piece" | "rate" | "disc", delta: number) {
    const line = lines[index];
    if (!line) return;
    if (field === "pack") {
      const size = Math.max(1, Number(line.product.pack_size) || 1);
      const next = line.quantity + delta * size;
      if (next <= 0) removeLine(index);
      else updateLine(index, { quantity: next });
      return;
    }
    if (field === "piece") {
      const next = line.quantity + delta;
      if (next <= 0) removeLine(index);
      else updateLine(index, { quantity: next });
      return;
    }
    if (field === "rate") {
      updateLine(index, { unitPrice: Math.max(0, Number(line.unitPrice) + delta) });
      return;
    }
    updateLine(index, {
      discountPercent: Math.min(100, Math.max(0, Number(line.discountPercent) + delta)),
    });
  }

  function stepQuantity(delta: number) {
    if (zone === "cart") {
      const idx = cartIndex;
      if (idx < 0 || !lines[idx]) return;
      stepCartField(idx, cartField, delta);
      return;
    }
    const p = filtered[selectedIndex];
    if (!p) return;
    const idx = lines.findIndex((l) => l.product.id === p.id);
    if (idx < 0) {
      if (delta > 0) addProduct(p);
      return;
    }
    const next = lines[idx]!.quantity + delta;
    if (next <= 0) removeLine(idx);
    else updateLine(idx, { quantity: next });
  }


  usePosKeyboard({
    bindings: shortcutBindings,
    itemCount: filtered.length,
    gridRef,
    selectedIndex,
    setSelectedIndex,
    zone,
    setZone,
    cartCount: lines.length,
    cartIndex,
    setCartIndex,
    onQtyDelta: stepQuantity,
    onRemoveCartLine: () => {
      if (cartIndex >= 0) removeLine(cartIndex);
    },
    onSelectCategory: (id) => {
      setCategoryId(id);
      setSelectedIndex(0);
      setZone("products");
      searchRef.current?.blur();
    },
    onAction: (actionId) => {
      if (actionId === "focus_search") {
        setZone("products");
        searchRef.current?.focus();
      }
      if (actionId === "focus_products") {
        searchRef.current?.blur();
        setZone("products");
        setSelectedIndex(filtered.length ? 0 : -1);
      }
      if (actionId === "focus_cart") {
        searchRef.current?.blur();
        setZone("cart");
        setCartIndex((prev) => (lines.length === 0 ? -1 : prev < 0 ? 0 : Math.min(prev, lines.length - 1)));
      }
      if (actionId === "clear_cart") setConfirmClear(true);
    },
    onEnter: () => {
      const p = filtered[selectedIndex];
      if (!p) return;
      addProduct(p);
      // addProduct refocuses search for mouse users — keep keyboard flow on the grid.
      requestAnimationFrame(() => searchRef.current?.blur());
    },
  });

  useEffect(() => {
    if (zone !== "products" || selectedIndex < 0) return;
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-keynav="product"]');
    cards?.[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex, filtered.length, zone]);

  useEffect(() => {
    if (zone !== "cart" || cartIndex < 0) return;
    const rows = cartRef.current?.querySelectorAll<HTMLElement>('[data-keynav="cart-line"]');
    rows?.[cartIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cartIndex, zone]);

  // ---- Field-level navigation inside the current bill ----
  const CART_FIELDS = ["pack", "piece", "rate", "disc"] as const;
  type CartField = (typeof CART_FIELDS)[number];
  const [cartField, setCartField] = useState<CartField>("piece");

  function fieldsForLine(index: number): CartField[] {
    const line = lines[index];
    const size = Math.max(1, line?.product.pack_size ?? 1);
    const base: CartField[] = size > 1 ? ["pack", "piece", "rate"] : ["piece", "rate"];
    return discountEnabled ? [...base, "disc"] : base;
  }

  function focusCartField(index: number, field: CartField) {
    requestAnimationFrame(() => {
      const el = cartRef.current?.querySelector<HTMLInputElement>(
        `[data-cart-cell="${index}-${field}"]`,
      );
      el?.focus();
      el?.select();
    });
  }

  /** Enter walks Box → Piece → Rate → Disc, then jumps to the next line. */
  function advanceCartField(index: number, field: CartField) {
    const fields = fieldsForLine(index);
    const pos = fields.indexOf(field);
    if (pos >= 0 && pos < fields.length - 1) {
      const next = fields[pos + 1]!;
      setCartField(next);
      focusCartField(index, next);
      return;
    }
    const nextLine = index + 1 < lines.length ? index + 1 : 0;
    const nextField = fieldsForLine(nextLine)[0]!;
    setCartIndex(() => nextLine);
    setCartField(nextField);
    focusCartField(nextLine, nextField);
  }

  function cartFieldKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    field: CartField,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      advanceCartField(index, field);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.currentTarget.blur();
      setZone("products");
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      stepCartField(index, field, e.key === "PageUp" ? 1 : -1);
      return;
    }
    if (e.key === "Delete" && e.shiftKey) {
      e.preventDefault();
      removeLine(index);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextLine =
        e.key === "ArrowDown"
          ? Math.min(lines.length - 1, index + 1)
          : Math.max(0, index - 1);
      const fields = fieldsForLine(nextLine);
      const nextField = fields.includes(field) ? field : fields[0]!;
      setCartIndex(() => nextLine);
      setCartField(nextField);
      focusCartField(nextLine, nextField);
    }
  }

  // Jumping into the cart zone lands on the first editable cell of the row.
  useEffect(() => {
    if (zone !== "cart" || cartIndex < 0 || !lines[cartIndex]) return;
    const fields = fieldsForLine(cartIndex);
    const field = fields.includes(cartField) ? cartField : fields[0]!;
    if (field !== cartField) setCartField(field);
    focusCartField(cartIndex, field);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, cartIndex]);


  // Hint under the category pills always mirrors the configured shortcuts.
  const shortcutHint = useMemo(() => {
    const parts = shortcutBindings
      .filter((b) => b.combo && b.target)
      .slice(0, 5)
      .map((b) => `${formatCombo(b.combo)} ${describeTarget(b, categories)}`);
    return [...parts, "←↑↓→ Navigate", "Enter Add / next field", "PgUp/PgDn Qty ±1"].join(" • ");
  }, [shortcutBindings, categories]);



  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function resetScreen() {
    setLines([]);
    setCustomer(null);
    setCustomerSearch("");
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    setInvoiceDate(new Date(now.getTime() - offset).toISOString().slice(0, 10));
    setNextInvoiceNumber("Auto");
    setPaymentMode("CASH");
    setSplits([
      { mode: "CASH", amount: 0 },
      { mode: "UPI", amount: 0 },
    ]);
    setAmountPaidInput("");
    setRawSearch("");
    searchRef.current?.focus();
  }

  function handleSearchEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const exact = products.find(
      (p) =>
        p.sku.toLowerCase() === search ||
        (p.barcode ?? "").toLowerCase() === search ||
        p.name.toLowerCase() === search,
    );
    const target = exact ?? filtered[0];
    if (target) addProduct(target);
  }

  function buildPayload(invoiceNumber: string): PrintPayload {
    const payloadSettings = {
      ...printSettings,
      print_type: printSettings.print_type ?? "thermal",
      thermal_width: printSettings.thermal_width ?? "80mm",
      template_id: printSettings.template_id ?? "modern-retail",
      theme_color: printSettings.theme_color ?? "Blue",
      custom_theme_color: printSettings.custom_theme_color ?? "#2563eb",
    };

    return {
      invoiceNumber,
      date: new Date(`${invoiceDate}T00:00:00`),
      customerName: customer?.name ?? "Walk-in Customer",
      customerMobile: customer?.mobile ?? null,
      customerGstin: customer?.gstin ?? null,
      customerAddress: customer?.address ?? null,
      paymentMode,
      amountPaid,
      amountDue,
      lines,
      shop,
      printSettings: payloadSettings,
    };
  }

  async function commit(action: "print" | "pdf" | "whatsapp" | "hold") {
    if (!lines.length) {
      toast.error("Add at least one product to the cart.");
      return;
    }
    // MRP ceiling pre-flight check
    for (const line of lines) {
      const mrp = Number(line.product.mrp);
      if (mrp > 0 && line.unitPrice > mrp) {
        toast.error(
          `Rate (${rupees(line.unitPrice)}) exceeds MRP (${rupees(mrp)}) for "${line.product.name}". Please correct it before saving.`,
        );
        return;
      }
    }
    setBusy(true);
    try {
      const payments: PaymentSplit[] =
        paymentMode === "SPLIT"
          ? splits.filter((s) => Number(s.amount) > 0)
          : amountPaid > 0
            ? [{ mode: paymentMode === "CREDIT" ? "CASH" : paymentMode, amount: amountPaid }]
            : [];

      const saved = await saveBill({
        lines,
        customer,
        paymentMode,
        payments,
        amountPaid,
        billType: action === "hold" ? "HOLD" : "SALE",
      });

      const payload = buildPayload(saved.invoice_number);
      if (action === "print") {
        if (invoiceSettings.invoice_template === "PAPER_SAVING" && payload.printSettings?.print_type !== "thermal") {
          printPaperSavingReceipt(payload);
        } else {
          printInvoiceBySettings(payload, payload.printSettings);
        }
      }
      if (action === "pdf") openInvoicePdf(payload, payload.printSettings);
      if (action === "whatsapp") shareOnWhatsApp(payload, payload.printSettings);

      toast.success(
        action === "hold" ? "Bill held" : `Invoice ${saved.invoice_number} saved`,
      );
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["today"] });
      resetScreen();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the bill");
    } finally {
      setBusy(false);
    }
  }

  async function resumeHeld(b: HeldBillRow) {
    // 1. Restore customer state
    if (b.customer_id) {
      let matchedCustomer = customers.find((c) => c.id === b.customer_id);
      if (!matchedCustomer) {
        const { data: fetched } = await supabase
          .from("customers")
          .select("id,name,mobile,gstin,address,credit_limit,outstanding_balance")
          .eq("id", b.customer_id)
          .maybeSingle();
        if (fetched) {
          matchedCustomer = fetched as CustomerRow;
        }
      }

      if (matchedCustomer) {
        setCustomer(matchedCustomer);
      } else if (b.customer_name && b.customer_name !== "Walk-in Customer") {
        setCustomer({
          id: b.customer_id,
          name: b.customer_name,
          mobile: b.customer_mobile ?? null,
          gstin: b.customer_gstin ?? null,
          address: b.customer_address ?? null,
          credit_limit: 0,
          outstanding_balance: 0,
        });
      } else {
        setCustomer(null);
      }
    } else if (b.customer_name && b.customer_name !== "Walk-in Customer") {
      // Backward compatibility: match by name or mobile if customer_id was not saved
      const matchedByName = customers.find(
        (c) =>
          (b.customer_mobile && c.mobile === b.customer_mobile) ||
          c.name.toLowerCase() === b.customer_name?.toLowerCase(),
      );
      setCustomer(matchedByName ?? null);
    } else {
      // Walk-in Customer
      setCustomer(null);
    }
    setCustomerSearch("");

    // 2. Restore cart products
    const { data, error } = await supabase
      .from("bill_items")
      .select("product_id,quantity,unit_price,discount_percent")
      .eq("bill_id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const restored: CartLine[] = [];
    for (const item of data ?? []) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;
      let restoredPrice = Number(item.unit_price);
      const mrp = Number(product.mrp);
      if (mrp > 0 && restoredPrice > mrp) {
        restoredPrice = mrp;
        toast.warning(
          `Rate for "${product.name}" was capped to MRP (${rupees(mrp)}).`,
        );
      }
      restored.push({
        product,
        quantity: Number(item.quantity),
        unitPrice: restoredPrice,
        discountPercent: Number(item.discount_percent),
      });
    }
    setLines(restored);

    // 3. Mark held bill as resumed / deleted
    await supabase
      .from("bills")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_reason: "Resumed",
      })
      .eq("id", b.id);

    await queryClient.invalidateQueries({ queryKey: ["bills", "hold"] });
    await queryClient.invalidateQueries({ queryKey: ["today"] });
    toast.success("Held bill resumed");
  }

  const customerMatches = customers
    .filter(
      (c) =>
        !customerSearch ||
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.mobile ?? "").includes(customerSearch),
    )
    .slice(0, 6);

  return (
    <main
      className={cn(
        "grid h-full grid-cols-1 overflow-hidden",
        billingMode === "professional" ? "flex flex-col" : "lg:grid-cols-[65fr_35fr]",
      )}
    >
      {/* PRODUCT BROWSER */}
      <section className="flex min-h-0 flex-1 flex-col border-r border-border">
        <div className="space-y-3 border-b border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing counter</p>
              <p className="text-sm font-bold">{billingMode === "professional" ? "Professional Billing" : "Standard Billing"}</p>
            </div>
            <div className="flex rounded-md border border-border bg-muted/40 p-1" role="group" aria-label="Billing mode">
              <button
                type="button"
                aria-pressed={billingMode === "standard"}
                onClick={() => setBillingMode("standard")}
                className={cn("flex min-h-9 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors", billingMode === "standard" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="size-3.5" /> Standard
              </button>
              <button
                type="button"
                aria-pressed={billingMode === "professional"}
                disabled={!professionalEnabled}
                onClick={() => setBillingMode("professional")}
                className={cn("flex min-h-9 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors", billingMode === "professional" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground", !professionalEnabled && "cursor-not-allowed opacity-50")}
              >
                <Grid2X2 className="size-3.5" /> Professional
              </button>
            </div>
          </div>
          {billingMode === "standard" && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  onKeyDown={handleSearchEnter}
                  placeholder="Search product, SKU or barcode — press Enter to add"
                  aria-label="Search products"
                  className="h-12 pl-9 text-base"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Pill active={categoryId === "all"} onClick={() => setCategoryId("all")}>
                  All
                </Pill>
                {categories.map((c) => (
                  <Pill key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                    {c.name}
                  </Pill>
                ))}
              </div>
              <p data-shortcut-hint className="text-[11px] text-muted-foreground">
                {shortcutHint}
              </p>
            </>
          )}
        </div>

        {billingMode === "professional" ? (
          <ProfessionalGrid
            lines={lines}
            products={products}
            discountEnabled={discountEnabled}
            addProduct={addProduct}
            updateLine={updateLine}
            removeLine={removeLine}
            customer={customer}
            customerSearch={customerSearch}
            customers={customers}
            onCustomerSearchChange={(value) => {
              setCustomer(null);
              setCustomerSearch(value);
            }}
            onCustomerSelect={(selected) => {
              setCustomer(selected);
              setCustomerSearch("");
            }}
            onCustomerCreated={(created) => {
              setCustomer(created);
              setCustomerSearch("");
              queryClient.invalidateQueries({ queryKey: ["customers"] });
            }}
            onCustomerNameOnly={(name) => {
              setCustomer({
                id: `temporary-${crypto.randomUUID()}`,
                name,
                mobile: null,
                gstin: null,
                address: null,
                credit_limit: 0,
                outstanding_balance: 0,
              });
              setCustomerSearch("");
            }}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            nextInvoiceNumber={nextInvoiceNumber}
          />
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Package className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No products match “{rawSearch}”. Try another name or SKU.
              </p>
            </div>
          ) : (
            <div
              ref={gridRef}
              role="listbox"
              aria-label="Products"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {filtered.map((p, i) => {
                const low = p.current_stock <= p.min_stock_alert;
                const selected = i === selectedIndex;
                return (
                  <button
                    key={p.id}
                    data-keynav="product"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setSelectedIndex(() => i);
                      addProduct(p);
                    }}
                    className={cn(
                      "flex min-h-[120px] flex-col justify-between rounded-lg border bg-card p-3 text-left transition-all duration-150 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "scale-[1.015] border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/20"
                        : "border-border",
                    )}
                  >

                    <div>
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground num">{p.sku}</p>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-lg font-extrabold num text-primary">
                          {rupees(Number(p.wholesale_price))}
                        </p>
                        <p data-shortcut-hint className="text-[11px] text-muted-foreground">
                          {p.pack_size > 1 ? `${p.pack_size} / ${p.pack_name}` : "Loose"} · GST{" "}
                          {p.gst_percent}%
                        </p>
                        {posSettings.show_cost_price && Number(p.purchase_price) > 0 && (
                          <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                            Cost: {rupees(Number(p.purchase_price))}
                          </p>
                        )}
                      </div>
                      <Badge variant={low ? "destructive" : "secondary"} className="num">
                        {p.current_stock}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}
      </section>

      {/* CART PANEL */}
      {billingMode !== "professional" && <section className="flex h-full min-h-0 flex-col bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Current Bill
          </h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PauseCircle className="size-4" /> Held ({heldBills.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Held bills</DialogTitle>
                <DialogDescription>Resume a parked bill to continue billing.</DialogDescription>
              </DialogHeader>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {heldBills.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No held bills right now.
                  </p>
                )}
                {heldBills.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => resumeHeld(b)}
                    className="flex w-full items-center justify-between rounded-md border border-border p-3 text-left hover:border-primary"
                  >
                    <span>
                      <span className="block text-sm font-semibold">
                        {b.customer_name ?? "Walk-in"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleTimeString("en-IN")}
                      </span>
                    </span>
                    <span className="font-bold num">{rupees(Number(b.grand_total))}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Customer */}
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={customer ? `${customer.name}${customer.mobile ? ` · ${customer.mobile}` : ""}` : customerSearch}
              onChange={(e) => onCustomerSearchChange(e.target.value)}
              placeholder="Walk-in customer — search name or mobile"
              aria-label="Customer"
              className="h-11"
            />
            <NewCustomerDialog
              onCreated={(c) => {
                setCustomer(c);
                setCustomerSearch("");
                queryClient.invalidateQueries({ queryKey: ["customers"] });
              }}
            />
          </div>
          {!customer && customerSearch && (
            <div className="rounded-md border border-border">
              {customerMatches.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">No customer found.</p>
              )}
              {customerMatches.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setCustomer(c);
                    setCustomerSearch("");
                  }}
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground num">{c.mobile}</span>
                </button>
              ))}
            </div>
          )}
          {customer && (
            <p className="text-xs text-muted-foreground num">
              Outstanding {rupees(Number(customer.outstanding_balance))} · Limit{" "}
              {customer.credit_limit ? rupees(Number(customer.credit_limit)) : "none"}
            </p>
          )}
          {creditWarning && (
            <p className="flex items-center gap-2 rounded-md bg-warning/15 px-2 py-1.5 text-xs font-medium text-warning-foreground">
              <AlertTriangle className="size-3.5 shrink-0" />
              This bill pushes {customer?.name} past their credit limit.
            </p>
          )}
        </div>

        {/* Items */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <Package className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Cart is empty. Search a product and press Enter.
              </p>
            </div>
          ) : (
            <ul ref={cartRef} className="divide-y divide-border/60">
              {lines.map((line, i) => {
                const t = lineTotals(line);
                const size = Math.max(1, line.product.pack_size);
                const { packQty, pieceQty } = splitQty(line.quantity, size);
                return (
                  <li
                    key={line.product.id}
                    data-keynav="cart-line"
                    aria-selected={zone === "cart" && i === cartIndex}
                    onClick={() => {
                      setZone("cart");
                      setCartIndex(() => i);
                    }}
                    className={cn(
                      "p-2.5 transition-all",
                      i % 2 === 1 ? "bg-muted/35" : "bg-card",
                      "hover:bg-accent/40",
                      zone === "cart" && i === cartIndex
                        ? "bg-primary/10 ring-2 ring-inset ring-primary/50"
                        : "",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold leading-tight" title={line.product.name}>
                          {line.product.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {formatQty(line.quantity, size, line.product.pack_name, line.product.base_unit)} ·{" "}
                          {line.quantity} {line.product.base_unit.toLowerCase()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${line.product.name}`}
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className={cn("mt-1.5 grid gap-1.5", discountEnabled ? "grid-cols-5" : "grid-cols-4")}>
                      <Field label={line.product.pack_name}>
                        <Input
                          type="number"
                          min={0}
                          value={packQty}
                          disabled={size <= 1}
                          data-cart-cell={`${i}-pack`}
                          onFocus={() => {
                            setZone("cart");
                            setCartIndex(() => i);
                            setCartField("pack");
                          }}
                          onKeyDown={(e) => cartFieldKeyDown(e, i, "pack")}
                          onChange={(e) =>
                            updateLine(i, {
                              quantity: joinQty(Number(e.target.value), pieceQty, size),
                            })
                          }
                          className={cn(
                            "h-8 px-1.5 text-xs num",
                            zone === "cart" && i === cartIndex && cartField === "pack" &&
                              "ring-2 ring-primary bg-primary/5",
                          )}
                        />
                      </Field>
                      <Field label="Piece">
                        <Input
                          type="number"
                          min={0}
                          value={pieceQty}
                          data-cart-cell={`${i}-piece`}
                          onFocus={() => {
                            setZone("cart");
                            setCartIndex(() => i);
                            setCartField("piece");
                          }}
                          onKeyDown={(e) => cartFieldKeyDown(e, i, "piece")}
                          onChange={(e) =>
                            updateLine(i, {
                              quantity: joinQty(packQty, Number(e.target.value), size),
                            })
                          }
                          className={cn(
                            "h-8 px-1.5 text-xs num",
                            zone === "cart" && i === cartIndex && cartField === "piece" &&
                              "ring-2 ring-primary bg-primary/5",
                          )}
                        />
                      </Field>
                      <Field label={`Rate${Number(line.product.mrp) > 0 ? ` (≤${Number(line.product.mrp)})` : ""}`}>
                        <Input
                          type="number"
                          min={0}
                          max={Number(line.product.mrp) > 0 ? Number(line.product.mrp) : undefined}
                          step="0.01"
                          value={line.unitPrice}
                          data-cart-cell={`${i}-rate`}
                          onFocus={() => {
                            setZone("cart");
                            setCartIndex(() => i);
                            setCartField("rate");
                          }}
                          onKeyDown={(e) => cartFieldKeyDown(e, i, "rate")}
                          onChange={(e) => {
                            const nextPrice = Number(e.target.value);
                            updateLine(i, { unitPrice: nextPrice });
                            if (
                              belowCostApproval &&
                              belowCostApproval.lineIndex === i &&
                              belowCostApproval.approvedPrice !== nextPrice
                            ) {
                              setBelowCostApproval(null);
                            }
                          }}
                          onBlur={() => handleUnitPriceBlur(i, line)}
                          className={cn(
                            "h-8 px-1.5 text-xs num",
                            Number(line.product.mrp) > 0 && line.unitPrice >= Number(line.product.mrp) && "ring-1 ring-amber-500",
                            Number(line.product.purchase_price) > 0 &&
                              line.unitPrice < Number(line.product.purchase_price) &&
                              "text-destructive ring-1 ring-destructive/50",
                            zone === "cart" && i === cartIndex && cartField === "rate" &&
                              "ring-2 ring-primary bg-primary/5",
                          )}
                        />
                      </Field>
                      {discountEnabled && (
                      <Field label="Disc %">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          data-cart-cell={`${i}-disc`}
                          onFocus={() => {
                            setZone("cart");
                            setCartIndex(() => i);
                            setCartField("disc");
                          }}
                          onKeyDown={(e) => cartFieldKeyDown(e, i, "disc")}
                          onChange={(e) =>
                            updateLine(i, { discountPercent: Number(e.target.value) })
                          }
                          className={cn(
                            "h-8 px-1.5 text-xs num",
                            zone === "cart" && i === cartIndex && cartField === "disc" &&
                              "ring-2 ring-primary bg-primary/5",
                          )}
                        />
                      </Field>
                      )}


                      <Field label={`GST ${line.product.gst_percent}%`}>
                        <div className="flex h-8 items-center justify-end rounded-md bg-primary/10 px-1.5 text-xs font-bold num text-primary">
                          {rupees(t.totalAmount)}
                        </div>
                      </Field>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Totals + payment */}
        <div className="shrink-0 space-y-2 border-t border-border bg-card p-2.5">
          <div className="space-y-0.5 text-xs">
            <Row label="Subtotal" value={rupees(totals.subTotal)} />
            {discountEnabled && (
              <Row label="Discount" value={`- ${rupees(totals.totalDiscount)}`} />
            )}
            {gstEnabled && (
              <Row label={`GST (CGST ${rupees(totals.totalCgst)} + SGST ${rupees(totals.totalSgst)})`} value={rupees(totals.totalGst)} />
            )}
            <Row label="Round Off" value={rupees(totals.roundOff)} />
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-sm font-bold">Grand Total</span>
              <span className="text-xl font-extrabold num text-primary">
                {rupees(totals.grandTotal)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {PAYMENT_MODES.map((m) => (
              <Pill key={m} active={paymentMode === m} onClick={() => setPaymentMode(m)}>
                {paymentLabel(m)}
              </Pill>
            ))}
          </div>

          {paymentMode === "SPLIT" ? (
            <div className="space-y-2">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    aria-label="Split payment mode"
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    value={s.mode}
                    onChange={(e) =>
                      setSplits((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, mode: e.target.value } : p)),
                      )
                    }
                  >
                    {PAYMENT_MODES.filter((m) => m !== "SPLIT").map((m) => (
                      <option key={m} value={m}>
                        {paymentLabel(m)}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    aria-label="Split amount"
                    value={s.amount || ""}
                    onChange={(e) =>
                      setSplits((prev) =>
                        prev.map((p, j) =>
                          j === i ? { ...p, amount: Number(e.target.value) } : p,
                        ),
                      )
                    }
                    className="h-8 w-28 text-xs num"
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSplits((p) => [...p, { mode: "CASH", amount: 0 }])}
              >
                + Add split row
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label htmlFor="paid" className="whitespace-nowrap text-xs">
                Amount paid
              </Label>
              <Input
                id="paid"
                type="number"
                min={0}
                value={amountPaidInput}
                placeholder={String(totals.grandTotal)}
                onChange={(e) => setAmountPaidInput(e.target.value)}
                className="h-8 text-xs num"
              />
            </div>
          )}

          {amountDue > 0 && (
            <p className="rounded-md bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning-foreground num">
              Credit due: {rupees(amountDue)}
            </p>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => commit("hold")}
            >
              <PauseCircle className="size-3.5" /> Hold
            </Button>
            <Button size="sm" disabled={busy} onClick={() => commit("print")}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}{" "}
              Print & Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => commit("pdf")}
            >
              <FileText className="size-3.5" /> Save & PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => commit("whatsapp")}
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2 text-destructive hover:text-destructive"
              onClick={() => setConfirmClear(true)}
            >
              <Eraser className="size-3.5" /> Clear cart
            </Button>
          </div>
        </div>
      </section>}

      {billingMode === "professional" && (
        <div className="shrink-0 border-t border-border bg-card px-3 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => commit("hold")}
              >
                <PauseCircle className="size-3.5" /> Hold bill
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmClear(true)}
              >
                <Eraser className="size-3.5" /> Clear
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
                {PAYMENT_MODES.filter((mode) => mode !== "SPLIT").map((mode) => (
                  <Pill
                    key={mode}
                    active={paymentMode === mode}
                    onClick={() => setPaymentMode(mode)}
                  >
                    {paymentLabel(mode)}
                  </Pill>
                ))}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Grand total
                </p>
                <p className="text-xl font-extrabold num text-primary">{rupees(totals.grandTotal)}</p>
              </div>
              <Button size="lg" disabled={busy} onClick={() => commit("print")}>
                {busy ? <Loader2 className="animate-spin" /> : <Printer />} Print & Save
              </Button>
              <Button variant="outline" size="lg" disabled={busy} onClick={() => commit("pdf")}>
                <FileText /> PDF
              </Button>
              <Button variant="outline" size="lg" disabled={busy} onClick={() => commit("whatsapp")}>
                <MessageCircle /> WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              All items and the selected customer will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep billing</AlertDialogCancel>
            <AlertDialogAction onClick={resetScreen}>Clear cart</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(belowCostConfirm)}
        onOpenChange={(open) => {
          if (!open) setBelowCostConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sell below cost price?</AlertDialogTitle>
            <AlertDialogDescription>
              Cost price for{" "}
              <span className="font-semibold text-foreground">
                {belowCostConfirm?.productName}
              </span>{" "}
              is{" "}
              <span className="font-bold text-destructive num">
                {belowCostConfirm ? rupees(belowCostConfirm.costPrice) : ""}
              </span>
              . You are selling at{" "}
              <span className="font-bold num">
                {belowCostConfirm ? rupees(belowCostConfirm.attemptedPrice) : ""}
              </span>
              . Continue anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (!belowCostConfirm) return;
                updateLine(belowCostConfirm.lineIndex, {
                  unitPrice: belowCostConfirm.costPrice,
                });
                setBelowCostApproval(null);
                setBelowCostConfirm(null);
              }}
            >
              Use cost price
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!belowCostConfirm) return;
                setBelowCostApproval({
                  lineIndex: belowCostConfirm.lineIndex,
                  approvedPrice: belowCostConfirm.attemptedPrice,
                });
                setBelowCostConfirm(null);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ProfessionalGrid({
  lines,
  products,
  discountEnabled,
  addProduct,
  updateLine,
  removeLine,
  customer,
  customerSearch,
  customers,
  onCustomerSearchChange,
  onCustomerSelect,
  onCustomerCreated,
  onCustomerNameOnly,
  invoiceDate,
  onInvoiceDateChange,
  nextInvoiceNumber,
}: {
  lines: CartLine[];
  products: ProductRow[];
  discountEnabled: boolean;
  addProduct: (product: ProductRow) => void;
  updateLine: (index: number, patch: Partial<CartLine>) => void;
  removeLine: (index: number) => void;
  customer: CustomerRow | null;
  customerSearch: string;
  customers: CustomerRow[];
  onCustomerSearchChange: (value: string) => void;
  onCustomerSelect: (customer: CustomerRow) => void;
  onCustomerCreated: (customer: CustomerRow) => void;
  onCustomerNameOnly: (name: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  nextInvoiceNumber: string;
}) {
  const [productQueries, setProductQueries] = useState<Record<number, string>>({});
  const [activeProductRow, setActiveProductRow] = useState(0);
  const query = productQueries[activeProductRow] ?? "";
  const [customerQuery, setCustomerQuery] = useState(customerSearch);
  const [newCustomerRequest, setNewCustomerRequest] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(-1);
  const [hoveredProductIndex, setHoveredProductIndex] = useState<number | null>(null);
  const [productMatchNavigated, setProductMatchNavigated] = useState(false);
  const [unknownProductName, setUnknownProductName] = useState<string | null>(null);
  const [unknownProductDraft, setUnknownProductDraft] = useState({
    name: "",
    piecesPerCase: "1",
    sellingPrice: "",
    costPrice: "",
  });
  const [creatingUnknownProduct, setCreatingUnknownProduct] = useState(false);
  const [productInputRect, setProductInputRect] = useState<DOMRect | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const customerInputRef = useRef<HTMLInputElement>(null);
  function setQuery(value: string) {
    setProductQueries((previous) => ({ ...previous, [activeProductRow]: value }));
  }
  useEffect(() => {
    if (!customer && !customerSearch) setCustomerQuery("");
  }, [customer, customerSearch]);
  const customerMatches = customers
    .filter(
      (candidate) =>
        !customerQuery ||
        candidate.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
        (candidate.mobile ?? "").includes(customerQuery),
    )
    .slice(0, 6);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const ranked = products
      .map((product, index) => {
        const name = product.name.trim().toLowerCase();
        const sku = product.sku.toLowerCase();
        const barcode = (product.barcode ?? "").toLowerCase();
        const score = name === term
          ? 0
          : name.startsWith(term)
            ? 1
            : sku.startsWith(term) || barcode === term
              ? 2
              : name.includes(term)
                ? 3
                : sku.includes(term) || barcode.includes(term)
                  ? 4
                  : -1;
        return { product, score, index };
      })
      .filter((item) => item.score >= 0)
      .sort((a, b) => a.score - b.score || a.index - b.index)
    const prefixMatches = ranked.filter(({ product }) =>
      product.name.trim().toLowerCase().startsWith(term),
    );
    const remainingMatches = ranked.filter(
      ({ product }) => !product.name.trim().toLowerCase().startsWith(term),
    );

    return [...prefixMatches.slice(0, 5), ...remainingMatches.slice(0, 5)].map(
      (item) => item.product,
    );
  }, [products, query]);

  useEffect(() => {
    productInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setHighlighted(-1);
    setHoveredProductIndex(null);
    setProductMatchNavigated(false);
  }, [query]);

  useEffect(() => {
    if (!query || !productInputRect) return;
    const updatePosition = () => setProductInputRect(productInputRef.current?.getBoundingClientRect() ?? null);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [query, productInputRect]);

  function selectProduct(product: ProductRow) {
    addProduct(product);
    setQuery("");
    setProductInputRect(null);
    setHighlighted(-1);
    setHoveredProductIndex(null);
    setProductMatchNavigated(false);
    requestAnimationFrame(() => {
      const firstField = document.querySelector<HTMLInputElement>(
        `[data-professional-field="${product.id}-case"]:not(:disabled), [data-professional-field="${product.id}-piece"]`,
      );
      firstField?.focus();
    });
  }

  async function createUnknownProduct() {
    const name = unknownProductDraft.name.trim();
    const piecesPerCase = Math.max(1, Math.trunc(Number(unknownProductDraft.piecesPerCase) || 1));
    const sellingPrice = Math.max(0, Number(unknownProductDraft.sellingPrice) || 0);
    const costPrice = Math.max(0, Number(unknownProductDraft.costPrice) || 0);
    if (!name || creatingUnknownProduct) return;
    setCreatingUnknownProduct(true);
    const sku = `AUTO-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        sku,
        purchase_price: costPrice,
        selling_price: sellingPrice,
        wholesale_price: sellingPrice,
        mrp: sellingPrice,
        gst_percent: 0,
        base_unit: "PIECE",
        pack_name: "Case",
        pack_size: piecesPerCase,
        allow_piece_sale: true,
        allow_pack_sale: piecesPerCase > 1,
        current_stock: 0,
        min_stock_alert: 0,
        is_active: true,
        is_deleted: false,
      })
      .select("*")
      .single();
    setCreatingUnknownProduct(false);
    if (error) {
      toast.error(`Unable to add ${name} to the product list.`);
      return;
    }
    const product = data as unknown as ProductRow;
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    setUnknownProductName(null);
    setUnknownProductDraft({ name: "", piecesPerCase: "1", sellingPrice: "", costPrice: "" });
    setQuery("");
    setProductInputRect(null);
    setHoveredProductIndex(null);
    setProductMatchNavigated(false);
    selectProduct(product);
  }

  function professionalFieldKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    productId: string,
    field: "case" | "piece" | "rate" | "discount-percent" | "discount-amount",
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const order: Array<"case" | "piece" | "rate" | "discount-percent" | "discount-amount"> = [
      "case",
      "piece",
      "rate",
      ...(discountEnabled ? ["discount-percent", "discount-amount"] as const : []),
    ];
    const currentIndex = order.indexOf(field);
    const nextField = order.slice(currentIndex + 1).find((next) => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-professional-field="${productId}-${next}"]`,
      );
      return input && !input.disabled;
    });
    requestAnimationFrame(() => {
      if (nextField) {
        document.querySelector<HTMLInputElement>(
          `[data-professional-field="${productId}-${nextField}"]`,
        )?.focus();
      } else {
        productInputRef.current?.focus();
      }
    });
  }

  function updateDiscountPercent(index: number, percent: number) {
    updateLine(index, { discountPercent: Math.min(100, Math.max(0, percent)) });
  }

  function updateDiscountAmount(index: number, amount: number) {
    const line = lines[index];
    if (!line) return;
    const gstRate = Number(line.product.gst_percent) || 0;
    const grossAmount = (line.quantity * line.unitPrice) / (1 + gstRate / 100);
    updateDiscountPercent(index, grossAmount > 0 ? (Math.max(0, amount) / grossAmount) * 100 : 0);
  }

  const professionalTotals = cartTotals(lines);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-3 sm:p-4">
      <div className="mb-4 overflow-hidden rounded-xl border border-primary/20 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/10 via-card to-accent/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Professional invoice</h2>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                  Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Build an invoice line by line with SKU, tax, discount and pricing controls.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-right">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
              <p className="text-sm font-bold num">{lines.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subtotal</p>
              <p className="text-sm font-bold num">{rupees(professionalTotals.subtotal)}</p>
            </div>
            <div className="border-l border-border pl-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invoice total</p>
              <p className="text-lg font-extrabold num text-primary">{rupees(professionalTotals.grandTotal)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
          <Search className="size-3.5 shrink-0 text-primary" />
          <span>Start typing in the highlighted Product row. Use Arrow keys and Enter to select.</span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative min-w-0">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Customer
          </label>
          <div className="flex gap-2">
            {customer ? (
              <button
                type="button"
                className="flex h-10 min-w-0 flex-1 items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 text-left text-sm shadow-sm hover:bg-primary/10"
                onClick={() => {
                  setCustomerQuery("");
                  onCustomerSearchChange("");
                  requestAnimationFrame(() => customerInputRef.current?.focus());
                }}
                aria-label={`Change selected customer ${customer.name}`}
              >
                <span className="truncate font-bold text-foreground">{customer.name}</span>
                <span className="ml-2 shrink-0 text-xs font-medium text-primary">Change</span>
              </button>
            ) : (
              <Input
                ref={customerInputRef}
                type="text"
                autoComplete="off"
                value={customerQuery}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter" && customerQuery.trim() && customerMatches.length === 0) {
                    event.preventDefault();
                    setNewCustomerRequest(customerQuery.trim());
                    setCustomerQuery("");
                    onCustomerSearchChange("");
                  }
                }}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  onCustomerSearchChange(e.target.value);
                }}
                placeholder="Search customer by name or mobile"
                aria-label="Customer"
                className="h-10 min-w-0 flex-1"
              />
            )}
            <NewCustomerDialog
              onCreated={onCustomerCreated}
              requestedName={newCustomerRequest}
              onRequestHandled={() => setNewCustomerRequest(null)}
              onNameOnly={onCustomerNameOnly}
            />
          </div>
          {customerQuery && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
              {customerMatches.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">No customer found.</p>
              )}
              {customerMatches.map((match) => (
                <button
                  type="button"
                  key={match.id}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setCustomerQuery("");
                    onCustomerSelect(match);
                  }}
                >
                  <span className="truncate font-medium">{match.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground num">{match.mobile}</span>
                </button>
              ))}
            </div>
          )}
          {!customer && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Walk-in Customer selected by default
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Invoice number
            </span>
            <Input value={nextInvoiceNumber} readOnly aria-label="Next invoice number" className="h-10 bg-muted/40 font-semibold num" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Invoice date
            </span>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => onInvoiceDateChange(e.target.value)}
              aria-label="Invoice date"
              className="h-10 num"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-10 bg-sidebar text-left text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground backdrop-blur">
            <tr>
              <th className="w-12 px-3 py-3">#</th>
              <th className="min-w-64 px-3 py-3">Product description</th>
              <th className="w-28 px-2 py-3">SKU</th>
              <th className="w-24 px-2 py-3">HSN</th>
              <th className="w-32 px-2 py-3">Quantity</th>
              <th className="w-28 px-2 py-3">Rate</th>
              {discountEnabled && <th className="w-40 px-2 py-3">Discount</th>}
              <th className="w-24 px-2 py-3">GST</th>
              <th className="w-32 px-3 py-3 text-right">Amount</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line, index) => {
              const total = lineTotals(line);
              const size = Math.max(1, Number(line.product.pack_size) || 1);
              const packQty = Math.floor(line.quantity / size);
              const remainderQty = line.quantity % size;
              const pieceQty = line.quantity;
              const packLabel = line.product.pack_name || "Case";
              const unitLabel = line.product.base_unit || "Unit";
              const mrp = Number(line.product.mrp) || 0;
              return (
                <tr key={line.product.id} className="group transition-colors hover:bg-primary/[0.035]">
                  <td className="px-3 py-3 align-top text-xs font-semibold text-muted-foreground num">{index + 1}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold leading-snug">{line.product.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{line.product.barcode || "No barcode"}</p>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{line.product.sku}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{line.product.hsn_code || "—"}</td>
                  <td className="px-2 py-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                      <label className="min-w-0">
                        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {packLabel}{size > 1 ? ` (${size})` : ""}
                        </span>
                        <Input
                          aria-label={`${packLabel} quantity for ${line.product.name}`}
                          type="number"
                          min={0}
                          step={1}
                          value={packQty}
                          disabled={size <= 1}
                          data-professional-field={`${line.product.id}-case`}
                          onKeyDown={(e) => professionalFieldKeyDown(e, line.product.id, "case")}
                          onChange={(e) =>
                            updateLine(index, {
                              quantity:
                                Math.max(0, Math.trunc(Number(e.target.value) || 0)) * size + remainderQty,
                            })
                          }
                          className="h-10 w-full min-w-0 bg-background px-1 text-center text-sm num [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {unitLabel}
                        </span>
                        <Input
                          aria-label={`${unitLabel} quantity for ${line.product.name}`}
                          type="number"
                          min={0}
                          step={1}
                          value={pieceQty}
                          data-professional-field={`${line.product.id}-piece`}
                          onKeyDown={(e) => professionalFieldKeyDown(e, line.product.id, "piece")}
                          onChange={(e) =>
                            updateLine(index, {
                              quantity: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                            })
                          }
                          className="h-10 w-full min-w-0 bg-background px-1 text-center text-sm num [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <label
                      className={cn(
                        "block min-w-0 rounded-md",
                        Number(line.product.purchase_price) > 0 &&
                          line.unitPrice < Number(line.product.purchase_price) &&
                          "bg-destructive/10 p-1 ring-1 ring-destructive/50",
                      )}
                    >
                      <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rate{mrp > 0 ? ` (≤ ${rupees(mrp)})` : ""}
                      </span>
                      <Input
                        aria-label={`Rate for ${line.product.name}${mrp > 0 ? `, maximum ${rupees(mrp)}` : ""}`}
                        type="number"
                        min={0}
                        max={mrp > 0 ? mrp : undefined}
                        step={1}
                        value={line.unitPrice}
                        data-professional-field={`${line.product.id}-rate`}
                        onKeyDown={(e) => professionalFieldKeyDown(e, line.product.id, "rate")}
                        onChange={(e) => {
                          const nextPrice = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                          updateLine(index, { unitPrice: nextPrice });
                          if (
                            belowCostApproval &&
                            belowCostApproval.lineIndex === index &&
                            belowCostApproval.approvedPrice !== nextPrice
                          ) {
                            setBelowCostApproval(null);
                          }
                          const costPrice = Number(line.product.purchase_price);
                          if (
                            costPrice > 0 &&
                            nextPrice < costPrice &&
                            !belowCostConfirm &&
                            !(
                              belowCostApproval &&
                              belowCostApproval.lineIndex === index &&
                              belowCostApproval.approvedPrice === nextPrice
                            )
                          ) {
                            setBelowCostConfirm({
                              lineIndex: index,
                              attemptedPrice: nextPrice,
                              costPrice,
                              productName: line.product.name,
                            });
                          }
                        }}
                        onBlur={() => handleUnitPriceBlur(index, line)}
                        className="h-10 w-full min-w-0 bg-background px-2 text-center text-sm num [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </label>
                  </td>
                  {discountEnabled && (
                    <td className="px-2 py-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                        <label className="relative min-w-0">
                          <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Percentage
                          </span>
                          <Input
                            aria-label={`Discount percentage for ${line.product.name}`}
                            type="number"
                            min={0}
                            max={100}
                            value={Number(line.discountPercent.toFixed(2))}
                            data-professional-field={`${line.product.id}-discount-percent`}
                            onKeyDown={(e) => professionalFieldKeyDown(e, line.product.id, "discount-percent")}
                            onChange={(e) => updateDiscountPercent(index, Number(e.target.value))}
                            className="h-10 w-full min-w-0 bg-background px-1 pr-5 text-center text-sm num [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                        </label>
                        <label className="relative min-w-0">
                          <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Amount
                          </span>
                          <Input
                            aria-label={`Discount amount for ${line.product.name}`}
                            type="number"
                            min={0}
                            value={Number(total.discountAmount.toFixed(2))}
                            data-professional-field={`${line.product.id}-discount-amount`}
                            onKeyDown={(e) => professionalFieldKeyDown(e, line.product.id, "discount-amount")}
                            onChange={(e) => updateDiscountAmount(index, Number(e.target.value))}
                            className="h-10 w-full min-w-0 bg-background px-1 pr-5 text-center text-sm num [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹</span>
                        </label>
                      </div>
                    </td>
                  )}
                  <td className="px-2 py-3 text-xs font-semibold text-muted-foreground num">{line.product.gst_percent}%</td>
                  <td className="px-3 py-3 text-right font-bold num text-foreground">{rupees(total.totalAmount)}</td>
                  <td className="px-2 py-2">
                    <Button variant="ghost" size="icon" className="size-9 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-destructive" aria-label={`Remove ${line.product.name}`} onClick={() => removeLine(index)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {Array.from({ length: 5 }, (_, emptyIndex) => (
            <tr key={`empty-${emptyIndex}`} className="bg-primary/[0.055]">
              <td className="px-3 py-3 text-xs font-semibold text-primary num">{lines.length + emptyIndex + 1}</td>
              <td className="relative px-3 py-3">
                <Input
                  ref={emptyIndex === 0 ? productInputRef : undefined}
                  value={productQueries[emptyIndex] ?? ""}
                  onFocus={(event) => {
                    setActiveProductRow(emptyIndex);
                    setProductInputRect(event.currentTarget.getBoundingClientRect());
                  }}
                  onChange={(e) => {
                    setActiveProductRow(emptyIndex);
                    setProductQueries((previous) => ({ ...previous, [emptyIndex]: e.target.value }));
                    setProductInputRect(e.currentTarget.getBoundingClientRect());
                  }}
                  onKeyDown={(e) => {
                    setActiveProductRow(emptyIndex);
                    if (e.key === "ArrowDown" && matches.length) {
                      e.preventDefault();
                      setProductMatchNavigated(true);
                      setHighlighted((value) => Math.min(Math.max(value, -1) + 1, matches.length - 1));
                    } else if (e.key === "ArrowUp" && matches.length) {
                      e.preventDefault();
                      setProductMatchNavigated(true);
                      setHighlighted((value) => Math.max(value < 0 ? matches.length - 1 : value - 1, 0));
                    } else if (e.key === "Enter" && matches.length && productMatchNavigated) {
                      e.preventDefault();
                      const selectedMatch = matches[highlighted] ?? matches[0];
                      selectProduct(selectedMatch);
                    } else if (e.key === "Enter" && (productQueries[emptyIndex] ?? "").trim()) {
                      e.preventDefault();
                      const name = (productQueries[emptyIndex] ?? "").trim();
                      setUnknownProductDraft({
                        name,
                        piecesPerCase: "1",
                        sellingPrice: "",
                        costPrice: "",
                      });
                      setUnknownProductName(name);
                    } else if (e.key === "Escape") {
                      setQuery("");
                      setProductInputRect(null);
                      setHoveredProductIndex(null);
                      setProductMatchNavigated(false);
                    }
                  }}
                  placeholder="Search product, SKU or barcode..."
                  aria-label={`Search product for billing row ${lines.length + emptyIndex + 1}`}
                  aria-autocomplete="list"
                  className="h-10 border-primary/40 bg-background shadow-sm focus-visible:border-primary"
                />
                {activeProductRow === emptyIndex &&
                  query &&
                  productInputRect &&
                  !unknownProductName &&
                  createPortal(
                    <div
                      role="listbox"
                      aria-label="Matching products"
                      style={{
                        position: "fixed",
                        left: productInputRect.left,
                        top: productInputRect.bottom + 4,
                        width: productInputRect.width,
                      }}
                      className="z-[100] max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
                    >
                      {matches.length ? matches.map((product, index) => (
                        <button
                          type="button"
                          key={product.id}
                          role="option"
                          aria-selected={productMatchNavigated && index === highlighted}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setHoveredProductIndex(index)}
                          onMouseLeave={() => setHoveredProductIndex(null)}
                          onClick={() => selectProduct(product)}
                          className={cn(
                            "flex min-h-11 w-full items-center justify-between gap-3 rounded px-2 text-left text-sm",
                            hoveredProductIndex === index ||
                              (productMatchNavigated && index === highlighted)
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="min-w-0 truncate font-medium">{product.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{product.sku}</span>
                        </button>
                      )) : (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No matching products</p>
                      )}
                    </div>,
                    document.body,
                  )}
              </td>
              <td colSpan={discountEnabled ? 8 : 7} className="px-2 py-3 text-xs text-muted-foreground">
                {emptyIndex === 0 ? "Search by product, SKU or barcode" : "Ready for the next line item"}
              </td>
              <td />
            </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AlertDialog
        open={Boolean(unknownProductName)}
        onOpenChange={(open) => {
          if (!open && !creatingUnknownProduct) {
            setUnknownProductName(null);
            setUnknownProductDraft({ name: "", piecesPerCase: "1", sellingPrice: "", costPrice: "" });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add product to your product list</AlertDialogTitle>
            <AlertDialogDescription>
              This product is not available. Enter the minimum details below. Stock will remain zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-foreground">Product name</span>
              <Input
                value={unknownProductDraft.name}
                onChange={(event) =>
                  setUnknownProductDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                autoFocus
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-foreground">Pieces per case</span>
              <Input
                type="number"
                min={1}
                step={1}
                value={unknownProductDraft.piecesPerCase}
                onChange={(event) =>
                  setUnknownProductDraft((draft) => ({ ...draft, piecesPerCase: event.target.value }))
                }
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-foreground">Selling price / rate</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unknownProductDraft.sellingPrice}
                onChange={(event) =>
                  setUnknownProductDraft((draft) => ({ ...draft, sellingPrice: event.target.value }))
                }
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-foreground">Cost price</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unknownProductDraft.costPrice}
                onChange={(event) =>
                  setUnknownProductDraft((draft) => ({ ...draft, costPrice: event.target.value }))
                }
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingUnknownProduct}>No, cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={creatingUnknownProduct || !unknownProductDraft.name.trim()}
              onClick={createUnknownProduct}
            >
              {creatingUnknownProduct ? "Adding..." : "Yes, add product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block truncate text-[10px] font-medium uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="truncate pr-2 text-xs">{label}</span>
      <span className="num text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function NewCustomerDialog({
  onCreated,
  requestedName,
  onRequestHandled,
  onNameOnly,
}: {
  onCreated: (c: CustomerRow) => void;
  requestedName?: string | null;
  onRequestHandled?: () => void;
  onNameOnly?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", gstin: "", address: "", credit: "0" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestedName) return;
    setForm({ name: requestedName, mobile: "", gstin: "", address: "", credit: "0" });
    setOpen(true);
    onRequestHandled?.();
  }, [onRequestHandled, requestedName]);

  function useNameOnly() {
    const name = form.name.trim();
    if (!name || !onNameOnly) return;
    setOpen(false);
    setForm({ name: "", mobile: "", gstin: "", address: "", credit: "0" });
    onNameOnly(name);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: form.name.trim().slice(0, 120),
        mobile: form.mobile.trim().slice(0, 15) || null,
        gstin: form.gstin.trim().slice(0, 20) || null,
        address: form.address.trim().slice(0, 300) || null,
        credit_limit: Number(form.credit) || 0,
      })
      .select("id,name,mobile,gstin,address,credit_limit,outstanding_balance")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Customer added");
    setOpen(false);
    setForm({ name: "", mobile: "", gstin: "", address: "", credit: "0" });
    onCreated(data as unknown as CustomerRow);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 px-3" aria-label="Add customer">
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>Add a shop to bill on credit or cash.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {(
            [
              ["name", "Shop / customer name", "Sharma Kirana Store"],
              ["mobile", "Mobile", "9820011111"],
              ["gstin", "GSTIN", "27AABCS1429B1ZX"],
              ["address", "Address", "Sector 12, Vashi"],
              ["credit", "Credit limit (₹)", "50000"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`c-${key}`}>{label}</Label>
              <Input
                id={`c-${key}`}
                value={form[key]}
                placeholder={placeholder}
                maxLength={key === "address" ? 300 : 120}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <DialogFooter>
            {onNameOnly && (
              <Button type="button" variant="outline" disabled={busy} onClick={useNameOnly}>
                Use name only
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
