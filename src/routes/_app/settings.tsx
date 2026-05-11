import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, FileText, Shield, Star, Trash2, User as UserIcon, Camera, KeyRound, Loader2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, refresh, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
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
    if (error) return toast.error("Upload failed");
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(data.publicUrl);
    toast.success("Uploaded");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: name, phone, avatar_url: avatar,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("Save failed");
    toast.success("Saved");
    refresh();
  };

  const toggleNotif = (v: boolean) => {
    setNotif(v);
    localStorage.setItem("notif_enabled", v ? "1" : "0");
    toast.success(v ? "On" : "Off");
  };

  const deleteAccount = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ full_name: "deleted", phone: null, avatar_url: null }).eq("id", user.id);
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };

  const changeLang = (l: Lang) => {
    setLang(l);
    toast.success(t("settings.language_changed"));
  };

  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Link to="/profile" className="p-2 -m-2"><ArrowRight className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" /></Link>
        <h1 className="font-bold text-lg">{t("settings.title")}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Language */}
        <section className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Languages className="h-4 w-4 text-primary" /> {t("settings.language")}</h2>
          <p className="text-xs text-muted-foreground mb-3">{t("settings.language_sub")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => changeLang("ar")}
              className={`rounded-lg border p-3 text-sm font-bold transition ${lang === "ar" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
            >
              {t("settings.language_ar")}
            </button>
            <button
              onClick={() => changeLang("en")}
              className={`rounded-lg border p-3 text-sm font-bold transition ${lang === "en" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
            >
              {t("settings.language_en")}
            </button>
          </div>
        </section>

        {/* Edit profile */}
        <section className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="font-bold mb-3 flex items-center gap-2"><UserIcon className="h-4 w-4 text-primary" /> {t("settings.edit_profile")}</h2>

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
              <Label className="text-xs">{t("settings.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("settings.phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">{t("settings.email")}</Label>
              <Input value={user?.email || ""} disabled dir="ltr" />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full mt-3">{t("settings.save")}</Button>
        </section>

        {/* Change password */}
        <ChangePasswordSection />

        {/* Notifications */}
        <section className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-sm">{t("settings.notifications")}</div>
              <div className="text-xs text-muted-foreground">{t("settings.notifications_sub")}</div>
            </div>
          </div>
          <Switch checked={notif} onCheckedChange={toggleNotif} />
        </section>

        {/* Links */}
        <section className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          <RowLink onClick={() => window.open("https://play.google.com/store", "_blank")} icon={Star} label={t("settings.rate_app")} />
          <RowLink to="/terms" icon={FileText} label={t("settings.terms")} />
          <RowLink to="/privacy" icon={Shield} label={t("settings.privacy")} />
        </section>

        {/* Delete + signout */}
        <section className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 p-4 text-destructive hover:bg-destructive/5 transition">
                <Trash2 className="h-5 w-5" />
                <span className="font-semibold text-sm">{t("settings.delete_account")}</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.delete_confirm")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.delete_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("settings.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground">{t("settings.delete_final")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>

        <Button onClick={signOut} variant="outline" className="w-full">{t("settings.signout")}</Button>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 6) { toast.error(t("settings.password_hint")); return; }
    if (pw !== pw2) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("✅");
    setPw(""); setPw2("");
  };

  return (
    <section className="bg-card rounded-2xl p-4 border border-border">
      <h2 className="font-bold mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" /> {t("settings.password")}
      </h2>
      <div className="space-y-2">
        <div>
          <Label className="text-xs">{t("settings.new_password")}</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("settings.password_hint")} dir="ltr" />
        </div>
        <div>
          <Label className="text-xs">{t("settings.confirm_password")}</Label>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={t("settings.password_confirm_hint")} dir="ltr" />
        </div>
      </div>
      <Button onClick={submit} disabled={busy} className="w-full mt-3">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settings.update_password")}
      </Button>
    </section>
  );
}

function RowLink({ icon: Icon, label, to, onClick }: { icon: any; label: string; to?: string; onClick?: () => void }) {
  const inner = (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/40 transition cursor-pointer">
      <Icon className="h-5 w-5 text-primary" />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return <button className="w-full text-start" onClick={onClick}>{inner}</button>;
}
