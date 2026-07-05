import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, ScanLine, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/scan")({
  component: ScanPage,
});

const REGION_ID = "wasalny-qr-region";

function ScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const stop = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  };

  const handleDecoded = async (raw: string) => {
    if (status === "processing") return;
    setStatus("processing");
    await stop();

    let driverId: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.t === "wasalny_hail" && typeof parsed?.d === "string") {
        driverId = parsed.d;
      }
    } catch {
      // Not JSON — try raw uuid
      if (/^[0-9a-f-]{36}$/i.test(raw.trim())) driverId = raw.trim();
    }

    if (!driverId) {
      setError("الكود غير صالح لتطبيق وصلني");
      setStatus("error");
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("hail_instant_ride", {
      p_driver_id: driverId,
      p_destination_address: "وجهة يحددها الراكب",
    });

    if (rpcError) {
      const msg = rpcError.message || "";
      let friendly = "تعذّر بدء الرحلة";
      if (msg.includes("driver_not_available")) friendly = "السائق غير متاح حالياً";
      else if (msg.includes("driver_busy")) friendly = "السائق مشغول في رحلة أخرى";
      else if (msg.includes("rider_has_active_ride")) friendly = "عندك رحلة نشطة بالفعل";
      else if (msg.includes("invalid driver")) friendly = "لا يمكنك مسح الكود بتاعك";
      setError(friendly);
      setStatus("error");
      toast.error(friendly);
      return;
    }

    toast.success("تم بدء الرحلة!");
    navigate({ to: "/ride/$id", params: { id: String(data) } });
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;
        setStatus("scanning");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => { void handleDecoded(decoded); },
          () => { /* per-frame decode failures — ignore */ },
        );
      } catch (e: any) {
        setError(e?.message || "تعذّر فتح الكاميرا. تحقق من صلاحيات المتصفح.");
        setStatus("error");
      }
    };
    void start();

    return () => { void stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    setError(null);
    startedRef.current = false;
    setStatus("idle");
    // trigger effect by remounting via key change would be cleaner, but simpler: reload
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <Link to="/home" className="h-10 w-10 rounded-full bg-white/10 backdrop-blur grid place-items-center">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2 text-sm font-black">
          <ScanLine className="h-4 w-4 text-primary" /> مسح QR السائق
        </div>
        <div className="w-10" />
      </div>

      {/* Camera region */}
      <div className="relative flex-1 grid place-items-center overflow-hidden">
        <div id={REGION_ID} className="w-full h-full" />

        {/* Aim overlay */}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-64 w-64">
              <div className="absolute inset-0 rounded-3xl border-2 border-white/30" />
              <div className="absolute -top-1 -left-1 h-10 w-10 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute -top-1 -right-1 h-10 w-10 border-t-4 border-r-4 border-primary rounded-tr-3xl" />
              <div className="absolute -bottom-1 -left-1 h-10 w-10 border-b-4 border-l-4 border-primary rounded-bl-3xl" />
              <div className="absolute -bottom-1 -right-1 h-10 w-10 border-b-4 border-r-4 border-primary rounded-br-3xl" />
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="absolute inset-0 bg-black/70 grid place-items-center">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
              <div className="font-black">بنبدأ رحلتك…</div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 bg-black/85 grid place-items-center p-6">
            <div className="max-w-sm w-full bg-white text-gray-900 rounded-2xl p-5 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <div className="font-black mb-1">{error}</div>
              <p className="text-xs text-gray-500 mb-4">
                تأكد أن السائق فتح كود QR على شاشته وحاول مرة أخرى.
              </p>
              <button onClick={retry} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-black">
                إعادة المحاولة
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="p-4 pb-8 text-center bg-gradient-to-t from-black to-transparent">
        <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground px-3 py-1.5 rounded-full text-[11px] font-bold">
          <CheckCircle2 className="h-3.5 w-3.5" /> وجّه الكاميرا لكود السائق داخل العربية
        </div>
      </div>
    </div>
  );
}
