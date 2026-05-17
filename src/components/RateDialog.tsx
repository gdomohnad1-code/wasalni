import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "rider" | "driver";

export function RateDialog({
  open,
  onClose,
  rideId,
  role,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  rideId: string;
  role: Role;
  onDone?: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const title = role === "rider" ? "قيّم السائق" : "قيّم العميل";
  const subtitle =
    role === "rider"
      ? "كيف كانت تجربتك مع السائق؟"
      : "كيف كانت تجربتك مع العميل؟";

  const submit = async () => {
    setLoading(true);
    const patch =
      role === "rider"
        ? { rating: stars, rating_comment: comment || null }
        : { driver_rating: stars, driver_rating_comment: comment || null };
    const { error } = await supabase.from("rides").update(patch).eq("id", rideId);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("شكراً على تقييمك");
    onDone?.();
    onClose();
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-foreground/40 flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full max-w-md rounded-3xl p-6 shadow-card"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="p-1 -m-1 text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>

          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setStars(n)} type="button">
                <Star
                  className={`h-10 w-10 transition ${
                    n <= stars ? "fill-warning text-warning" : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="تعليق (اختياري)"
            className="mb-4"
            maxLength={300}
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              تخطي
            </Button>
            <Button
              onClick={submit}
              disabled={loading}
              className="flex-1 bg-gradient-primary font-bold"
            >
              {loading ? "..." : "تم"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
