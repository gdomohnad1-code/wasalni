import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Send, Sparkles, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { askSupport } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function SupportPage() {
  const ask = useServerFn(askSupport);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "أهلاً بيك في دعم وصلني 👋\nقولّي مشكلتك وأنا معاك." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "حصل خطأ، حاول تاني." }]);
    } finally {
      setLoading(false);
    }
  };

  const fileComplaint = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content || "شكوى من المحادثة";
    await supabase.from("complaints").insert({
      user_id: user.id,
      category: "general",
      subject: lastUser.slice(0, 60),
      message: lastUser,
    });
    toast.success("تم تسجيل الشكوى وسيتم الرد عليك قريباً");
  };

  return (
    <div className="max-w-md mx-auto h-[calc(100vh-5rem)] -mb-20 flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-card">
        <Link to="/profile" className="p-2 -m-2"><ArrowRight className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="font-bold">الدعم الذكي</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> مدعوم بالذكاء الاصطناعي</p>
        </div>
        <Button size="sm" variant="outline" onClick={fileComplaint}>تسجيل شكوى</Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 pb-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.role === "user" ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Bot className="h-4 w-4" /></div>
            <div className="bg-card border border-border rounded-2xl px-3 py-2 text-sm">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
                <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border bg-card flex gap-2">
        <Input
          placeholder="اكتب مشكلتك..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()} className="bg-gradient-primary">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
