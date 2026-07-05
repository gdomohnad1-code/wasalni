import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PinVerifyModal({
  open,
  onClose,
  expected,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  expected: string;
  onVerified: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setError(null);
      setAttempts(0);
      setTimeout(() => refs[0].current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError(null);
    if (clean && i < 3) refs[i + 1].current?.focus();
    if (next.every((d) => d !== "")) verify(next.join(""));
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!txt) return;
    const next = ["", "", "", ""];
    for (let i = 0; i < txt.length; i++) next[i] = txt[i];
    setDigits(next);
    if (txt.length === 4) verify(txt);
    else refs[txt.length]?.current?.focus();
  };

  const verify = (code: string) => {
    if (code === expected) {
      onVerified();
    } else {
      setError("الرقم غلط — اطلب الكود من الراكب تاني");
      setAttempts((a) => a + 1);
      setDigits(["", "", "", ""]);
      setTimeout(() => refs[0].current?.focus(), 50);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="pin-back"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="pin-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-[60] bg-background rounded-t-3xl p-5 pb-8 shadow-2xl max-w-md mx-auto space-y-4"
          >
            <div className="h-1.5 w-12 bg-muted rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 grid place-items-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">🔐 تأكيد الراكب</h3>
                  <p className="text-[11.5px] text-muted-foreground leading-tight">
                    اطلب من الراكب رقم الـ 4 خانات المعروض على شاشته
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div dir="ltr" className="flex justify-center gap-2.5 py-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={refs[i]}
                  value={d}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={onPaste}
                  inputMode="numeric"
                  maxLength={1}
                  className={`h-16 w-14 rounded-2xl border-2 text-center text-3xl font-black tracking-widest bg-muted/40 focus:outline-none transition
                    ${error ? "border-destructive text-destructive" : d ? "border-primary" : "border-border"}`}
                />
              ))}
            </div>

            {error && (
              <p className="text-[12px] text-destructive text-center font-semibold">
                {error} {attempts >= 3 ? "— اتأكد إنه الراكب اللي طلب الرحلة" : ""}
              </p>
            )}

            <Button
              variant="outline"
              onClick={onClose}
              className="w-full h-11 rounded-2xl font-bold"
            >
              إلغاء
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
