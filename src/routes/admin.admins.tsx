import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createAdminAccount, resetAdminPassword } from "@/lib/admin-create.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Shield, UserPlus, Mail, Crown, Eye, Bell, Wallet, UserCog, KeyRound, Loader2, Copy, Lock } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/admins")({
  component: AdminsPage,
});

type AdminPerm =
  | "super_admin"
  | "assigner"
  | "full_control"
  | "viewer"
  | "notifications"
  | "collections";

const PERM_META: Record<AdminPerm, { label: string; desc: string; icon: any; color: string }> = {
  super_admin:    { label: "مسؤول رئيسي",  desc: "كل الصلاحيات + إدارة المسؤولين",     icon: Crown,    color: "text-amber-500" },
  full_control:   { label: "تحكم كامل",    desc: "كل شيء عدا تعيين/إزالة المسؤولين",  icon: KeyRound, color: "text-primary" },
  assigner:       { label: "مسؤول تعيين",  desc: "الموافقة على السائقين والوثائق",     icon: UserCog,  color: "text-blue-500" },
  collections:    { label: "مسؤول التحصيل", desc: "إدارة المستحقات والمدفوعات",          icon: Wallet,   color: "text-emerald-500" },
  notifications:  { label: "إشعارات",      desc: "إرسال الإشعارات والإعلانات",          icon: Bell,     color: "text-fuchsia-500" },
  viewer:         { label: "معاينة فقط",   desc: "قراءة لوحات البيانات بدون تعديل",     icon: Eye,      color: "text-muted-foreground" },
};

const ALL_PERMS: AdminPerm[] = ["super_admin", "full_control", "assigner", "collections", "notifications", "viewer"];
const ALL_PERMS_FOR_CREATE: AdminPerm[] = ["super_admin", "full_control", "assigner", "collections", "notifications", "viewer"];

