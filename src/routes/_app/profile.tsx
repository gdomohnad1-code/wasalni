import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Gift, Headphones, Home, Settings as SettingsIcon, Star, Wallet, History, Car, ShieldCheck, LogOut } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, roles, signOut } = useAuth();
  const isAdmin = roles?.includes("admin");
  const isDriver = roles?.includes("driver");

  return (
    <div className="max-w-md mx-auto pb-8">
      {/* بطاقة المستخدم — Uber Light */}
      <div className="bg-background border-b border-border p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted overflow-hidden border border-border shrink-0">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              : <div className="h-full w-full flex items-center justify-center text-2xl">👤</div>}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate text-foreground">{profile?.full_name || "—"}</h2>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
              <span className="text-xs font-bold">{profile?.rating?.toFixed(1) || "5.0"}</span>
              <span className="text-xs text-muted-foreground mx-1">•</span>
              <span className="text-xs">{profile?.wallet_balance?.toFixed(0) || 0} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-3">
        {/* القائمة الرئيسية */}
        <Section>
          <Item to="/home" icon={Home} label="الرئيسية" emoji="🏠" />
          <Item to="/trips" icon={History} label="رحلاتي السابقة" emoji="🚗" />
          <Item to="/wallet" icon={Wallet} label="المحفظة" emoji="💰" />
          <Item to="/referral" icon={Gift} label="كود الدعوة" emoji="🎁" badge="اربح 50 ج.م" />
          <Item to="/support" icon={Headphones} label="الدعم والشكاوى" emoji="🛠️" badge="AI" />
          <Item to="/settings" icon={SettingsIcon} label="الإعدادات" emoji="⚙️" />
        </Section>

        {/* انضم كسائق */}
        {!isDriver && (
          <Link to="/driver" className="block">
            <div className="rounded-2xl bg-gradient-to-l from-primary to-primary/70 text-primary-foreground p-4 shadow-elevated flex items-center gap-3 group">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">🚕</div>
              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  انضم كسائق مع وصلني
                  <span className="text-[10px] bg-white text-primary font-black px-1.5 py-0.5 rounded">جديد</span>
                </div>
                <div className="text-xs opacity-90">سجّل دلوقتي وابدأ تكسب من رحلاتك</div>
              </div>
              <ChevronLeft className="h-5 w-5 opacity-80 group-hover:-translate-x-1 transition" />
            </div>
          </Link>
        )}

        {/* لوحة الإدارة */}
        {isAdmin && (
          <Link to="/admin">
            <Button className="w-full gap-2 bg-gradient-primary">
              <ShieldCheck className="h-4 w-4" /> فتح لوحة الإدارة
            </Button>
          </Link>
        )}

        <Button onClick={signOut} variant="outline" className="w-full text-destructive border-destructive/30 mt-2">
          <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
        </Button>

        <p className="text-center text-[11px] text-muted-foreground pt-2">وصلني • الإصدار 1.0</p>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">{children}</div>;
}

function Item({ to, icon: Icon, label, emoji, badge }: { to: string; icon: any; label: string; emoji: string; badge?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg">{emoji}</div>
      <span className="flex-1 font-semibold text-sm">{label}</span>
      {badge && <span className="text-[10px] bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full">{badge}</span>}
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
