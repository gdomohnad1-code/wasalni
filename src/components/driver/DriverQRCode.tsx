import { QRCodeSVG } from "qrcode.react";
import { X, ScanLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  driverId: string;
  driverName?: string;
  carLabel?: string;
}

export function DriverQRCode({ open, onClose, driverId, driverName, carLabel }: Props) {
  const payload = JSON.stringify({ t: "wasalny_hail", v: 1, d: driverId });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 left-3 h-9 w-9 rounded-full bg-gray-100 grid place-items-center"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-4 mt-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-bold mb-2">
                <ScanLine className="h-3.5 w-3.5" /> استلام مباشر — Street Hail
              </div>
              <h2 className="text-xl font-black">اعرض هذا الكود للراكب</h2>
              <p className="text-xs text-gray-500 mt-1">
                الراكب يمسحه من تطبيق وصلني وتبدأ الرحلة فوراً
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-primary/30 grid place-items-center">
              <QRCodeSVG
                value={payload}
                size={240}
                level="M"
                includeMargin={false}
                fgColor="#0b1220"
              />
            </div>

            <div className="mt-4 text-center">
              {driverName && <div className="font-black text-sm">{driverName}</div>}
              {carLabel && <div className="text-xs text-gray-500">{carLabel}</div>}
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
              ⚠️ لا تسلّم هذا الكود لأي شخص آخر — أي راكب يمسحه تبدأ رحلة فوراً باسمك.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