function DirectCreateAdmin({ onCreated }: { onCreated: () => void }) {
  const create = useServerFn(createAdminAccount);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [perm, setPerm] = useState<AdminPerm>("viewer");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ login_email: string; is_synthetic_email: boolean } | null>(null);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  };

  const submit = async () => {
    if (!identifier.trim() || !password.trim() || !name.trim()) {
      toast.error("املأ كل الحقول");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور 6 أحرف على الأقل");
      return;
    }
    setBusy(true);
    try {
      const res: any = await create({
        data: {
          identifier: identifier.trim(),
          password,
          full_name: name.trim(),
          permission: perm,
        },
      });
      setResult({ login_email: res.login_email, is_synthetic_email: res.is_synthetic_email });
      toast.success("تم إنشاء حساب المسؤول ✅");
      setIdentifier(""); setPassword(""); setName(""); setPerm("viewer");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 border-primary/30 bg-primary/5">
      <h3 className="font-bold mb-1 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" /> إنشاء حساب مسؤول مباشرة
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        أنشئ حساب أدمن فورًا بكلمة مرور — يمكن استخدام بريد إلكتروني أو اسم مستخدم عادي (هيتحول داخليًا إلى بريد).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">الاسم الكامل</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="أحمد محمد" />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">البريد أو اسم المستخدم</label>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="ahmed أو ahmed@example.com"
            dir="ltr"
            className="text-left"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">كلمة المرور</label>
          <div className="flex gap-2">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة مرور قوية"
              dir="ltr"
              className="text-left flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={generatePassword}>توليد</Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">الدور</label>
          <Select value={perm} onValueChange={(v) => setPerm(v as AdminPerm)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_PERMS_FOR_CREATE.map((p) => (
                <SelectItem key={p} value={p}>{PERM_META[p].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={submit} disabled={busy} className="mt-4 w-full md:w-auto">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 ml-1" /> إنشاء الحساب</>}
      </Button>

      {result && (
        <div className="mt-4 p-3 rounded-lg bg-card border border-primary/30 text-sm space-y-1">
          <p className="font-bold text-primary">✅ تم الإنشاء — معلومات الدخول:</p>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="text-muted-foreground">Email:</span>
            <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{result.login_email}</code>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(result.login_email); toast.success("تم النسخ"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          {result.is_synthetic_email && (
            <p className="text-[11px] text-muted-foreground">
              ℹ️ يستخدم اسم المستخدم — يجب على المسؤول الجديد الدخول بهذا البريد بالكامل.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

interface AdminEmail { id: string; email: string; created_at: string; default_permission: AdminPerm; }
interface AdminUser {
  user_id: string;
  full_name: string;
  permission: AdminPerm | null;
}

function AdminsPage() {
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPerm, setNewPerm] = useState<AdminPerm>("viewer");
  const [loading, setLoading] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setMeId(user?.id ?? null);

    const { data: e } = await supabase
      .from("admin_emails")
      .select("*")
      .order("created_at", { ascending: false });
    setEmails((e ?? []) as AdminEmail[]);

    const { data: r } = await supabase
      .from("user_roles")
      .select("user_id, profiles:user_id(full_name)")
      .eq("role", "admin");

    const ids = (r ?? []).map((x: any) => x.user_id);
    const { data: perms } = await supabase
      .from("admin_permissions")
      .select("user_id, permission")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const permMap = new Map<string, AdminPerm>();
    (perms ?? []).forEach((p: any) => permMap.set(p.user_id, p.permission));

    setAdmins(
      (r ?? []).map((x: any) => ({
        user_id: x.user_id,
        full_name: x.profiles?.full_name ?? "—",
        permission: permMap.get(x.user_id) ?? null,
      }))
    );

    if (user?.id) {
      setIsSuper(permMap.get(user.id) === "super_admin");
    }
  };

  useEffect(() => { load(); }, []);

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("بريد إلكتروني غير صالح");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_emails")
      .insert({ email, default_permission: newPerm, created_by: user?.id });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "هذا البريد مضاف مسبقًا" : "تعذّر الإضافة");
      return;
    }
    toast.success(`تمت الإضافة بدور: ${PERM_META[newPerm].label}`);
    setNewEmail("");
    setNewPerm("viewer");
    load();
  };

  const updateEmailPerm = async (id: string, perm: AdminPerm) => {
    if (!isSuper) { toast.error("المسؤول الرئيسي فقط"); return; }
    const { error } = await supabase
      .from("admin_emails")
      .update({ default_permission: perm })
      .eq("id", id);
    if (error) return toast.error("تعذّر التحديث");
    toast.success("تم تحديث الدور الافتراضي");
    load();
  };

  const removeEmail = async (id: string, email: string) => {
    if (email === "admin@wasalni.app") {
      toast.error("لا يمكن حذف البريد الرئيسي");
      return;
    }
    const { error } = await supabase.from("admin_emails").delete().eq("id", id);
    if (error) return toast.error("تعذّر الحذف");
    toast.success("تم الحذف");
    load();
  };

  const revokeAdmin = async (userId: string) => {
    if (meId === userId) { toast.error("لا يمكنك إزالة صلاحياتك الخاصة"); return; }
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) return toast.error("تعذّر الإلغاء");
    await supabase.from("admin_permissions").delete().eq("user_id", userId);
    toast.success("تم سحب صلاحية الأدمن");
    load();
  };

  const changePerm = async (userId: string, newPerm: AdminPerm) => {
    if (!isSuper) { toast.error("المسؤول الرئيسي فقط يمكنه تغيير الأدوار"); return; }
    if (meId === userId && newPerm !== "super_admin") {
      toast.error("لا يمكنك تخفيض دور حسابك الرئيسي"); return;
    }
    // Upsert by deleting then inserting (table has unique on user_id+permission)
    await supabase.from("admin_permissions").delete().eq("user_id", userId);
    const { error } = await supabase
      .from("admin_permissions")
      .insert({ user_id: userId, permission: newPerm, granted_by: meId });
    if (error) return toast.error("تعذّر تحديث الدور");
    toast.success(`تم تعيين الدور: ${PERM_META[newPerm].label}`);
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-extrabold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          إدارة المسؤولين والأدوار
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuper
            ? "بصفتك المسؤول الرئيسي، يمكنك تعيين دور لكل مسؤول."
            : "العرض فقط — المسؤول الرئيسي وحده يستطيع تعديل الأدوار."}
        </p>
      </div>

      {/* Roles legend */}
      <Card className="p-5">
        <h3 className="font-bold mb-3">الأدوار المتاحة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_PERMS.map((p) => {
            const m = PERM_META[p];
            const Icon = m.icon;
            return (
              <div key={p} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <Icon className={`h-5 w-5 mt-0.5 ${m.color}`} />
                <div>
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Direct create admin */}
      {isSuper && <DirectCreateAdmin onCreated={load} />}

      <Card className="p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> إضافة بريد أدمن جديد
        </h3>
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            type="email"
            placeholder="example@wasalni.app"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            dir="ltr"
            className="text-left flex-1"
          />
          <Select value={newPerm} onValueChange={(v) => setNewPerm(v as AdminPerm)}>
            <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_PERMS.map((p) => (
                <SelectItem key={p} value={p}>{PERM_META[p].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addEmail} disabled={loading}>إضافة</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          اختر الدور الافتراضي — سيُطبَّق تلقائيًا عند تسجيل صاحب البريد. يمكن تعديله لاحقًا.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold flex items-center gap-2">
            <Mail className="h-4 w-4" /> قائمة البُرد المعتمَدة ({emails.length})
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">البريد</TableHead>
              <TableHead className="text-right w-56">الدور الافتراضي</TableHead>
              <TableHead className="text-right">تاريخ الإضافة</TableHead>
              <TableHead className="text-right w-24">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  لا توجد بُرد مسجلة
                </TableCell>
              </TableRow>
            )}
            {emails.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono" dir="ltr">{e.email}</TableCell>
                <TableCell>
                  <Select
                    value={e.default_permission}
                    disabled={!isSuper}
                    onValueChange={(v) => updateEmailPerm(e.id, v as AdminPerm)}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_PERMS.map((p) => (
                        <SelectItem key={p} value={p}>{PERM_META[p].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{new Date(e.created_at).toLocaleDateString("ar-EG")}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEmail(e.id, e.email)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold">المسؤولون النشطون ({admins.length})</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">الدور الحالي</TableHead>
              <TableHead className="text-right w-56">تغيير الدور</TableHead>
              <TableHead className="text-right w-56">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => {
              const meta = a.permission ? PERM_META[a.permission] : null;
              const Icon = meta?.icon ?? Eye;
              const isMainAdmin = a.user_id === meId && isSuper;
              return (
                <TableRow key={a.user_id}>
                  <TableCell className="font-semibold">
                    {a.full_name}
                    {isMainAdmin && (
                      <Badge variant="secondary" className="mr-2 text-[10px]">أنت</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {meta ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className="font-medium">{meta.label}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">— لم يُعيَّن</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={a.permission ?? undefined}
                      disabled={!isSuper}
                      onValueChange={(v) => changePerm(a.user_id, v as AdminPerm)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر دورًا" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_PERMS.map((p) => (
                          <SelectItem key={p} value={p}>{PERM_META[p].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isSuper || a.user_id === meId}
                      onClick={() => revokeAdmin(a.user_id)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      سحب الصلاحية
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
