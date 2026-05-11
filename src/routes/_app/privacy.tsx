import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t, dir } = useI18n();
  const Arrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const sections = [
    ["privacy.s1_title", "privacy.s1_body"],
    ["privacy.s2_title", "privacy.s2_body"],
    ["privacy.s3_title", "privacy.s3_body"],
    ["privacy.s4_title", "privacy.s4_body"],
    ["privacy.s5_title", "privacy.s5_body"],
    ["privacy.s6_title", "privacy.s6_body"],
    ["privacy.s7_title", "privacy.s7_body"],
    ["privacy.s8_title", "privacy.s8_body"],
    ["privacy.s9_title", "privacy.s9_body"],
    ["privacy.s10_title", "privacy.s10_body"],
  ] as const;
  return (
    <div className="max-w-md mx-auto pb-8">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-card sticky top-0 z-10">
        <Link to="/settings" className="p-2 -m-2"><Arrow className="h-5 w-5" /></Link>
        <h1 className="font-bold text-lg">{t("privacy.title")}</h1>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">{t("legal.last_updated")}</p>
        <p className="text-sm leading-7">{t("privacy.intro")}</p>
        {sections.map(([title, body]) => (
          <section key={title} className="space-y-1.5">
            <h2 className="font-bold text-sm">{t(title as any)}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{t(body as any)}</p>
          </section>
        ))}
        <p className="text-xs text-muted-foreground pt-3 border-t border-border">{t("privacy.contact")}</p>
      </div>
    </div>
  );
}
