import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  brand: string | null;
  purchase_price: number;
  selling_price: number;
  wholesale_price: number;
  mrp: number;
  gst_percent: number;
  hsn_code: string | null;
  base_unit: string;
  pack_name: string;
  pack_size: number;
  allow_piece_sale: boolean;
  allow_pack_sale: boolean;
  current_stock: number;
  min_stock_alert: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  mobile: string | null;
  gstin: string | null;
  address: string | null;
  credit_limit: number;
  outstanding_balance: number;
}

export interface ShopProfileRow {
  id: string;
  shop_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  bank_name: string | null;
  bank_account: string | null;
  ifsc: string | null;
  invoice_prefix: string;
  terms: string | null;
  whatsapp_template: string | null;
}

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_deleted", false)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ProductRow[];
    },
    staleTime: 30_000,
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });

export const customersQuery = () =>
  queryOptions({
    queryKey: ["customers"],
    queryFn: async (): Promise<CustomerRow[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,mobile,gstin,address,credit_limit,outstanding_balance")
        .eq("is_deleted", false)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CustomerRow[];
    },
    staleTime: 60_000,
  });

export const shopProfileQuery = () =>
  queryOptions({
    queryKey: ["shop_profile"],
    queryFn: async (): Promise<ShopProfileRow | null> => {
      const { data, error } = await supabase.from("shop_profile").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as unknown as ShopProfileRow | null;
    },
    staleTime: 300_000,
  });

export interface HeldBillRow {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_gstin: string | null;
  customer_address: string | null;
  grand_total: number;
  created_at: string;
}

export const heldBillsQuery = () =>
  queryOptions({
    queryKey: ["bills", "hold"],
    queryFn: async (): Promise<HeldBillRow[]> => {
      const { data, error } = await supabase
        .from("bills")
        .select(
          "id,invoice_number,customer_id,customer_name,customer_mobile,customer_gstin,customer_address,grand_total,created_at",
        )
        .eq("bill_type", "HOLD")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HeldBillRow[];
    },
    staleTime: 10_000,
  });

export const recentBillsQuery = () =>
  queryOptions({
    queryKey: ["bills", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select(
          "id,invoice_number,invoice_date,customer_name,grand_total,payment_mode,payment_status",
        )
        .eq("bill_type", "SALE")
        .eq("is_deleted", false)
        .order("invoice_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const dashboardStatsQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const [bills, customers, products] = await Promise.all([
        supabase
          .from("bills")
          .select("invoice_date,grand_total,payment_mode,amount_due")
          .eq("bill_type", "SALE")
          .eq("is_deleted", false)
          .gte("invoice_date", since.toISOString()),
        supabase.from("customers").select("id,outstanding_balance").eq("is_deleted", false),
        supabase
          .from("products")
          .select("id,name,current_stock,min_stock_alert")
          .eq("is_deleted", false),
      ]);
      if (bills.error) throw bills.error;
      if (customers.error) throw customers.error;
      if (products.error) throw products.error;
      return {
        bills: bills.data ?? [],
        customers: customers.data ?? [],
        products: products.data ?? [],
      };
    },
    staleTime: 30_000,
  });

export const topProductsQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "top-products"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("bill_items")
        .select("product_name,total_amount,quantity,bills!inner(invoice_date,bill_type,is_deleted)")
        .gte("bills.invoice_date", since.toISOString())
        .eq("bills.bill_type", "SALE")
        .eq("bills.is_deleted", false)
        .limit(2000);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of (data ?? []) as unknown as {
        product_name: string;
        total_amount: number;
      }[]) {
        map.set(row.product_name, (map.get(row.product_name) ?? 0) + Number(row.total_amount || 0));
      }
      return [...map.entries()]
        .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
    staleTime: 60_000,
  });

export interface TodaySummaryData {
  billsCount: number;
  salesTotal: number;
  itemsSold: number;
  heldCount: number;
  creditDue: number;
}

export const todaySummaryQuery = () =>
  queryOptions({
    queryKey: ["today", "summary"],
    queryFn: async (): Promise<TodaySummaryData> => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [billsRes, itemsRes, heldRes] = await Promise.all([
        supabase
          .from("bills")
          .select("grand_total,amount_due")
          .eq("bill_type", "SALE")
          .eq("is_deleted", false)
          .gte("invoice_date", startOfDay),
        supabase
          .from("bill_items")
          .select("quantity,bills!inner(invoice_date,bill_type,is_deleted)")
          .gte("bills.invoice_date", startOfDay)
          .eq("bills.bill_type", "SALE")
          .eq("bills.is_deleted", false),
        supabase
          .from("bills")
          .select("id", { count: "exact", head: true })
          .eq("bill_type", "HOLD")
          .eq("is_deleted", false),
      ]);

      const bills = billsRes.data ?? [];
      const items = itemsRes.data ?? [];

      const billsCount = bills.length;
      const salesTotal = bills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
      const creditDue = bills.reduce((sum, b) => sum + Number(b.amount_due || 0), 0);
      const itemsSold = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      const heldCount = heldRes.count ?? 0;

      return {
        billsCount,
        salesTotal,
        itemsSold,
        heldCount,
        creditDue,
      };
    },
    staleTime: 15_000,
  });

export interface DashboardOverview {
  today: {
    sales: number;
    profit: number;
    cash: number;
    online: number;
    orders: number;
    dueBills: number;
    dueCollected: number;
    dueAmount: number;
  };
  month: {
    sales: number;
    profit: number;
    orders: number;
    dueBills: number;
    dueCollected: number;
    dueAmount: number;
    cost: number;
    discount: number;
  };
  overall: {
    customers: number;
    inventoryValue: number;
    totalDue: number;
    draftBills: number;
    lowStock: number;
  };
  lowStockItems: { id: string; name: string; current_stock: number; min_stock_alert: number }[];
  daily: { day: string; total: number }[];
}

