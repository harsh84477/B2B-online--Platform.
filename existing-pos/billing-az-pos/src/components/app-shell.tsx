import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { todaySummaryQuery } from "@/lib/queries";
import { rupees } from "@/lib/pos";
import {
  LayoutDashboard,
  Receipt,
  LogOut,
  ScanBarcode,
  Moon,
  Sun,
  WifiOff,
  Package,
  Users,
  Truck,
  Boxes,
  ShoppingCart,
  Wallet,
  BarChart3,
  Settings,
  FileText,
  Undo2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/returns", label: "Returns", icon: Undo2 },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/purchases", label: "Purchases", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const STORAGE_KEY = "billingaz.sidebar.collapsed";

function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = time.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="text-right leading-tight">
      <div className="text-[11px] font-semibold text-sidebar-foreground/80">{dateStr}</div>
      <div className="text-xs font-bold text-sidebar-foreground num">{timeStr}</div>
    </div>
  );
}

function SidebarTodaySummary({ collapsed }: { collapsed: boolean }) {
  const { data } = useQuery(todaySummaryQuery());

  if (collapsed) {
    return (
      <div
        title={`Today's Sales: ${rupees(data?.salesTotal ?? 0)} · ${data?.billsCount ?? 0} bills`}
        className="my-1.5 flex flex-col items-center gap-0.5 rounded-md bg-sidebar-accent/25 py-1.5 text-center text-[10px]"
      >
        <span className="font-bold text-emerald-400 num">{data?.billsCount ?? 0}</span>
        <span className="text-[9px] text-sidebar-foreground/60">Today</span>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/25 p-2.5 text-xs text-sidebar-foreground shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-sidebar-border/60 pb-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-sidebar-foreground/60">
          Today
        </span>
        <LiveClock />
      </div>

      <div className="space-y-1 font-medium text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground/70">Bills</span>
          <span className="font-bold num">{data?.billsCount ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground/70">Sales</span>
          <span className="font-bold num text-emerald-400">
            {rupees(data?.salesTotal ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground/70">Items</span>
          <span className="font-bold num">{data?.itemsSold ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground/70">Held Bills</span>
          <span className="font-bold num text-amber-400">{data?.heldCount ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sidebar-foreground/70">Credit</span>
          <span className="font-bold num text-rose-400">
            {rupees(data?.creditDue ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  role,
  name,
}: {
  children: ReactNode;
  role: AppRole | null;
  name: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);
  const [online, setOnline] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (mobile: boolean) => (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        mobile ? "w-64" : collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ScanBarcode className="size-5" />
          </span>
          {(mobile || !collapsed) && (
            <span className="truncate text-lg font-extrabold tracking-tight">BillingAZ</span>
          )}
        </Link>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                !mobile && collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {(mobile || !collapsed) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <SidebarTodaySummary collapsed={!mobile && collapsed} />
        <div
          className={cn(
            "flex items-center gap-2",
            !mobile && collapsed && "flex-col",
          )}
        >
          {(mobile || !collapsed) && (
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-sm font-semibold leading-tight">{name || "Staff"}</p>
              <p className="truncate text-xs leading-tight text-sidebar-foreground/60">
                {role ?? "—"}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle dark mode"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setDark((d) => !d)}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={signOut}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        {!mobile && (
          <Button
            variant="ghost"
            className={cn(
              "mt-1 w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border md:block">
        {sidebar(false)}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 border-r border-sidebar-border">
            {sidebar(true)}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!online && (
          <div className="bg-destructive px-4 py-1.5 text-center text-sm font-medium text-destructive-foreground">
            <WifiOff className="mr-2 inline size-4" />
            You are offline — bills will sync when the connection returns
          </div>
        )}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <span className="text-lg font-extrabold tracking-tight">BillingAZ</span>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
