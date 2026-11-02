import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupplierRow {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  outstanding_balance: number;
  is_active: boolean;
}

export const suppliersQuery = () =>
  queryOptions({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<SupplierRow[]> => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name,mobile,email,gstin,address,outstanding_balance,is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as SupplierRow[];
    },
    staleTime: 60_000,
  });

export interface CreditNoteRow {
  id: string;
  credit_note_number: string;
  note_date: string;
  customer_name: string | null;
  sub_total: number;
  gst_amount: number;
  net_amount: number;
  adjustment_type: string;
  reason: string | null;
}

export const creditNotesQuery = () =>
  queryOptions({
    queryKey: ["credit_notes"],
    queryFn: async (): Promise<CreditNoteRow[]> => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select(
          "id,credit_note_number,note_date,customer_name,sub_total,gst_amount,net_amount,adjustment_type,reason",
        )
        .order("note_date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as CreditNoteRow[];
    },
    staleTime: 20_000,
  });

/** All products including inactive ones — for management screens. */
export const allProductsQuery = () =>
  queryOptions({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_deleted", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const batchesQuery = () =>
  queryOptions({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select(
          "id,batch_number,expiry_date,purchase_price,quantity_base_units,remaining_quantity,created_at,product_id,products(name,pack_name,pack_size,base_unit)",
        )
        .gt("remaining_quantity", 0)
        .order("expiry_date", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const stockMovementsQuery = () =>
  queryOptions({
    queryKey: ["stock_movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id,type,quantity,note,created_at,product_id,products(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const purchaseOrdersQuery = () =>
  queryOptions({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "id,invoice_number,invoice_date,sub_total,total_gst,grand_total,amount_paid,status,supplier_id,suppliers(name)",
        )
        .order("invoice_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const expenseCategoriesQuery = () =>
  queryOptions({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id,name,is_active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });

export const expensesQuery = () =>
  queryOptions({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,amount,description,date,expense_category_id,expense_categories(name)")
        .order("date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export interface BillListRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  customer_mobile: string | null;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  payment_mode: string;
  payment_status: string;
  bill_type: string;
}

export const billsQuery = () =>
  queryOptions({
    queryKey: ["bills", "all"],
    queryFn: async (): Promise<BillListRow[]> => {
      const { data, error } = await supabase
        .from("bills")
        .select(
          "id,invoice_number,invoice_date,customer_name,customer_mobile,grand_total,amount_paid,amount_due,payment_mode,payment_status,bill_type",
        )
        .eq("is_deleted", false)
        .neq("bill_type", "HOLD")
        .order("invoice_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as BillListRow[];
    },
    staleTime: 20_000,
  });

export const billDetailQuery = (billId: string | null) =>
  queryOptions({
    queryKey: ["bill", billId],
    enabled: !!billId,
    queryFn: async () => {
      const [bill, items, payments] = await Promise.all([
        supabase.from("bills").select("*").eq("id", billId!).maybeSingle(),
        supabase.from("bill_items").select("*").eq("bill_id", billId!),
        supabase.from("bill_payments").select("*").eq("bill_id", billId!),
      ]);
      if (bill.error) throw bill.error;
      if (items.error) throw items.error;
      if (payments.error) throw payments.error;
      return { bill: bill.data, items: items.data ?? [], payments: payments.data ?? [] };
    },
    staleTime: 30_000,
  });

export const customerLedgerQuery = (customerId: string | null) =>
  queryOptions({
    queryKey: ["customer-ledger", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const [bills, payments] = await Promise.all([
        supabase
          .from("bills")
          .select("id,invoice_number,invoice_date,grand_total,amount_due,payment_status")
          .eq("customer_id", customerId!)
          .eq("is_deleted", false)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("bill_payments")
          .select("id,amount,mode,reference_number,paid_at,bill_id")
          .eq("customer_id", customerId!)
          .order("paid_at", { ascending: false }),
      ]);
      if (bills.error) throw bills.error;
      if (payments.error) throw payments.error;
      return { bills: bills.data ?? [], payments: payments.data ?? [] };
    },
    staleTime: 20_000,
  });

export const staffQuery = () =>
  queryOptions({
    queryKey: ["staff"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id,name,email,is_active,created_at"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      const roleMap = new Map((roles.data ?? []).map((r) => [r.user_id, r.role as string]));
      return (profiles.data ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "—" }));
    },
    staleTime: 60_000,
  });

/** Sales rows within a date range, used by the reports module. */
export const salesRangeQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["reports", "sales", from, to],
    queryFn: async () => {
      const [bills, items] = await Promise.all([
        supabase
          .from("bills")
          .select(
            "id,invoice_number,invoice_date,customer_name,sub_total,total_discount,total_gst,grand_total,payment_mode,amount_due",
          )
          .eq("bill_type", "SALE")
          .eq("is_deleted", false)
          .gte("invoice_date", from)
          .lte("invoice_date", to)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("bill_items")
          .select(
            "product_name,quantity,gst_percent,taxable_amount,cgst,sgst,total_amount,bills!inner(invoice_date,bill_type,is_deleted)",
          )
          .eq("bills.bill_type", "SALE")
          .eq("bills.is_deleted", false)
          .gte("bills.invoice_date", from)
          .lte("bills.invoice_date", to)
          .limit(5000),
      ]);
      if (bills.error) throw bills.error;
      if (items.error) throw items.error;
      return { bills: bills.data ?? [], items: items.data ?? [] };
    },
    staleTime: 30_000,
  });
