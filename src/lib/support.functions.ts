import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(2000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

export const askSupport = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { reply: "خدمة الدعم الذكي غير مفعّلة حالياً.", error: true };
    }

    const system = `أنت مساعد دعم فني لتطبيق "وصلني" لخدمة النقل والتوصيل في مصر.
- ردّ بالعربية المصرية بشكل ودود ومختصر.
- ساعد العميل في حلّ مشكلته (المحفظة، الرحلات، السائق، الأسعار، التطبيق).
- لو المشكلة محتاجة تدخّل بشري (شكوى ضد سائق، استرداد أموال، حادث) قول له هتتحول لفريق الدعم وسجّل الشكوى.
- التسعيرة: 30 ج للأول 3 كم + 3 ج لكل كم زيادة. عمولة البرنامج 1% فقط.
- الحد الأقصى للطرود 30 كجم، باب لباب، ممنوع المواد المحظورة قانوناً.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
      });

      if (res.status === 429) return { reply: "الخدمة مزحومة دلوقتي، حاول كمان شوية.", error: true };
      if (res.status === 402) return { reply: "تم استنفاد رصيد الـ AI، تواصل مع الإدارة.", error: true };
      if (!res.ok) return { reply: "حصل خطأ في خدمة الدعم، حاول تاني.", error: true };

      const json = await res.json();
      const reply = json.choices?.[0]?.message?.content?.trim() || "معذرة، مفيش رد.";
      return { reply, error: false };
    } catch {
      return { reply: "تعذّر الاتصال بخدمة الدعم.", error: true };
    }
  });
