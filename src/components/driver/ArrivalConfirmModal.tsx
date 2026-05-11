import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  kind: "pickup" | "destination";
  address: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function ArrivalConfirmModal({ open, kind, address, onConfirm, onDismiss }: Props) {
  const isPickup = kind === "pickup";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/70 flex items-end sm:items-center justify-center p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ y: 80, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 24 }}
            className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
          >
            <button
              onClick={onDismiss}
              className="absolute top-3 left-3 h-8 w-8 rounded-full bg-gray-100 grid place-items-center"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className={`h-20 w-20 mx-auto rounded-full grid place-items-center mb-4 ${
                  isPickup ? "bg-emerald-100" : "bg-blue-100"
                }`}
              >
                {isPickup ? (
                  <MapPin className="h-10 w-10 text-emerald-600" />
                ) : (
                  <Flag className="h-10 w-10 text-blue-600" />
                )}
              </motion.div>

              <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                {isPickup ? "وصلت إلى نقطة الالتقاط" : "وصلت إلى الوجهة"}
              </p>
              <h2 className="text-xl font-black mb-2">
                {isPickup ? "هل ركب الراكب؟" : "هل وصل الراكب بأمان؟"}
              </h2>
              <p className="text-sm text-gray-600 mb-6 line-clamp-2">{address}</p>

              <div className="space-y-2">
                <Button
                  onClick={onConfirm}
                  className={`w-full h-14 text-base font-black rounded-2xl text-white ${
                    isPickup
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isPickup ? "نعم، ابدأ الرحلة" : "نعم، أنهِ الرحلة"}
                </Button>
                <Button
                  onClick={onDismiss}
                  variant="outline"
                  className="w-full h-12 rounded-2xl"
                >
                  لسه، أغلق التنبيه
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
