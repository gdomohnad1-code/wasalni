import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Share, Plus, Smartphone, Download } from "lucide-react";

/**
 * Glassmorphic "Add to Home Screen" banner.
 * - Listens for beforeinstallprompt (Android/Chrome/Edge)
 * - Falls back to iOS Safari instructions modal
 * - Hides for 7 days after install/dismiss (localStorage)
 */

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "wsl_a2hs_dismissed_until";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadOS =
    navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(STORAGE_KEY) || "0");
    return until > Date.now();
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + SEVEN_DAYS));
  } catch {
    /* ignore */
  }
}

export function PWAInstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || isDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      markDismissed();
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Show iOS banner after a short delay (no beforeinstallprompt on iOS)
    if (isIOS()) {
      const t = window.setTimeout(() => setVisible(true), 2500);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (isIOS() && !deferred) {
      setShowIOS(true);
      return;
    }
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        markDismissed();
      }
    } catch {
      /* ignore */
    } finally {
      setDeferred(null);
    }
  };

  const dismiss = () => {
    markDismissed();
    setVisible(false);
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            dir="rtl"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-4 z-[60] mx-auto max-w-md px-4"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
          >
            <div
              className="relative flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 shadow-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(10,25,47,0.92) 0%, rgba(17,34,64,0.92) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                color: "#E6EEF7",
                fontFamily: "'Cairo', system-ui, sans-serif",
              }}
            >
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  boxShadow: "0 8px 24px rgba(16,185,129,0.35)",
                }}
              >
                <Smartphone className="h-5 w-5 text-white" />
              </div>

              <div className="min-w-0 flex-1 text-right">
                <div className="text-[13px] font-bold leading-tight">
                  تجربة أسرع وأفضل! 📲
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-white/70">
                  ثبّت تطبيق وصلني على شاشتك الرئيسية الآن
                </div>
              </div>

              <button
                onClick={install}
                className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold text-white transition-transform active:scale-95"
                style={{
                  background:
                    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  boxShadow: "0 6px 18px rgba(16,185,129,0.4)",
                }}
              >
                تثبيت ⬇️
              </button>

              <button
                onClick={dismiss}
                aria-label="إغلاق"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS instructions modal */}
      <AnimatePresence>
        {showIOS && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowIOS(false)}
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <motion.div
              dir="rtl"
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 p-6"
              style={{
                background:
                  "linear-gradient(160deg, rgba(10,25,47,0.98) 0%, rgba(17,34,64,0.98) 100%)",
                color: "#E6EEF7",
                fontFamily: "'Cairo', system-ui, sans-serif",
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    }}
                  >
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-black">ثبّت وصلني على iPhone</div>
                    <div className="text-xs text-white/60">خطوتان بسيطتان</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOS(false)}
                  aria-label="إغلاق"
                  className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="space-y-3">
                <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-lg font-black">
                    1
                  </div>
                  <div className="flex-1 text-right text-[13px] leading-relaxed">
                    اضغط على زر المشاركة{" "}
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-bold">
                      <Share className="h-3.5 w-3.5" /> Share
                    </span>{" "}
                    في شريط متصفح Safari بالأسفل.
                  </div>
                </li>
                <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-lg font-black">
                    2
                  </div>
                  <div className="flex-1 text-right text-[13px] leading-relaxed">
                    اختر{" "}
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-bold">
                      <Plus className="h-3.5 w-3.5" /> إضافة إلى الشاشة الرئيسية
                    </span>{" "}
                    من القائمة.
                  </div>
                </li>
              </ol>

              <button
                onClick={() => {
                  markDismissed();
                  setShowIOS(false);
                  setVisible(false);
                }}
                className="mt-5 w-full rounded-2xl py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
                }}
              >
                فهمت — شكراً
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
