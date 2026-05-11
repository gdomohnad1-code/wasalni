
# نظام التسجيل الكامل للسائقين

## 1) تعديلات قاعدة البيانات (migration)

إضافة الأعمدة الناقصة على جدول `driver_documents`:

| العمود | النوع | الوصف |
|---|---|---|
| `id_card_front_url` | text | صورة البطاقة (وجه) |
| `id_card_back_url` | text | صورة البطاقة (ظهر) |
| `selfie_url` | text | سيلفي السائق |
| `car_type` | text | نوع العربية (سيدان/SUV/...) |
| `submitted_at` | timestamptz | وقت تقديم الطلب |
| `reviewed_at` | timestamptz | وقت المراجعة |
| `reviewed_by` | uuid | الـ admin اللي راجع |
| `next_attempt_at` | timestamptz | وقت السماح بإعادة المحاولة بعد الرفض (now + 24h) |
| `rejection_count` | int default 0 | عدد مرات الرفض |

تغيير `account_status` enum ليشمل: `pending` (قيد المراجعة) — موجود فعلاً: active/suspended/banned، هضيف `pending` و `rejected`.

إضافة Storage bucket خاص: `driver-applications` (private، RLS: المستخدم يرفع لمجلده، الإدمن يقرأ الكل).

## 2) واجهة تسجيل السائق (داخل التطبيق نفسه)

صفحة `/become-driver` فيها form متعدد الخطوات:

- **خطوة 1 — البيانات الشخصية**: رفع البطاقة (وجه + ظهر) + سيلفي
- **خطوة 2 — الرخصة**: صورة رخصة القيادة
- **خطوة 3 — العربية**: نوعها + موديل + رقم اللوحة + صورة العربية + صورة الرخصة
- **خطوة 4 — مراجعة وإرسال**: عرض كل البيانات + زر إرسال نهائي

عند الإرسال:
- `account_status = 'pending'`
- `submitted_at = now()`
- إنشاء إشعار للمستخدم: "تم استلام طلبك، سيتم المراجعة خلال 48 ساعة"

## 3) منطق الحماية (Gating)

- لو المستخدم status=`pending` → تظهر له صفحة "طلبك قيد المراجعة" مع countdown للـ 48 ساعة
- لو `rejected` و `next_attempt_at > now()` → "تم رفض طلبك، يمكنك المحاولة بعد X ساعة" (countdown حقيقي)
- لو `rejected` و `next_attempt_at <= now()` → يقدر يقدم تاني (الـ form يفتح من جديد)
- لو `active` → السائق يدخل واجهة السائق عادي

## 4) قسم "المقدّمون" في الداشبورد

صفحة جديدة `/admin/applicants` فيها:

- جدول بكل الطلبات `pending`
- لكل طلب: اسم + تاريخ التقديم + زمن متبقي للـ 48 ساعة + زر "عرض"
- صفحة تفصيلية: عرض كل الصور والبيانات
- 3 أزرار:
  1. **قبول** → `account_status='active'`, `approved=true`, إشعار قبول، إضافة دور `driver`
  2. **رفض** → `account_status='rejected'`, `next_attempt_at = now()+24h`, `rejection_count++`، إشعار + سبب الرفض
  3. **طلب تعديل** → نموذج فيه checkboxes (تغيير صورة شخصية / صورة عربية / رخصة / ...) + رسالة → يبعت إشعار + إيميل بالتعديلات المطلوبة، الـ status يفضل pending والمستخدم يقدر يعدّل ويعيد الإرسال

## 5) الإشعارات

كلها عبر النظام الموجود (`notifications` table + FCM Push اللي ربطناه قبل كده):

- **استلام**: "تم استلام طلبك، المراجعة خلال 48 ساعة"
- **قبول**: "🎉 تم قبولك كسائق! يمكنك بدء العمل الآن"
- **رفض**: "تم رفض الطلب: [السبب]. يمكنك إعادة التقديم بعد 24 ساعة"
- **طلب تعديل**: "يلزم تعديل البيانات التالية: [القائمة]"

الإيميل: نفس النص يتبعت عبر Lovable Cloud auth (الإيميل مسجّل في `auth.users.email`).

## 6) واجهة إعادة التعديل (للسائق المرفوض/المطلوب تعديله)

- شاشة بنفس الـ form القديم لكن:
  - الحقول اللي طُلب تعديلها مهايلايت بإطار أحمر + رسالة "يجب تعديل هذا الحقل"
  - باقي الحقول read-only (محفوظ)
- زر "إعادة الإرسال" → status يرجع `pending` + `submitted_at = now()`

## 7) ما لن يتم

- لن أبني ساعة countdown في الـ backend (الفكرة تتم client-side من قراءة `next_attempt_at` من DB)
- لن أبني SMS (إشعار + إيميل فقط)
- لن أربط بمزوّد توثيق هوية تلقائي (المراجعة بشرية يدوية)

---

## ملاحظات تقنية

- Storage bucket جديد `driver-applications` private، RLS: `(storage.foldername(name))[1] = auth.uid()::text` للقراءة/الكتابة الذاتية + admin يقرأ الكل
- صلاحية إدارية جديدة: ممكن نستخدم الموجود `drivers` ضمن `admin_permission` enum، أو نضيف `driver_applications` (هختار الموجود `drivers` لتبسيط الأمور)
- صفحة المقدّمين تستخدم نفس layout الموجود في `/admin/drivers`
- سرفر فنكشنز: `submit-application`, `approve-application`, `reject-application`, `request-changes-application` كلها `createServerFn` مع `requireSupabaseAuth`

---

**سؤال قبل التنفيذ**: عايز الإيميل يتبعت من خلال Lovable Cloud الافتراضي (sender = `noreply`)، ولا تحب نفعّل **Resend connector** لإيميلات احترافية بـ branding واسم تطبيقك (ينصح بيه)؟ ولو Resend، عندك دومين موثّق أو نستخدم `onboarding@resend.dev` للتجربة؟

لما تأكد على الخطة (ولو فيه أي تعديل)، أبدأ التنفيذ على الفور.
