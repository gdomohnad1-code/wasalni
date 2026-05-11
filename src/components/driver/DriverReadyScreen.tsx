import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DriverReadyScreen({ onStart, name }: { onStart: () => void; name?: string }) {
  return (
    <div className="fixed inset-0 z-[9000] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center p-6 overflow-hidden" dir="rtl">
      {/* sparkles */}
      {[...Array(14)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-white/40"
          initial={{
            x: `${Math.random() * 100}vw`,
            y: `${Math.random() * 100}vh`,
            opacity: 0,
            scale: 0,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.3, 0],
            rotate: [0, 180],
          }}
          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
        >
          <Sparkles className="h-6 w-6" />
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 15 }}
        className="relative bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0, rotate: -120 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="h-24 w-24 mx-auto mb-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-lg shadow-emerald-200"
        >
          <CheckCircle2 className="h-14 w-14 text-white" strokeWidth={2.5} />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-3xl font-black text-gray-900"
        >
          مبروك{name ? ` يا ${name}` : ""}! 🎉
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }}
          className="text-lg font-bold text-emerald-600 mt-2"
        >
          تمت الموافقة على حسابك
        </motion.p>
        <motion.p
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
          className="text-sm text-gray-500 mt-3 leading-relaxed"
        >
          أنت الآن جزء من فريق وصلني — جاهز تستقبل أول رحلة وتبدأ تكسب من اليوم.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.85 }}
          className="mt-6"
        >
          <Button
            onClick={onStart}
            className="w-full h-14 text-base font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl shadow-lg shadow-emerald-200"
          >
            <Car className="h-5 w-5 ml-2" />
            جاهز أشتغل
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
