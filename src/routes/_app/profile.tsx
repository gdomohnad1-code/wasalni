import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Copy, Share2, LogOut, Star, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, signOut } = useAuth();

  const copyCode = () => {
    if (!profile?.referral_code) return;
    navigator.clipboard.writeText(profile.referral_code);
    toast.success("تم نسخ الكود");
  };

  const share = async () => {
    if (!profile?.referral_code) return;
    const text = `حمّل تطبيق وصلني واستخدم كود الدعوة: ${profile.referral_code} واكسب 30 جنيه! 🚕`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success("تم نسخ رسالة الدعوة");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 pb-16 rounded-b-3xl">
        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur overflow-hidden border-4 border-white/40">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-3xl">👤</div>
            )}
          </div>
          <h2 className="font-bold text-xl mt-3">{profile?.full_name}</h2>
          <p className="text-sm opacity-90">{user?.email}</p>
          <div className="flex items-center gap-1 mt-2">
            <Star className="h-4 w-4 fill-warning text-warning" />
            <span className="font-bold">{profile?.rating?.toFixed(1) || "5.0"}</span>
          </div>
        </div>
      </div>

      <div className="p-4 -mt-10 space-y-3">
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">كود الدعوة</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">شارك الكود واكسب 30 ج.م لكل صديق ينضم</p>
          <div className="flex items-center gap-2 bg-muted p-3 rounded-xl">
            <span className="font-black text-lg flex-1 tracking-wider text-primary">{profile?.referral_code}</span>
            <Button size="icon" variant="ghost" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
            <Button size="icon" onClick={share} className="bg-gradient-primary"><Share2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-card divide-y divide-border">
          <Row label="رقم التليفون" value={profile?.phone || "—"} />
          <Row label="رصيد المحفظة" value={`${profile?.wallet_balance || 0} ج.م`} />
        </div>

        <Button onClick={signOut} variant="outline" className="w-full text-destructive border-destructive/30">
          <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between p-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
