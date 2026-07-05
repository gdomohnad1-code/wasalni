import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ALERT_META, type RoadAlertType } from "@/hooks/use-road-alerts";

interface Props {
  position: { lat: number; lng: number } | null;
  // Position relative to parent (parent must be relative). Defaults to bottom-right above bottom sheet.
  className?: string;
}

const ORDER: RoadAlertType[] = ["bump", "police", "accident", "traffic", "hazard", "closure"];

export function RoadAlertReporter({ position, className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<RoadAlertType | null>(null);

  const report = async (type: RoadAlertType) => {
    if (!user) { toast.error("سجل دخولك أولاً"); return; }
    if (!position) { toast.error("جاري تحديد موقعك…"); return; }
    setSubmitting(type);
    const { error } = await supabase.from("road_alerts").insert({
      created_by: user.id,
      type,
      lat: position.lat,
      lng: position.lng,
    });
    setSubmitting(null);
    if (error) { toast.error("تعذّر إرسال التنبيه"); return; }
    toast.success("شكراً — تم إرسال التنبيه للسواقين القريبين");
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed z-[60] h-14 w-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white grid place-items-center shadow-2xl active:scale-95 transition-transform ${className ?? "bottom-56 right-4"}`}
        aria-label="بلّغ عن حالة الطريق"
      >
        <AlertTriangle className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] text-gray-500">Community Alerts</div>
                  <h3 className="text-lg font-black">بلّغ عن حالة الطريق</h3>
                </div>
                <button onClick={() => setOpen(false)} className="h-9 w-9 rounded-full bg-gray-100 grid place-items-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                التنبيه هيوصل لكل سواقين وصلني في المنطقة لمدة ساعتين. اختار نوع التنبيه:
              </p>

              <div className="grid grid-cols-3 gap-2.5">
                {ORDER.map((t) => {
                  const m = ALERT_META[t];
                  const busy = submitting === t;
                  return (
                    <button
                      key={t}
                      disabled={!!submitting}
                      onClick={() => report(t)}
                      className={`rounded-2xl p-3 border-2 flex flex-col items-center gap-1.5 transition active:scale-95 ${busy ? "bg-primary/10 border-primary" : "bg-white border-gray-200 hover:border-primary/40"}`}
                    >
                      <span className="text-3xl leading-none">{m.emoji}</span>
                      <span className="text-[11px] font-bold text-center leading-tight">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {!position && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800">
                  جاري تحديد موقعك — فعّل تحديد الموقع من إعدادات المتصفح.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
