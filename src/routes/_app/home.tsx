import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  AlertTriangle, Sparkles, Wallet, ChevronLeft, Clock, MapPin, Crown,
  Bell, Menu, ShieldAlert,
} from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AdSlot } from "@/components/AdSlot";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RIDE_TYPES, type RideTypeKey } from "@/lib/pricing";
import { GoogleMap } from "@/components/GoogleMap";
import { BottomSheet, type SheetState } from "@/components/BottomSheet";
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
  const [sheet, setSheet] = useState<SheetState>("half");
  const [sos, setSos] = useState(false);

  const goBook = (type: RideTypeKey) => {
    if (type === "package") {
      setPkgAgreed(false);
      setPkgWarn(true);
      return;
    }
    navigate({ to: "/book", search: { type } });
  };

  const services = Object.keys(RIDE_TYPES) as RideTypeKey[];
  const firstName = profile?.full_name?.split(" ")[0] || t("home.guest");

  return (
    <div className="fixed inset-0 mx-auto max-w-md bg-background overflow-hidden">
      {/* Full-screen minimalist map */}
      <GoogleMap className="absolute inset-0" fallback={{ center: { lat: 30.0444, lng: 31.2357 }, zoom: 12 }} interactive />

      {/* Soft top vignette so pills read on any tile */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/60 to-transparent z-10" />

      {/* ── Top floating chrome ── */}
      <div className="absolute inset-x-0 top-0 z-20 pt-4 px-4 flex items-start justify-between gap-3">
        {/* Menu + greeting glass pill */}
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="glass-pill rounded-full flex items-center gap-2.5 pr-2 pl-4 py-2 min-w-0"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground shrink-0">
            <Menu className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-right leading-tight">
            <div className="text-[10px] text-muted-foreground">{t("home.hello")}</div>
            <div className="text-[13px] font-bold truncate max-w-[110px]">{firstName}</div>
          </div>
        </button>

        {/* Right controls stack */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSos(true)}
              className="glass-pill h-10 w-10 rounded-full grid place-items-center text-destructive"
              aria-label="SOS"
            >
              <ShieldAlert className="h-5 w-5" />
            </button>
            <div className="glass-pill h-10 w-10 rounded-full grid place-items-center">
              <NotificationCenter />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sliding bottom sheet ── */}
      <BottomSheet state={sheet} onStateChange={setSheet} heights={{ collapsed: 168, half: 420, full: 680 }}>
        <div className="px-5 pb-6 space-y-5">
          {/* Primary CTA card */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate({ to: "/book", search: { type: "private" } })}
            className="w-full rounded-2xl bg-gradient-primary text-primary-foreground p-4 flex items-center gap-3 shadow-elevated"
          >
            <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 grid place-items-center">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex-1 text-start">
              <div className="text-[11px] opacity-80">{t("home.book_now")}</div>
              <div className="text-[15px] font-black tracking-tight">{t("home.cta")}</div>
            </div>
            <ChevronLeft className="h-5 w-5 opacity-80" />
          </motion.button>

          {/* Wallet */}
          <button
            onClick={() => navigate({ to: "/wallet" })}
            className="w-full rounded-2xl bg-card border border-border p-3.5 flex items-center gap-3 text-right shadow-soft"
          >
            <div className="h-10 w-10 rounded-xl bg-success/10 text-success grid place-items-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">{t("home.wallet")}</div>
              <div className="text-lg font-black leading-tight text-foreground">
                {Number(profile?.wallet_balance ?? 0).toFixed(0)}
                <span className="text-xs font-bold text-muted-foreground mr-1">ج.م</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Services grid */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-black text-[15px] tracking-tight">{t("home.services")}</h3>
              <div className="flex items-center gap-1 text-[10px] font-bold text-vip">
                <Crown className="h-3 w-3" /> Premium
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {services.map((key, i) => {
                const v = RIDE_TYPES[key];
                const isVip = key === "vip";
                return (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, ease: "easeOut" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => goBook(key)}
                    className={`group relative overflow-hidden rounded-2xl border p-3.5 text-right shadow-soft transition
                      ${isVip
                        ? "bg-gradient-vip border-vip/40 text-vip-foreground"
                        : "bg-card border-border hover:border-primary/40 hover:shadow-card"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl grid place-items-center text-xl ${isVip ? "bg-white/20" : "bg-muted"}`}>
                        {v.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-[13.5px] leading-tight truncate">{v.label}</div>
                        <div className={`text-[10.5px] mt-0.5 leading-tight line-clamp-1 ${isVip ? "opacity-80" : "text-muted-foreground"}`}>
                          {v.desc}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Offers rail */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-bold text-muted-foreground">{t("home.offers")}</h3>
              <Sparkles className="h-3.5 w-3.5 text-vip" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-5 px-5">
              {offers.map((o) => (
                <div
                  key={o.title}
                  className="min-w-[240px] rounded-xl p-3 bg-card border border-border flex items-center gap-2.5 shadow-soft"
                >
                  <div className="text-2xl">{o.glyph}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] truncate">{o.title}</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">{o.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ads slot */}
          <AdSlot placement="home" />

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: Clock, label: t("home.my_trips"), to: "/trips" },
              { icon: MapPin, label: t("home.destinations"), to: "/profile" },
              { icon: Bell, label: "الإشعارات", to: "/profile" },
            ].map(({ icon: I, label, to }) => (
              <button
                key={label}
                onClick={() => navigate({ to: to as any })}
                className="bg-card rounded-xl py-3 border border-border flex flex-col items-center gap-1 hover:border-primary/40 transition shadow-soft"
              >
                <I className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-bold">{label}</span>
              </button>
            ))}
          </div>

          {/* Driver preview */}
          <button
            onClick={() => navigate({ to: "/driver" })}
            className="w-full text-[11px] font-bold text-muted-foreground py-2 border border-dashed border-border rounded-lg hover:text-primary transition"
          >
            🚗 معاينة شاشة السائق
          </button>
        </div>
      </BottomSheet>

      {/* Package legal warning */}
      <Dialog open={pkgWarn} onOpenChange={(o) => { setPkgWarn(o); if (!o) setPkgAgreed(false); }}>
        <DialogContent dir="rtl" className="rounded-2xl">
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
            <li>• <b>ممنوع</b> شحن أي مواد محظورة قانوناً.</li>
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

      {/* SOS modal */}
      <Dialog open={sos} onOpenChange={setSos}>
        <DialogContent dir="rtl" className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> طوارئ
            </DialogTitle>
            <DialogDescription className="text-right pt-2">
              اختر الجهة التي تريد الاتصال بها فوراً.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <a href="tel:122" className="block w-full rounded-xl bg-destructive text-destructive-foreground py-3 text-center font-bold shadow-elevated">📞 الشرطة 122</a>
            <a href="tel:123" className="block w-full rounded-xl bg-card border border-border py-3 text-center font-bold">🚑 الإسعاف 123</a>
            <a href="tel:180" className="block w-full rounded-xl bg-card border border-border py-3 text-center font-bold">🚒 المطافي 180</a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
