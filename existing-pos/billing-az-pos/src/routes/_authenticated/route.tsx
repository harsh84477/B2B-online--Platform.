import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, role, name } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell role={role} name={name}>
      <Outlet />
    </AppShell>
  );
}
