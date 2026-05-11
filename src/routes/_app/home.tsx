import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Bell, MapPin, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { RIDE_TYPES, type RideTypeKey } from "@/lib/pricing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

const offers = [
  { title: "خصم 25% أول رحلة", sub: "كود: WSL25", color: "bg-gradient-primary" },
  { title: "وصلني VIP بـ 50 جنيه فقط", sub: "لمدة محدودة", color: "bg-gradient-hero" },
  { title: "ادعو صديق واكسب 30 ج.م", sub: "نظام الإحالة", color: "bg-gradient-primary" },
];

function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [pkgWarn, setPkgWarn] = useState(false);
  const [pendingType, setPendingType] = useState<RideTypeKey | null>(null);

  const goBook = (type: RideTypeKey) => {
    if (type === "package") {
      setPendingType(type);
      setPkgWarn(true);
      return;
    }
    navigate({ to: "/book", search: { type } });
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-hero text-primary-foreground px-5 pt-6 pb-10 rounded-b-3xl shadow-soft">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm opacity-90">أهلاً بك</p>
            <h2 className="text-xl font-bold">{profile?.full_name || "مستخدم وصلني"} 👋</h2>
          </div>
          <button className="relative h-10 w-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-warning" />
          </button>
        </div>

        <div className="bg-white/15 backdrop-blur rounded-2xl p-4 flex items-center gap-3">
          <MapPin className="h-5 w-5" />
          <div className="flex-1 text-sm">
            <div className="opacity-80 text-xs">الرصيد</div>
            <div className="font-bold text-lg">{profile?.wallet_balance?.toFixed(0) || 0} ج.م</div>
          </div>
        </div>
      </div>

      {/* Offers Carousel */}
      <div className="px-5 -mt-6 mb-5">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {offers.map((o, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`${o.color} text-primary-foreground min-w-[260px] snap-center rounded-2xl p-4 shadow-card`}
            >
              <div className="font-bold text-base">{o.title}</div>
              <div className="text-xs opacity-90 mt-1">{o.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="px-5 mb-5">
        <h3 className="font-bold text-lg mb-3">اختر خدمتك</h3>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(RIDE_TYPES) as [RideTypeKey, typeof RIDE_TYPES[RideTypeKey]][]).map(([key, val]) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => goBook(key)}
              className="bg-card rounded-2xl p-4 shadow-card flex flex-col items-center gap-2 hover:shadow-soft transition border border-border"
            >
              <div className="text-3xl">{val.icon}</div>
              <span className="text-xs font-semibold text-center">{val.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Big CTA */}
      <div className="px-5">
        <Button
          onClick={() => navigate({ to: "/book", search: { type: "private" } })}
          className="w-full h-16 text-lg font-black bg-gradient-primary shadow-elevated rounded-2xl"
        >
          🚕 وصلني الآن
        </Button>
      </div>

      <Dialog open={pkgWarn} onOpenChange={setPkgWarn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> تنبيه — توصيل طرد
            </DialogTitle>
            <DialogDescription className="text-right pt-3 leading-relaxed">
              ممنوع شحن مواد خطرة أو ممنوعات. تأكد من تغليف الطرد جيداً وكتابة بيانات المستلم بدقة.
              المسؤولية القانونية على المرسل بالكامل.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPkgWarn(false)}>إلغاء</Button>
            <Button onClick={() => { setPkgWarn(false); navigate({ to: "/book", search: { type: pendingType! } }); }}>
              موافق وأكمل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
