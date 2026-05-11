import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { t, dir } = useI18n();
  const Arrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const sections = [
    ["terms.s1_title", "terms.s1_body"],
    ["terms.s2_title", "terms.s2_body"],
    ["terms.s3_title", "terms.s3_body"],
    ["terms.s4_title", "terms.s4_body"],
    ["terms.s5_title", "terms.s5_body"],
    ["terms.s6_title", "terms.s6_body"],
    ["terms.s7_title", "terms.s7_body"],
    ["terms.s8_title", "terms.s8_body"],
    ["terms.s9_title", "terms.s9_body"],
  ] as const;
  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-card sticky top-0 z-10">
        <Link to="/settings" className="p-2 -m-2"><Arrow className="h-5 w-5" /></Link>
        <h1 className="font-bold text-lg">{t("terms.title")}</h1>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">{t("legal.last_updated")}</p>
        <p className="text-sm leading-7">{t("terms.intro")}</p>
        {sections.map(([title, body]) => (
          <section key={title} className="space-y-1.5">
            <h2 className="font-bold text-sm">{t(title as any)}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{t(body as any)}</p>
          </section>
        ))}
        <p className="text-xs text-muted-foreground pt-3 border-t border-border">{t("terms.contact")}</p>
      </div>
    </div>
  );
}
