import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, FileText, Shield, Star, Trash2, User as UserIcon, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, refresh, signOut } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [notif, setNotif] = useState(typeof window !== "undefined" ? localStorage.getItem("notif_enabled") !== "0" : true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatar(profile.avatar_url || null);
    }
  }, [profile]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error("فشل رفع الصورة");
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(data.publicUrl);
    toast.success("تم رفع الصورة");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: name, phone, avatar_url: avatar,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("فشل الحفظ");
    toast.success("تم حفظ البيانات");
    refresh();
  };

  const toggleNotif = (v: boolean) => {
    setNotif(v);
    localStorage.setItem("notif_enabled", v ? "1" : "0");
    toast.success(v ? "تم تفعيل الإشعارات" : "تم إيقاف الإشعارات");
  };

  const deleteAccount = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ full_name: "حساب محذوف", phone: null, avatar_url: null }).eq("id", user.id);
    await supabase.auth.signOut();
    toast.success("تم حذف الحساب");
    nav({ to: "/auth" });
  };

  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Link to="/profile" className="p-2 -m-2"><ArrowRight className="h-5 w-5" /></Link>
        <h1 className="font-bold text-lg">الإعدادات</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* تعديل البيانات */}
        <section className="bg-card rounded-2xl p-4 shadow-card">
          <h2 className="font-bold mb-3 flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary" /> تعديل البيانات</h2>

          <div className="flex flex-col items-center mb-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-muted overflow-hidden">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-2xl">👤</div>}
              </div>
              <label className="absolute bottom-0 left-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer">
                <Camera className="h-3 w-3" />
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">رقم الهاتف</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input value={user?.email || ""} disabled dir="ltr" />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full mt-3 bg-gradient-primary">حفظ التغييرات</Button>
        </section>

        {/* الإشعارات */}
        <section className="bg-card rounded-2xl p-4 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-sm">الإشعارات</div>
              <div className="text-xs text-muted-foreground">استقبال إشعارات الرحلات والعروض</div>
            </div>
          </div>
          <Switch checked={notif} onCheckedChange={toggleNotif} />
        </section>

        {/* روابط */}
        <section className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">
          <RowLink onClick={() => window.open("https://play.google.com/store", "_blank")} icon={Star} label="تقييم التطبيق" />
          <RowLink to="/terms" icon={FileText} label="شروط الاستخدام" />
          <RowLink to="/privacy" icon={Shield} label="سياسة الخصوصية" />
        </section>

        {/* حذف + خروج */}
        <section className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 p-4 text-destructive hover:bg-destructive/5 transition">
                <Trash2 className="h-5 w-5" />
                <span className="font-semibold text-sm">حذف الحساب</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد من حذف حسابك؟</AlertDialogTitle>
                <AlertDialogDescription>سيتم حذف بياناتك بشكل دائم ولا يمكن التراجع.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground">احذف نهائياً</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>

        <Button onClick={signOut} variant="outline" className="w-full">تسجيل الخروج</Button>
      </div>
    </div>
  );
}

function RowLink({ icon: Icon, label, to, onClick }: { icon: any; label: string; to?: string; onClick?: () => void }) {
  const inner = (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/40 transition cursor-pointer">
      <Icon className="h-5 w-5 text-primary" />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-180" />
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return <button className="w-full text-right" onClick={onClick}>{inner}</button>;
}
