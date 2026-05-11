import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Bell, AlertTriangle, Sparkles, Wallet, ShieldCheck, ChevronLeft,
  Clock, MapPin, Star, Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
      {/* Luxe header */}
      <div className="relative overflow-hidden rounded-b-[2rem] shadow-elevated">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1a14] via-[#0e2b1f] to-[#06120c]" />
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-amber-300/15 blur-3xl" />

        <div className="relative px-5 pt-6 pb-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur grid place-items-center text-lg font-black ring-1 ring-white/20">و</div>
              <div>
                <div className="text-[11px] tracking-widest text-white/60 uppercase">Wasalni · Premium</div>
                <div className="text-base font-extrabold">وصلني</div>
              </div>
            </div>
            <button className="relative h-10 w-10 rounded-full bg-white/10 backdrop-blur grid place-items-center ring-1 ring-white/15">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#0e2b1f]" />
            </button>
          </div>

          <div className="mt-6">
            <p className="text-sm text-white/70">أهلاً بعودتك</p>
            <h2 className="text-2xl font-black mt-0.5">{profile?.full_name || "ضيفنا الكريم"}</h2>
          </div>

          {/* glass wallet card */}
          <div className="mt-5 rounded-2xl bg-white/10 backdrop-blur-xl ring-1 ring-white/15 p-4 flex items-center gap-3 shadow-soft">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 grid place-items-center text-[#0e2b1f]">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-white/60">رصيد المحفظة</div>
              <div className="text-2xl font-black leading-tight">
                {Number(profile?.wallet_balance ?? 0).toFixed(0)}
                <span className="text-sm font-bold text-white/70 mr-1">ج.م</span>
              </div>
            </div>
            <button onClick={() => navigate({ to: "/wallet" })}
              className="text-xs font-bold bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-lg ring-1 ring-white/15">
              شحن
            </button>
          </div>

          {/* trust strip */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-[10.5px]">
            {[
              { icon: ShieldCheck, t: "سائقون موثقون" },
              { icon: Sparkles, t: "خدمة 24/7" },
              { icon: Star, t: "أعلى تقييم" },
            ].map(({ icon: I, t }) => (
              <div key={t} className="flex items-center gap-1.5 text-white/80 bg-white/5 rounded-lg px-2 py-1.5 ring-1 ring-white/10">
                <I className="h-3.5 w-3.5 text-amber-300" />
                <span className="font-semibold">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Big primary CTA */}
      <div className="px-5 -mt-5 relative z-10">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate({ to: "/book", search: { type: "private" } })}
          className="w-full rounded-2xl bg-gradient-to-l from-primary to-primary-glow text-primary-foreground p-4 shadow-elevated flex items-center justify-between"
        >
          <div className="text-right">
            <div className="text-xs opacity-90">احجز الآن</div>
            <div className="text-lg font-black">وصلني فوراً 🚕</div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/15 grid place-items-center backdrop-blur">
            <ChevronLeft className="h-6 w-6" />
          </div>
        </motion.button>
      </div>

      {/* Offers */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-muted-foreground">عروض حصرية</h3>
          <Sparkles className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-5 px-5">
          {offers.map((o, i) => (
            <motion.div
              key={o.title}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="min-w-[260px] snap-center rounded-2xl p-4 shadow-card relative overflow-hidden bg-card border border-border"
            >
              <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex items-start gap-3">
                <div className="text-3xl">{o.glyph}</div>
                <div>
                  <div className="font-extrabold">{o.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.sub}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Services — luxe bento */}
      <div className="px-5 mt-7">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="font-black text-xl tracking-tight">اختر خدمتك</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">5 خدمات مصممة لراحتك</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full ring-1 ring-amber-500/20">
            <Crown className="h-3 w-3" /> Premium
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2.5">
          {services.map((key, i) => {
            const v = RIDE_TYPES[key];
            const span = i === 0 ? "col-span-6" : "col-span-3";
            const big = i === 0;
            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 120 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => goBook(key)}
                className={`${span} group relative overflow-hidden rounded-2xl border border-border/60 bg-card text-right shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all`}
              >
                <div className={`absolute inset-0 bg-gradient-to-bl ${v.accent} opacity-90`} />
                <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-white/40 blur-2xl opacity-60 group-hover:opacity-90 transition" />

                <div className={`relative ${big ? "p-5" : "p-3.5"}`}>
                  {big ? (
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-white/80 backdrop-blur grid place-items-center text-3xl shadow-soft ring-1 ring-white/60">
                        {v.icon}
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded">الأكثر طلباً</span>
                        <div className="font-black text-lg mt-1">{v.label}</div>
                        <div className="text-[12px] text-foreground/70 mt-0.5 leading-snug">{v.desc}</div>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-soft">
                        <ChevronLeft className="h-5 w-5" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2 min-h-[120px]">
                      <div className="h-11 w-11 rounded-xl bg-white/80 backdrop-blur grid place-items-center text-xl shadow-soft ring-1 ring-white/60">
                        {v.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-extrabold text-[14px] leading-tight">{v.label}</div>
                        <div className="text-[10.5px] text-foreground/65 mt-0.5 leading-tight line-clamp-2">{v.desc}</div>
                      </div>
                      <div className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                        احجز <ChevronLeft className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Clock, label: "رحلاتي", to: "/trips" },
            { icon: MapPin, label: "وجهاتي", to: "/profile" },
            { icon: Wallet, label: "المحفظة", to: "/wallet" },
          ].map(({ icon: I, label, to }) => (
            <button key={label}
              onClick={() => navigate({ to: to as any })}
              className="bg-card rounded-2xl p-3 border border-border flex flex-col items-center gap-1.5 shadow-card hover:shadow-elevated transition">
              <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                <I className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-bold">{label}</span>
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
