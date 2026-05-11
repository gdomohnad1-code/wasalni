import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { destinationForUser } from "@/lib/route-after-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/complete-profile")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: CompleteProfile,
});

function CompleteProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        navigate({ to: "/auth" });
        return;
      }
      const uid = s.session.user.id;
      setUserId(uid);
      const { data: p } = await supabase
        .from("profiles")
        .select("phone, full_name")
        .eq("id", uid)
        .maybeSingle();
      if (p?.phone && p.phone.trim().length > 0) {
        const to = await destinationForUser(uid);
        navigate({ to });
        return;
      }
      setFullName(p?.full_name || s.session.user.user_metadata?.full_name || "");
      setChecking(false);
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.replace(/\s/g, "");
    if (!/^[+0-9]{8,15}$/.test(cleaned)) {
      toast.error("رقم الهاتف غير صحيح");
      return;
    }
    if (!fullName.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: cleaned, full_name: fullName.trim() })
        .eq("id", userId);
      if (error) throw error;
      toast.success("تم حفظ بياناتك ✨");
      const to = await destinationForUser(userId);
      navigate({ to });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-card rounded-3xl shadow-elevated p-6"
      >
        <h1 className="text-xl font-bold mb-1">أكمل بياناتك</h1>
        <p className="text-sm text-muted-foreground mb-5">
          نحتاج رقم هاتفك لإكمال التسجيل واستخدام التطبيق
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>الاسم الكامل</Label>
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="محمد أحمد"
                className="pr-10"
              />
            </div>
          </div>
          <div>
            <Label>رقم التليفون *</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                required
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="pr-10"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full h-12 text-base font-bold bg-gradient-primary shadow-soft"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "حفظ ومتابعة"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
