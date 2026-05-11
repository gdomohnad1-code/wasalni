import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Shield, UserPlus, Mail } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/admins")({
  component: AdminsPage,
});

interface AdminEmail {
  id: string;
  email: string;
  created_at: string;
}
interface AdminUser {
  user_id: string;
  email: string | null;
  full_name: string;
}

function AdminsPage() {
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data: e } = await supabase
      .from("admin_emails")
      .select("*")
      .order("created_at", { ascending: false });
    setEmails((e ?? []) as AdminEmail[]);

    const { data: r } = await supabase
      .from("user_roles")
      .select("user_id, profiles:user_id(full_name)")
      .eq("role", "admin");
    setAdmins(
      (r ?? []).map((x: any) => ({
        user_id: x.user_id,
        email: null,
        full_name: x.profiles?.full_name ?? "—",
      }))
    );
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
      .insert({ email, created_by: user?.id });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "هذا البريد مضاف مسبقًا" : "تعذّر الإضافة");
      return;
    }
    toast.success("تمت الإضافة. أي حساب جديد بهذا البريد سيصبح أدمن تلقائيًا.");
    setNewEmail("");
    load();

    // If user already exists, promote now
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", "%")
      .limit(0); // placeholder; actual lookup needs auth.users (admin only via service role)
    void existing;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === userId) {
      toast.error("لا يمكنك إزالة صلاحياتك الخاصة");
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");
    if (error) return toast.error("تعذّر الإلغاء");
    toast.success("تم سحب صلاحية الأدمن");
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-extrabold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          إدارة المسؤولين
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          أي حساب جديد يُسجَّل بأحد البُرد التالية سيحصل على صلاحية أدمن تلقائيًا.
        </p>
      </div>

      <Card className="p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> إضافة بريد أدمن جديد
        </h3>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="example@wasalni.app"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            dir="ltr"
            className="text-left"
          />
          <Button onClick={addEmail} disabled={loading}>إضافة</Button>
        </div>
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
              <TableHead className="text-right">تاريخ الإضافة</TableHead>
              <TableHead className="text-right w-24">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  لا توجد بُرد مسجلة
                </TableCell>
              </TableRow>
            )}
            {emails.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono" dir="ltr">{e.email}</TableCell>
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
              <TableHead className="text-right">معرف الحساب</TableHead>
              <TableHead className="text-right w-32">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.user_id}>
                <TableCell className="font-semibold">{a.full_name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {a.user_id.slice(0, 8)}…
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeAdmin(a.user_id)}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    سحب الصلاحية
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Badge variant="secondary" className="text-xs">
        ملاحظة: ترقية حساب موجود مسبقًا تتم عبر "سحب/منح" يدويًا. الإضافة هنا تنطبق على التسجيلات الجديدة.
      </Badge>
    </div>
  );
}
