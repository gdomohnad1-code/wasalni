import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Copy, Gift, Share2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const { profile } = useAuth();
  const code = profile?.referral_code || "—";

  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  };

  const share = async () => {
    const text = `حمّل تطبيق وصلني واستخدم كود الدعوة: ${code} واكسب 50 جنيه على أول رحلة! 🚕✨`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success("تم نسخ رسالة الدعوة");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-2 p-4">
        <Link to="/profile" className="p-2 -m-2"><ArrowRight className="h-5 w-5" /></Link>
        <h1 className="font-bold text-lg">كود الدعوة</h1>
      </div>

      <div className="px-4">
        <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-6 shadow-elevated relative overflow-hidden">
          <Sparkles className="absolute -top-4 -right-4 h-32 w-32 opacity-10" />
          <Gift className="h-10 w-10 mb-2" />
          <h2 className="text-2xl font-black">شارك واربح 50 جنيه</h2>
          <p className="text-sm opacity-90 mt-1">لكل صديق ينضم بكودك ويعمل أول رحلة، تكسب 50 ج.م في محفظتك فوراً.</p>

          <div className="bg-white/15 backdrop-blur rounded-2xl p-4 mt-5 flex items-center gap-3">
            <span className="text-3xl font-black tracking-[0.25em] flex-1">{code}</span>
            <button onClick={copy} className="p-2 bg-white/20 rounded-xl"><Copy className="h-5 w-5" /></button>
          </div>

          <Button onClick={share} className="w-full mt-4 bg-white text-primary hover:bg-white/90 font-bold h-12">
            <Share2 className="h-4 w-4 ml-2" /> شارك واربح 50 جنيه
          </Button>
        </div>

        <div className="mt-4 bg-card rounded-2xl p-4 shadow-card text-sm space-y-2">
          <h3 className="font-bold mb-2">إزاي تشتغل؟</h3>
          <Step n={1} text="شارك الكود مع أصدقائك" />
          <Step n={2} text="صديقك يسجّل ويستخدم الكود" />
          <Step n={3} text="بعد أول رحلة ليه، 50 ج.م تتضاف لمحفظتك" />
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-sm">{n}</div>
      <span>{text}</span>
    </div>
  );
}
