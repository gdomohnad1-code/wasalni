import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Link to="/settings" className="p-2 -m-2"><ArrowRight className="h-5 w-5" /></Link>
        <h1 className="font-bold text-lg">شروط الاستخدام</h1>
      </div>
      <div className="p-4 text-sm leading-7 space-y-3 text-muted-foreground">
        <p>باستخدامك تطبيق وصلني فأنت توافق على الالتزام بالشروط التالية:</p>
        <ol className="list-decimal pr-5 space-y-2">
          <li>التطبيق يقدّم خدمة وساطة بين الراكب والسائق ولا يتحمل مسؤولية أي اتفاق خارجها.</li>
          <li>يُمنع نقل أي مواد محظورة قانونياً (مخدرات - أسلحة - مواد مشتعلة).</li>
          <li>الحد الأقصى لوزن الطرود 30 كجم، التوصيل من الباب للباب فقط.</li>
          <li>الأسعار تُحسب آلياً حسب المسافة، وعمولة المنصة 1% فقط من قيمة الرحلة.</li>
          <li>يحق لإدارة وصلني إيقاف أي حساب يُسيء استخدام الخدمة.</li>
          <li>الدفع يتم نقداً أو من المحفظة الإلكترونية، والشحن عبر بطاقات Visa / Mastercard.</li>
        </ol>
      </div>
    </div>
  );
}
