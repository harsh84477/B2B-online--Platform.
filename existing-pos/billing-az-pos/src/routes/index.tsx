import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ScanBarcode } from "lucide-react";
import { useAuth, ROLE_HOME } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "BillingAZ — Wholesale POS for Kirana Distributors" },
      {
        name: "description",
        content:
          "Fast wholesale billing with case/piece quantities, GST tax invoices, FIFO batch stock, credit ledgers and thermal printing.",
      },
      { property: "og:title", content: "BillingAZ — Wholesale POS" },
      {
        property: "og:description",
        content: "Bill a wholesale order in under 10 seconds. GST invoices, batches and credit ledgers.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (role) navigate({ to: ROLE_HOME[role], replace: true });
  }, [loading, session, role, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex items-center gap-3 text-primary">
        <ScanBarcode className="size-8" />
        <h1 className="text-2xl font-extrabold tracking-tight">BillingAZ</h1>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Opening your counter…
      </p>
    </main>
  );
}