export const dashboardOverviewQuery = (month: string) =>
  queryOptions({
    queryKey: ["dashboard", "overview", month],
    queryFn: async (): Promise<DashboardOverview> => {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y!, (m ?? 1) - 1, 1);
      const end = new Date(y!, m ?? 1, 1);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const billSelect =
        "id,invoice_date,grand_total,amount_paid,amount_due,payment_mode,payment_status,total_discount";

      const [monthBills, todayBills, monthItems, todayItems, customers, products, drafts] =
        await Promise.all([
          supabase
            .from("bills")
            .select(billSelect)
            .eq("bill_type", "SALE")
            .eq("is_deleted", false)
            .gte("invoice_date", start.toISOString())
            .lt("invoice_date", end.toISOString()),
          supabase
            .from("bills")
            .select(billSelect)
            .eq("bill_type", "SALE")
            .eq("is_deleted", false)
            .gte("invoice_date", todayStart.toISOString()),
          supabase
            .from("bill_items")
            .select(
              "quantity,total_amount,taxable_amount,products(purchase_price),bills!inner(invoice_date,bill_type,is_deleted)",
            )
            .eq("bills.bill_type", "SALE")
            .eq("bills.is_deleted", false)
            .gte("bills.invoice_date", start.toISOString())
            .lt("bills.invoice_date", end.toISOString())
            .limit(5000),
          supabase
            .from("bill_items")
            .select(
              "quantity,total_amount,taxable_amount,products(purchase_price),bills!inner(invoice_date,bill_type,is_deleted)",
            )
            .eq("bills.bill_type", "SALE")
            .eq("bills.is_deleted", false)
            .gte("bills.invoice_date", todayStart.toISOString())
            .limit(5000),
          supabase
            .from("customers")
            .select("id,outstanding_balance")
            .eq("is_deleted", false),
          supabase
            .from("products")
            .select("id,name,current_stock,min_stock_alert,purchase_price")
            .eq("is_deleted", false),
          supabase
            .from("bills")
            .select("id", { count: "exact", head: true })
            .eq("bill_type", "HOLD")
            .eq("is_deleted", false),
        ]);

      type Bill = {
        invoice_date: string;
        grand_total: number;
        amount_paid: number;
        amount_due: number;
        payment_mode: string;
        total_discount: number;
      };
      type Item = { total_amount: number; quantity: number; products: { purchase_price: number } | null };

      const mb = (monthBills.data ?? []) as unknown as Bill[];
      const tb = (todayBills.data ?? []) as unknown as Bill[];
      const mi = (monthItems.data ?? []) as unknown as Item[];
      const ti = (todayItems.data ?? []) as unknown as Item[];
      const prods = products.data ?? [];

      const sum = (arr: Bill[], f: (b: Bill) => number) => arr.reduce((s, b) => s + Number(f(b) || 0), 0);
      const cost = (arr: Item[]) =>
        arr.reduce((s, i) => s + Number(i.products?.purchase_price || 0) * Number(i.quantity || 0), 0);
      const revenue = (arr: Item[]) => arr.reduce((s, i) => s + Number(i.total_amount || 0), 0);

      const cashModes = ["CASH"];
      const onlineModes = ["UPI", "CARD", "BANK_TRANSFER"];

      const monthCost = cost(mi);
      const lowStockItems = prods
        .filter((p) => Number(p.current_stock) <= Number(p.min_stock_alert))
        .map((p) => ({
          id: p.id,
          name: p.name,
          current_stock: Number(p.current_stock),
          min_stock_alert: Number(p.min_stock_alert),
        }));

      const daysInMonth = new Date(y!, m ?? 1, 0).getDate();
      const daily = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(y!, (m ?? 1) - 1, i + 1).toDateString();
        return {
          day: String(i + 1),
          total: Math.round(
            mb
              .filter((b) => new Date(b.invoice_date).toDateString() === d)
              .reduce((s, b) => s + Number(b.grand_total || 0), 0),
          ),
        };
      });

      return {
        today: {
          sales: sum(tb, (b) => b.grand_total),
          profit: revenue(ti) - cost(ti),
          cash: sum(tb.filter((b) => cashModes.includes(b.payment_mode)), (b) => b.amount_paid),
          online: sum(tb.filter((b) => onlineModes.includes(b.payment_mode)), (b) => b.amount_paid),
          orders: tb.length,
          dueBills: tb.filter((b) => Number(b.amount_due) > 0).length,
          dueCollected: sum(
            tb.filter((b) => Number(b.amount_due) > 0),
            (b) => b.amount_paid,
          ),
          dueAmount: sum(tb, (b) => b.amount_due),
        },
        month: {
          sales: sum(mb, (b) => b.grand_total),
          profit: revenue(mi) - monthCost,
          orders: mb.length,
          dueBills: mb.filter((b) => Number(b.amount_due) > 0).length,
          dueCollected: sum(
            mb.filter((b) => Number(b.amount_due) > 0),
            (b) => b.amount_paid,
          ),
          dueAmount: sum(mb, (b) => b.amount_due),
          cost: monthCost,
          discount: sum(mb, (b) => b.total_discount),
        },
        overall: {
          customers: (customers.data ?? []).length,
          inventoryValue: prods.reduce(
            (s, p) => s + Number(p.current_stock || 0) * Number(p.purchase_price || 0),
            0,
          ),
          totalDue: (customers.data ?? []).reduce((s, c) => s + Number(c.outstanding_balance || 0), 0),
          draftBills: drafts.count ?? 0,
          lowStock: lowStockItems.length,
        },
        lowStockItems,
        daily,
      };
    },
    staleTime: 20_000,
  });
