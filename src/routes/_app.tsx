import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { Home, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useRideNotifications } from "@/hooks/use-ride-notifications";
import { usePricingSync } from "@/hooks/use-pricing-sync";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const uid = data.session.user.id;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (roles?.some((r) => r.role === "admin")) throw redirect({ to: "/admin" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", uid)
      .maybeSingle();
    if (!profile?.phone || profile.phone.trim().length === 0) {
      throw redirect({ to: "/complete-profile" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const loc = useLocation();
  const { t } = useI18n();
  useRideNotifications();
  usePricingSync();
  const tabs = [
    { to: "/home", label: t("nav.home"), icon: Home },
    { to: "/profile", label: t("nav.account"), icon: User },
  ] as const;
  // Full-screen map routes hide the tab bar (their sheet owns the chrome)
  const isImmersive =
    loc.pathname === "/home" ||
    loc.pathname.startsWith("/book") ||
    loc.pathname.startsWith("/ride/");
  return (
    <div className={`min-h-screen bg-background ${isImmersive ? "" : "pb-20"}`}>
      <Outlet />
      {!isImmersive && (
        <nav className="fixed bottom-0 inset-x-0 bg-card/90 backdrop-blur-lg border-t border-border z-40">
          <div className="max-w-md mx-auto grid grid-cols-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = loc.pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex flex-col items-center gap-1 py-3 transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "scale-110" : ""}`} />
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
