import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: SplashPage,
});

function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      navigate({ to: data.session ? "/home" : "/auth" });
    }, 1400);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-primary-foreground">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white/15 backdrop-blur-md shadow-elevated">
          <span className="text-6xl">🚕</span>
        </div>
        <h1 className="text-5xl font-black tracking-tight">وصلني</h1>
        <p className="text-lg opacity-90">رحلتك تبدأ بنقرة</p>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ duration: 1.2 }}
          className="mt-6 h-1 rounded-full bg-white/60"
        />
      </motion.div>
    </div>
  );
}
