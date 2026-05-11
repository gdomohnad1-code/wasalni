import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Wallet,
  CreditCard,
  MessageSquareWarning,
  Car,
  TrendingUp,
  Shield,
  ShieldQuestion,
  LogOut,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/home" });
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/applicants", label: "المقدّمون", icon: ShieldQuestion },
  { to: "/admin/drivers", label: "السائقون", icon: Users },
  { to: "/admin/dues", label: "مستحقات الشركة", icon: Wallet },
  { to: "/admin/payouts", label: "سحوبات السائقين", icon: CreditCard },
  { to: "/admin/complaints", label: "الشكاوى", icon: MessageSquareWarning },
  { to: "/admin/rides", label: "الرحلات", icon: Car },
  { to: "/admin/reports", label: "التقارير", icon: TrendingUp },
  { to: "/admin/notifications", label: "الإشعارات", icon: Bell },
  { to: "/admin/admins", label: "المسؤولون", icon: Shield },
  { to: "/admin/permissions", label: "صلاحياتي", icon: ShieldQuestion },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ complaints: 0, payouts: 0 });

  const loadCounts = async () => {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("withdrawal_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setCounts({ complaints: c1 ?? 0, payouts: c2 ?? 0 });
  };

  useEffect(() => {
    loadCounts();
    const ch = supabase
      .channel("admin-counters")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, loadCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

  const isActive = (to: string, exact?: boolean) => exact ? path === to : path === to || path.startsWith(to + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const SidebarContent = (
    <>
      <div className="px-5 py-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center font-extrabold shadow-elegant">و</div>
          <div>
            <div className="font-extrabold text-lg leading-tight">وصلني</div>
            <div className="text-[11px] text-muted-foreground">لوحة الإدارة</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = isActive(n.to, (n as any).exact);
          const badge =
            n.to === "/admin/complaints" ? counts.complaints :
            n.to === "/admin/payouts" ? counts.payouts : 0;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-elegant"
                  : "text-foreground/80 hover:bg-muted"
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">{n.label}</span>
              {badge > 0 && (
                <Badge variant={active ? "secondary" : "destructive"} className="h-5 min-w-5 px-1.5 text-[10px]">
                  {badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-card border-l border-border sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-card border-l border-border flex flex-col animate-in slide-in-from-right">
            <button className="absolute top-3 left-3 p-1.5 rounded-md hover:bg-muted" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border h-14 flex items-center px-4 gap-3">
          <button className="lg:hidden p-2 -mr-2 rounded-md hover:bg-muted" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-base lg:text-lg flex-1 truncate">
            {NAV.find((n) => isActive(n.to, (n as any).exact))?.label ?? "الإدارة"}
          </h1>
          <div className="relative">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {(counts.complaints + counts.payouts) > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
                {counts.complaints + counts.payouts}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
