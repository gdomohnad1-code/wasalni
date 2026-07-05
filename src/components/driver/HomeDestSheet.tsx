import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Loader2, X, Navigation } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { geocodeAddress } from "@/lib/geocode";
import { toast } from "sonner";

type LL = { lat: number; lng: number };

export function HomeDestSheet({
  open,
  onClose,
  onSave,
  currentAddress,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: { address: string; coords: LL }) => Promise<void> | void;
  currentAddress?: string | null;
}) {
  const [addr, setAddr] = useState(currentAddress ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!addr.trim()) {
      toast.error("اكتب عنوان بيتك");
      return;
    }
    setBusy(true);
    try {
      const coords = await geocodeAddress(addr.trim());
      if (!coords) {
        toast.error("مقدرش نلاقي العنوان — جرب اسم أوضح");
        return;
      }
      await onSave({ address: addr.trim(), coords });
      toast.success("تم تفعيل وضع مروّح لبيتي ✅");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="hd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key="hd-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-background rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl max-w-md mx-auto"
          >
            <div className="h-1.5 w-12 bg-muted rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">وجهة مروّح</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    هنبعتلك الطلبات اللي في اتجاه بيتك بس
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-muted/60 border border-border p-3 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary shrink-0" />
              <Input
                autoFocus
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                placeholder="مثال: زايد، الشيخ زايد، الجيزة"
                className="h-11 bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none text-sm font-bold"
              />
            </div>

            <ul className="text-[11.5px] text-muted-foreground space-y-1 list-disc ps-4">
              <li>هيتم فلترة الطلبات: الوجهات القريبة من بيتك بس</li>
              <li>ينفع تلغي الوضع في أي وقت من نفس الزرار</li>
              <li>لو مفيش طلبات في اتجاهك، ممكن تقفل الوضع مؤقتاً</li>
            </ul>

            <Button
              onClick={save}
              disabled={busy}
              className="w-full h-12 rounded-2xl bg-gradient-primary font-black text-base"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "تفعيل الوضع"}
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
