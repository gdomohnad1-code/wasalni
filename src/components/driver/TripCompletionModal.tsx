import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  totalFare: number;
  riderName: string;
  onClose: () => void;
  onCompleteTrip: (receivedAmount: number, changeToWallet: number) => Promise<void> | void;
}

export function TripCompletionModal({ open, totalFare, riderName, onClose, onCompleteTrip }: Props) {
  const [receivedCash, setReceivedCash] = useState<string>(String(Math.max(0, Math.round(totalFare))));
  const [busy, setBusy] = useState<"cash" | "wallet" | null>(null);

  const receivedNum = parseFloat(receivedCash) || 0;
  const changeAmount = Math.max(0, +(receivedNum - totalFare).toFixed(2));

  const handleFinish = async (saveToWallet: boolean) => {
    if (receivedNum < totalFare) return;
    setBusy(saveToWallet ? "wallet" : "cash");
    try {
      await onCompleteTrip(receivedNum, saveToWallet ? changeAmount : 0);
    } finally {
      setBusy(null);
    }
  };

  const short = [5, 10, 20, 50, 100];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          dir="rtl"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl border-t border-gray-100"
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

            <button
              onClick={onClose}
              disabled={!!busy}
              className="absolute top-4 left-4 h-9 w-9 rounded-full bg-gray-100 grid place-items-center disabled:opacity-40"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-xl font-black text-[#0A192F] text-center mb-1">
              تحصيل أجرة الرحلة
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              العميل: {riderName}
            </p>

            {/* Total fare */}
            <div className="bg-[#0A192F]/5 rounded-2xl p-4 text-center mb-5">
              <span className="text-xs text-gray-600 block mb-1">الأجرة المقررة</span>
              <span className="text-4xl font-black text-[#0A192F]">
                {totalFare.toFixed(0)} <span className="text-base font-normal">ج.م</span>
              </span>
            </div>

            {/* Cash received input */}
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                المبلغ المستلم من العميل (كاش):
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={receivedCash}
                onChange={(e) => setReceivedCash(e.target.value)}
                className="w-full text-center text-2xl font-black py-3 px-4 border-2 border-gray-200 rounded-xl focus:border-[#0A192F] focus:outline-none transition-all"
                placeholder="أدخل المبلغ..."
              />
            </div>

            {/* Quick add */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {short.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setReceivedCash(String((parseFloat(receivedCash) || 0) + v))
                  }
                  className="flex-1 min-w-[60px] py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-black text-gray-700"
                >
                  +{v}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReceivedCash(String(Math.round(totalFare)))}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-black text-gray-700"
              >
                إعادة
              </button>
            </div>

            {/* Change magic solution */}
            {changeAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="text-[11px] text-amber-800 font-black block">
                    مفيش فكة؟ الحل عندنا 💡
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    باقي الفكة:{" "}
                    <span className="text-amber-600 font-black">{changeAmount} ج.م</span>
                  </span>
                </div>
                <button
                  onClick={() => handleFinish(true)}
                  disabled={!!busy}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-black py-2.5 px-3 rounded-lg shadow-sm transition-all whitespace-nowrap flex items-center gap-1.5"
                >
                  {busy === "wallet" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>إيداع بمحفظة العميل ⚡</>
                  )}
                </button>
              </motion.div>
            )}

            {receivedNum > 0 && receivedNum < totalFare && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-4 text-xs text-red-700 text-center font-bold">
                المبلغ المستلم أقل من الأجرة بـ {(totalFare - receivedNum).toFixed(0)} ج.م
              </div>
            )}

            <button
              onClick={() => handleFinish(false)}
              disabled={!!busy || receivedNum < totalFare}
              className="w-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-black text-base py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {busy === "cash" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>إنهاء الرحلة وتحصيل الكاش</span>
                  <span>✔️</span>
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
