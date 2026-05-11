import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, Trash2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string, lang: "ar" | "en") {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const ar = lang === "ar";
  if (diff < 60) return ar ? "الآن" : "now";
  if (diff < 3600) return `${Math.floor(diff / 60)} ${ar ? "د" : "m"}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${ar ? "س" : "h"}`;
  return `${Math.floor(diff / 86400)} ${ar ? "ي" : "d"}`;
}

export function NotificationCenter({ className = "" }: { className?: string }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [uid, setUid] = useState<string | null>(null);

  const load = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setItems(data as Notif[]);
  }, []);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id) return;
      setUid(id);
      await load(id);
      ch = supabase
        .channel(`notif-center-${id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${id}` },
          () => load(id),
        )
        .subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!uid || unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAll = async () => {
    if (!uid) return;
    await supabase.from("notifications").delete().eq("user_id", uid);
    setItems([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label={t("notif.center")}
          className={`relative h-10 w-10 rounded-full bg-muted grid place-items-center ${className}`}
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col z-[9999]">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">{t("notif.center")}</SheetTitle>
            <div className="flex gap-2">
              <Button
                size="sm" variant="ghost" onClick={markAllRead}
                disabled={unread === 0}
                className="h-8 text-xs"
              >
                <CheckCheck className="h-4 w-4 me-1" />{t("notif.mark_all")}
              </Button>
              <Button
                size="sm" variant="ghost" onClick={clearAll}
                disabled={items.length === 0}
                className="h-8 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 me-1" />{t("notif.clear")}
              </Button>
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">{t("notif.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`p-4 cursor-pointer transition ${
                    n.read ? "bg-background" : "bg-primary/5"
                  } hover:bg-muted/50`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      n.read ? "bg-transparent" : "bg-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className={`text-sm truncate ${n.read ? "font-medium" : "font-bold"}`}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(n.created_at, lang)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
