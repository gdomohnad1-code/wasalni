import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/network";

/**
 * Subtle, non-intrusive top banner shown when the browser reports it is offline.
 * Does NOT redirect or unmount routes — trip state remains intact underneath.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-[100] pointer-events-none flex justify-center px-3 pt-2"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground/90 text-background text-xs px-3 py-1.5 shadow-lg backdrop-blur">
            <WifiOff className="h-3.5 w-3.5 animate-pulse" />
            <span>جارٍ إعادة الاتصال بوصلني…</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
