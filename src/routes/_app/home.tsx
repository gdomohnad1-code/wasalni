import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  AlertTriangle, Sparkles, Wallet, ChevronLeft,
  Clock, MapPin, Crown,
} from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AdSlot } from "@/components/AdSlot";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RIDE_TYPES, type RideTypeKey } from "@/lib/pricing";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

const offers = [
  { title: "خصم 25% على أول رحلة", sub: "كود: WSL25", glyph: "🎁" },
  { title: "وصلني مميز بسعر العادي", sub: "لمدة محدودة", glyph: "🌟" },
  { title: "ادعو صديق واكسب 30 ج.م", sub: "نظام الإحالة", glyph: "🤝" },
];

function HomePage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [pkgWarn, setPkgWarn] = useState(false);
  const [pkgAgreed, setPkgAgreed] = useState(false);

  const goBook = (type: RideTypeKey) => {
    if (type === "package") {
      setPkgAgreed(false);
      setPkgWarn(true);
      return;
    }
    navigate({ to: "/book", search: { type } });
  };

  const services = (Object.keys(RIDE_TYPES) as RideTypeKey[]);

  return (
    <div className="max-w-md mx-auto pb-8 relative">
      {/* Header — Uber Light */}
      <div className="px-5 pt-6 pb-4 bg-background border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-muted-foreground">{t("home.hello")}</p>
            <h2 className="text-xl font-black mt-0.5 text-foreground">{profile?.full_name || t("home.guest")}</h2>
          </div>
          <NotificationCenter />

        </div>

        {/* wallet */}
        <button onClick={() => navigate({ to: "/wallet" })}
          className="mt-4 w-full rounded-lg bg-muted p-3.5 flex items-center gap-3 text-right">
          <div className="h-10 w-10 rounded-md bg-foreground grid place-items-center text-background">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-muted-foreground">{t("home.wallet")}</div>
            <div className="text-xl font-black leading-tight text-foreground">
              {Number(profile?.wallet_balance ?? 0).toFixed(0)}
              <span className="text-xs font-bold text-muted-foreground mr-1">ج.م</span>
            </div>
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Primary CTA — flat black */}
      <div className="px-5 mt-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate({ to: "/book", search: { type: "private" } })}
          className="w-full rounded-lg bg-primary text-primary-foreground p-4 flex items-center justify-between"
        >
          <div className="text-start">
            <div className="text-[11px] opacity-80">{t("home.book_now")}</div>
            <div className="text-base font-black">{t("home.cta")}</div>
          </div>
          <div className="h-10 w-10 rounded-md bg-white/10 grid place-items-center">
            <ChevronLeft className="h-5 w-5" />
          </div>
        </motion.button>
      </div>

      {/* Ads */}
      <div className="px-5 mt-4">
        <AdSlot placement="home" />
      </div>

      {/* Services — clean uniform grid */}
      <div className="px-5 mt-7">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-black text-lg tracking-tight">{t("home.services")}</h3>
          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
            <Crown className="h-3 w-3" /> Premium
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {services.map((key, i) => {
            const v = RIDE_TYPES[key];
            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => goBook(key)}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card text-right p-3.5 hover:border-primary/40 hover:shadow-card transition"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-muted grid place-items-center text-xl">
                    {v.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[14px] leading-tight truncate">{v.label}</div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{v.desc}</div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Offers — compact single row */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-muted-foreground">{t("home.offers")}</h3>
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-5 px-5">
          {offers.map((o) => (
            <div key={o.title}
              className="min-w-[220px] rounded-xl p-3 bg-card border border-border flex items-center gap-2.5">
              <div className="text-2xl">{o.glyph}</div>
              <div className="min-w-0">
                <div className="font-bold text-[13px] truncate">{o.title}</div>
                <div className="text-[10.5px] text-muted-foreground truncate">{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-6">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Clock, label: t("home.my_trips"), to: "/trips" },
            { icon: MapPin, label: t("home.destinations"), to: "/profile" },
            { icon: Wallet, label: t("home.wallet"), to: "/wallet" },
          ].map(({ icon: I, label, to }) => (
            <button key={label}
              onClick={() => navigate({ to: to as any })}
              className="bg-card rounded-xl py-3 border border-border flex flex-col items-center gap-1 hover:border-primary/40 transition">
              <I className="h-4.5 w-4.5 text-primary" />
              <span className="text-[11px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Package legal warning — must agree */}
      <Dialog open={pkgWarn} onOpenChange={(o) => { setPkgWarn(o); if (!o) setPkgAgreed(false); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> تنبيه إجباري — توصيل طرد
            </DialogTitle>
            <DialogDescription className="text-right pt-3 leading-relaxed text-foreground/80">
              قبل المتابعة يجب الموافقة على الشروط التالية:
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm text-foreground/90 bg-warning/5 border border-warning/20 rounded-xl p-3">
            <li>• الحد الأقصى للوزن: <b>30 كجم</b>.</li>
            <li>• خدمة <b>من باب لباب</b> فقط.</li>
            <li>• <b>ممنوع</b> شحن أي مواد محظورة قانوناً (مخدرات، أسلحة، مواد قابلة للاشتعال…).</li>
            <li>• المسؤولية القانونية الكاملة على المُرسِل.</li>
          </ul>

          <label className="flex items-start gap-2 cursor-pointer mt-2">
            <Checkbox checked={pkgAgreed} onCheckedChange={(v) => setPkgAgreed(!!v)} className="mt-0.5" />
            <span className="text-sm font-semibold">أوافق على الشروط وأتحمل المسؤولية القانونية.</span>
          </label>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPkgWarn(false)}>إلغاء</Button>
            <Button
              disabled={!pkgAgreed}
              onClick={() => { setPkgWarn(false); navigate({ to: "/book", search: { type: "package" } }); }}
            >
              موافق وأكمل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
