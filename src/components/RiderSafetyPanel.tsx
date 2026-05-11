import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, MapPin, Share2, AlertTriangle, Phone, Navigation, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  rideId: string;
  driverId: string | null;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
};

export function RiderSafetyPanel({ rideId, driverId, pickup, destination }: Props) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);

  // Track driver live location
  useEffect(() => {
    if (!driverId) return;
    const load = async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("lat,lng")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (data) setDriverPos({ lat: Number(data.lat), lng: Number(data.lng) });
    };
    load();
    const ch = supabase
      .channel(`safety-driver-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (p: any) => setDriverPos({ lat: Number(p.new.lat), lng: Number(p.new.lng) })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driverId]);

  // Track rider's own location
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const liveUrl = () => {
    const p = myPos || pickup;
    return `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  };

  const driverUrl = () => {
    const p = driverPos;
    if (!p) return null;
    return `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  };

  const wazeUrl = () => {
    const p = myPos || pickup;
    return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
  };

  const buildShareText = () => {
    const lines = [
      "🚖 أنا في رحلة عبر تطبيق وصلني — أشاركك موقعي للأمان",
      `📍 موقعي الحالي: ${liveUrl()}`,
    ];
    const d = driverUrl();
    if (d) lines.push(`🚗 موقع السائق: ${d}`);
    lines.push(`🏁 الوجهة: https://www.google.com/maps?q=${destination.lat},${destination.lng}`);
    lines.push(`🆔 رقم الرحلة: ${rideId.slice(0, 8)}`);
    return lines.join("\n");
  };

  const shareLocation = async () => {
    const text = buildShareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "موقعي أثناء الرحلة", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("تم نسخ الموقع — الصقه في أي تطبيق");
      }
    } catch {
      /* user cancelled */
    }
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(buildShareText());
    toast.success("تم النسخ");
  };

  const openMaps = () => window.open(liveUrl(), "_blank");
  const openWaze = () => window.open(wazeUrl(), "_blank");

  const sendSOS = async () => {
    try {
      // Reuse the driver SOS table for ride-level emergencies; admin sees alert immediately
      await supabase.rpc("trigger_driver_sos" as any, {
        p_message: "🚨 بلاغ طوارئ من راكب أثناء الرحلة",
        p_lat: myPos?.lat ?? null,
        p_lng: myPos?.lng ?? null,
      });
    } catch { /* ignore */ }
    toast.success("تم إرسال إشارة الطوارئ — جاري التواصل");
    window.open("tel:122", "_self");
  };

  const submitReport = async () => {
    if (!reportText.trim()) {
      toast.error("اكتب تفاصيل البلاغ");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("complaints").insert({
      user_id: u.user.id,
      ride_id: rideId,
      category: "safety",
      subject: "بلاغ أثناء الرحلة",
      message: reportText,
      priority: "high",
    });
    toast.success("تم إرسال البلاغ — الإدارة ستتواصل معك");
    setReportText("");
    setReportOpen(false);
    setOpen(false);
  };

  return (
    <>
      {/* Floating safety button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 end-4 z-40 h-14 w-14 rounded-full bg-destructive text-destructive-foreground shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="الأمان"
      >
        <Shield className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 z-[9998] flex items-end"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28 }}
              className="bg-card w-full max-w-md mx-auto rounded-t-3xl p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  <h3 className="font-bold text-lg">مركز الأمان</h3>
                </div>
                <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
              </div>

              <p className="text-xs text-muted-foreground">
                شارك موقعك مع عائلتك أو أصدقائك أثناء الرحلة، أو أبلغ عن أي مشكلة فوراً.
              </p>

              <Button
                onClick={shareLocation}
                className="w-full h-14 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-base justify-start"
              >
                <Share2 className="h-5 w-5 ms-3" />
                <div className="flex-1 text-start">
                  <div>مشاركة موقعي مباشرة</div>
                  <div className="text-[11px] opacity-80 font-normal">واتساب / تيليجرام / أي تطبيق</div>
                </div>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={openMaps} className="h-12">
                  <MapPin className="h-4 w-4 ms-1" /> Google Maps
                </Button>
                <Button variant="outline" onClick={openWaze} className="h-12">
                  <Navigation className="h-4 w-4 ms-1" /> Waze
                </Button>
              </div>

              <Button variant="outline" onClick={copyText} className="w-full h-11">
                <Copy className="h-4 w-4 ms-2" /> نسخ الموقع كنص
              </Button>

              <div className="border-t pt-3 space-y-2">
                <Button
                  onClick={() => setReportOpen(true)}
                  variant="outline"
                  className="w-full h-12 border-warning text-warning hover:bg-warning/10"
                >
                  <AlertTriangle className="h-5 w-5 ms-2" /> الإبلاغ عن مشكلة
                </Button>

                <Button
                  onClick={sendSOS}
                  className="w-full h-14 bg-destructive hover:bg-destructive/90 font-black text-base"
                >
                  <Phone className="h-5 w-5 ms-2" /> 🚨 طوارئ — اتصل 122
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report dialog */}
      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/60 z-[9999] flex items-center justify-center p-4"
            onClick={() => setReportOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl p-5 w-full max-w-sm space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" /> الإبلاغ عن مشكلة
              </h3>
              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="اشرح المشكلة بالتفصيل..."
                rows={5}
                maxLength={1000}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setReportOpen(false)}>إلغاء</Button>
                <Button className="flex-1 bg-gradient-primary" onClick={submitReport}>إرسال البلاغ</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
