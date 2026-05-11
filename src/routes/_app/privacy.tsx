import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Link to="/settings" className="p-2 -m-2"><ArrowRight className="h-5 w-5" /></Link>
        <h1 className="font-bold text-lg">سياسة الخصوصية</h1>
      </div>
      <div className="p-4 text-sm leading-7 space-y-3 text-muted-foreground">
        <p>نحن في وصلني نحترم خصوصيتك ونلتزم بحماية بياناتك:</p>
        <ul className="list-disc pr-5 space-y-2">
          <li>نجمع فقط البيانات اللازمة لتقديم الخدمة (الاسم، الهاتف، الموقع، طرق الدفع).</li>
          <li>بيانات الموقع تُستخدم فقط أثناء الرحلات لمطابقة السائق وحساب المسافة.</li>
          <li>لن نشارك بياناتك مع أي طرف ثالث إلا لتنفيذ خدمة طلبتها أو بحكم قانوني.</li>
          <li>بيانات بطاقتك البنكية لا تُخزَّن لدينا، وتُعالَج عبر بوابة دفع مشفّرة.</li>
          <li>يمكنك حذف حسابك وبياناتك في أي وقت من شاشة الإعدادات.</li>
        </ul>
      </div>
    </div>
  );
}
