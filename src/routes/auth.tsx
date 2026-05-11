import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { destinationForUser } from "@/lib/route-after-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Phone, Lock, User as UserIcon } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [influencerCode, setInfluencerCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const to = await destinationForUser(data.session.user.id);
        navigate({ to });
      }
    });
  }, [navigate]);

  const handleAvatar = (f: File | null) => {
    setAvatarFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!avatarFile) {
          toast.error("الصورة الشخصية مطلوبة");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        if (data.user) {
          // upload avatar
          const path = `${data.user.id}/avatar.png`;
          const up = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
          if (!up.error) {
            const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
            await supabase.from("profiles").update({ avatar_url: pub.publicUrl, full_name: fullName, phone }).eq("id", data.user.id);
          }
          if (influencerCode.trim()) {
            const { data: r } = await (supabase.rpc as any)("apply_influencer_code", { p_code: influencerCode.trim() });
            if ((r as any)?.ok) toast.success("تم تفعيل كود المؤثر ✨");
            else if ((r as any)?.error === "invalid_code") toast.error("كود المؤثر غير صالح");
          }
          toast.success("تم إنشاء حسابك بنجاح! 🎉");
          const to = await destinationForUser(data.user.id);
          navigate({ to });
        }
      } else {
        const { data: signin, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("أهلاً بعودتك!");
        const to = signin.user ? await destinationForUser(signin.user.id) : "/home";
        navigate({ to });
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/complete-profile`,
      });
      if (result.error) {
        toast.error("فشل تسجيل الدخول عبر Google");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data: s } = await supabase.auth.getSession();
      if (s.session) navigate({ to: "/complete-profile" });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <img src={logo} alt="وصلني" className="h-20 w-20 mx-auto mb-3 rounded-2xl object-contain" />
          <p className="text-muted-foreground text-sm">رحلتك تبدأ بنقرة</p>
        </div>

        <div className="bg-card rounded-3xl shadow-elevated p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-5">
              <TabsTrigger value="login">دخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <label className="cursor-pointer">
                      <div className="h-24 w-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)} />
                    </label>
                    <span className="text-xs text-muted-foreground">صورة شخصية (إجبارية)</span>
                  </div>

                  <div>
                    <Label>الاسم الكامل</Label>
                    <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="محمد أحمد" />
                  </div>
                  <div>
                    <Label>رقم التليفون</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" className="pr-10" />
                    </div>
                  </div>
                  <div>
                    <Label>كود المؤثر (اختياري)</Label>
                    <Input value={influencerCode} onChange={(e) => setInfluencerCode(e.target.value.toUpperCase())} placeholder="مثال: SARA10" />
                  </div>
                </>
              )}

              <div>
                <Label>البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="pr-10" />
                </div>
              </div>
              <div>
                <Label>كلمة السر</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base font-bold bg-gradient-primary shadow-soft" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "login" ? "دخول" : "إنشاء حساب"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">أو الدخول بـ</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13.1-5l-6.1-5c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39 16.2 43.5 24 43.5z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.1 5c-.4.4 6.6-4.8 6.6-14.5 0-1.2-.1-2.3-.4-3.5z"/>
              </svg>
              <span>الدخول عبر Google</span>
            </Button>
          </Tabs>
        </div>

        <p className="text-center text-xs text-primary-foreground/80 mt-4">
          بالتسجيل أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </motion.div>
    </div>
  );
}
