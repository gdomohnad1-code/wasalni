import { useEffect, useState } from "react";
import { useAds, type AdPlacement, type Ad } from "@/hooks/use-ads";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Gift } from "lucide-react";
import { toast } from "sonner";

interface AdSlotProps {
  placement: AdPlacement;
  className?: string;
}

function openLink(ad: Ad) {
  if (ad.external_link) window.open(ad.external_link, "_blank", "noopener,noreferrer");
}

export function AdSlot({ placement, className }: AdSlotProps) {
  const { ad, trackClick } = useAds(placement);
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ad) return;
    if (ad.type === "notification") {
      toast(ad.title, {
        description: ad.description ?? undefined,
        action: ad.external_link ? {
          label: "افتح",
          onClick: () => { trackClick(); openLink(ad); },
        } : undefined,
      });
    } else if (ad.type === "popup" || ad.type === "fullscreen" || ad.type === "story" || ad.type === "reward") {
      setOpen(true);
    }
  }, [ad?.id]);

  if (!ad || closed) return null;

  const handleClick = () => { trackClick(); openLink(ad); };

  // Inline banner / video
  if (ad.type === "banner" || ad.type === "video") {
    return (
      <div className={`relative rounded-2xl overflow-hidden border border-border bg-card shadow-sm ${className ?? ""}`}>
        {ad.is_sponsored && (
          <Badge className="absolute top-2 right-2 z-10 text-[10px]" variant="secondary">
            {ad.sponsor_name ? `برعاية ${ad.sponsor_name}` : "إعلان"}
          </Badge>
        )}
        <button
          onClick={() => setClosed(true)}
          className="absolute top-2 left-2 z-10 h-7 w-7 grid place-items-center rounded-full bg-background/80 backdrop-blur"
          aria-label="إغلاق"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleClick} className="block w-full text-right">
          {ad.media_type === "video" && ad.media_url ? (
            <video src={ad.media_url} autoPlay muted loop playsInline className="w-full h-40 object-cover" />
          ) : ad.media_url ? (
            <img src={ad.media_url} alt={ad.title} className="w-full h-40 object-cover" />
          ) : (
            <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center">
              <span className="font-bold">{ad.title}</span>
            </div>
          )}
          <div className="p-3">
            <div className="font-bold text-sm">{ad.title}</div>
            {ad.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{ad.description}</div>}
          </div>
        </button>
      </div>
    );
  }

  // Popup / fullscreen / story / reward — render via Dialog
  const isFullscreen = ad.type === "fullscreen" || ad.type === "story";
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setClosed(true); }}>
      <DialogContent className={isFullscreen ? "max-w-full h-[100dvh] sm:rounded-none p-0" : "max-w-md p-0 overflow-hidden"}>
        <DialogHeader className="sr-only"><DialogTitle>{ad.title}</DialogTitle></DialogHeader>
        <div className="relative">
          {ad.is_sponsored && (
            <Badge className="absolute top-3 right-3 z-10 text-[10px]" variant="secondary">
              {ad.sponsor_name ? `برعاية ${ad.sponsor_name}` : "إعلان"}
            </Badge>
          )}
          {ad.media_type === "video" && ad.media_url ? (
            <video src={ad.media_url} autoPlay muted={ad.type !== "reward"} controls={ad.type === "reward"} loop={ad.type !== "reward"} playsInline className={isFullscreen ? "w-full h-[60dvh] object-cover" : "w-full h-56 object-cover"} />
          ) : ad.media_url ? (
            <img src={ad.media_url} alt={ad.title} className={isFullscreen ? "w-full h-[60dvh] object-cover" : "w-full h-56 object-cover"} />
          ) : (
            <div className={`${isFullscreen ? "h-[60dvh]" : "h-56"} bg-gradient-to-br from-primary to-primary/60`} />
          )}
          <div className="p-5 space-y-3">
            <h3 className="text-lg font-extrabold">{ad.title}</h3>
            {ad.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{ad.description}</p>}
            {ad.media_type === "qr" && ad.qr_data && (
              <img
                alt="QR"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ad.qr_data)}`}
                className="mx-auto"
              />
            )}
            <div className="flex gap-2 pt-2">
              {ad.external_link && (
                <Button onClick={handleClick} className="flex-1 gap-2">
                  {ad.type === "reward" ? <><Gift className="h-4 w-4" /> احصل على المكافأة</> : <><ExternalLink className="h-4 w-4" /> افتح</>}
                </Button>
              )}
              <Button variant="outline" onClick={() => { setOpen(false); setClosed(true); }}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
