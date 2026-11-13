import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell, EmptyState } from "@/components/page";

export const Route = createFileRoute("/_authenticated/online-orders")({
  head: () => ({ meta: [{ title: "Online Orders — BillingAZ Wholesale POS" }] }),
  component: OnlineOrdersPage,
});

type OnlineOrder = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  created_at: string;
  updated_at: string;
  online_order_items: Array<{
    id: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
  }>;
};

function OnlineOrdersPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["online-orders"],
    queryFn: async (): Promise<OnlineOrder[]> => {
      const { data, error } = await supabase
        .from("online_orders" as never)
        .select("id,status,created_at,updated_at,online_order_items(id,product_name,sku,quantity,unit_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OnlineOrder[];
    },
    staleTime: 15_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ACCEPTED" | "REJECTED" }) => {
      const { error } = await supabase
        .from("online_orders" as never)
        .update({ status, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Order ${variables.status.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["online-orders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orders = query.data ?? [];
  return (
    <PageShell>
      <PageHeader
        title="Online Orders"
        subtitle="Review orders from the storefront before processing them in Billing."
      />
      {query.isLoading ? (
        <Card className="p-8 text-sm text-muted-foreground">Loading online orders…</Card>
      ) : query.error ? (
        <Card className="p-8 text-sm text-destructive">Unable to load online orders: {(query.error as Error).message}</Card>
      ) : orders.length === 0 ? (
        <Card><EmptyState icon={ClipboardList} title="No online orders yet" description="New storefront orders will appear here for review." /></Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Order {order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString("en-IN")}</p>
                </div>
                <Badge variant={order.status === "PENDING" ? "default" : "secondary"}>{order.status}</Badge>
              </div>
              <div className="mt-4 divide-y rounded-md border">
                {order.online_order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span><strong>{item.product_name}</strong><span className="ml-2 text-muted-foreground">{item.sku}</span></span>
                    <span className="font-semibold">× {item.quantity}</span>
                  </div>
                ))}
              </div>
              {order.status === "PENDING" && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: "REJECTED" })} disabled={updateStatus.isPending}>
                    <X /> Decline
                  </Button>
                  <Button onClick={() => updateStatus.mutate({ id: order.id, status: "ACCEPTED" })} disabled={updateStatus.isPending}>
                    <Check /> Accept order
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
