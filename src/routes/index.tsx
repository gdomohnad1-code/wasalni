import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { destinationForUser } from "@/lib/route-after-login";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: SplashPage,
});

function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return navigate({ to: "/auth" });
      const to = await destinationForUser(data.session.user.id);
      navigate({ to });
    }, 1400);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <img src={logo} alt="وصلني" className="h-28 w-28 rounded-3xl object-contain" />
        <p className="text-base text-muted-foreground">رحلتك تبدأ بنقرة</p>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ duration: 1.2 }}
          className="mt-4 h-0.5 rounded-full bg-foreground/80"
        />
      </motion.div>
    </div>
  );
}
