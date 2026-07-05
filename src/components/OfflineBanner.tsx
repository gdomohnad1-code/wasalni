import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Fixed top banner that appears when the browser goes offline
 * or the Supabase realtime channel is disconnected.
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed top-0 inset-x-0 z-[10001] pointer-events-none flex justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="mt-2 pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500/95 text-white text-xs font-bold px-4 py-2 shadow-lg backdrop-blur">
            <WifiOff className="h-4 w-4" />
            <span>{t("offline.reconnecting")}</span>
            <Loader2 className="h-4 w-4 animate-spin opacity-80" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
