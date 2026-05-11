import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { Home, Wallet, History, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id);
    if (roles?.some((r) => r.role === "admin")) throw redirect({ to: "/admin" });
  },
  component: AppLayout,
});

const tabs = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/profile", label: "حسابي", icon: User },
] as const;

function AppLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border shadow-elevated z-40">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = loc.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1 py-2.5 transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""}`} />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
