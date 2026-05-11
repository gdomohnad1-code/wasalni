# Ads Manager — خطة التنفيذ

نظام إعلانات ديناميكي كامل قابل للإدارة من الداش بورد بدون تعديل برمجي.

## 1. قاعدة البيانات (Migration)

### جدول `ads`
- `id`, `created_at`, `updated_at`, `created_by`
- `title`, `description`
- `type` enum: `banner | popup | video | story | notification | fullscreen | reward`
- `placement` enum (multi via array): `home | book | waiting_driver | driver_app | pre_confirm | post_ride`
- `target_audience` enum: `riders | drivers | both`
- `target_cities` text[] (اختياري)
- `target_min_rides` int / `target_max_rides` int (اختياري)
- `media_type` enum: `image | video | gif | link | qr`
- `media_url` (يرفع على bucket جديد `ads`)
- `external_link` text
- `qr_data` text
- `start_at`, `end_at` timestamptz
- `daily_start_hour`, `daily_end_hour` int (0-23, اختياري)
- `max_impressions_per_user` int
- `priority` int default 0 (الأعلى يظهر أولاً)
- `is_sponsored` bool, `sponsor_name` text
- `status` enum: `draft | scheduled | active | paused | ended`
- `auto_rotate` bool default true

### جدول `ad_events`
- `id`, `ad_id`, `user_id`, `event_type` enum: `impression | click | conversion`
- `created_at`, `metadata` jsonb

### Bucket تخزين
- `ads` (public) لرفع صور/فيديوهات الإعلانات

### RLS
- `ads`: admin يقرأ ويعدل كل شيء؛ المستخدم المسجل يقرأ الإعلانات النشطة المستهدفة له فقط
- `ad_events`: المستخدم يدرج events خاصة به؛ admin يقرأ الكل

### Function/Trigger
- `notify_ad_campaign_end()` — trigger على `ads` يدخل notification للـ admins عند `status = 'ended'` أو عند تجاوز `end_at`
- cron job (هنستخدم pg_cron إن متاح، أو route عام) يحدث الحالة من `scheduled → active → ended` كل 5 دقائق

## 2. صفحات الـ Admin

### `src/routes/admin.ads.tsx`
- جدول بكل الإعلانات: العنوان، النوع، المكان، الحالة، Priority، عدد المشاهدات، CTR، أزرار تفعيل/إيقاف/تعديل/حذف
- زر "إنشاء إعلان جديد" يفتح Dialog
- Tabs: All / Active / Scheduled / Paused / Ended

### مكوّن `AdEditor` (Dialog)
- form كامل بكل الحقول
- رفع وسائط (image/video/gif) لـ bucket `ads`
- اختيار placement(s) متعدد
- اختيار target audience + cities (multi-select) + rides range
- date/time pickers لـ start/end + ساعات اليوم
- Priority slider
- Preview pane حي يعرض شكل الإعلان حسب النوع
- Save as draft / Publish / Schedule

### `src/routes/admin.ads.$id.tsx` (Analytics لكل إعلان)
- Cards: Impressions, Clicks, CTR, Conversions, Revenue (لو sponsored)
- Chart زمني (recharts)
- جدول آخر الـ events

### تحديث `src/routes/admin.tsx` (sidebar)
- إضافة رابط "Ads Manager"

## 3. عرض الإعلانات في التطبيق

### Hook `useAds(placement)`
- يجلب الإعلانات المؤهلة (active, ضمن الفترة، target يطابق المستخدم، priority desc)
- يفلتر حسب `max_impressions_per_user` (محلياً + عبر `ad_events`)
- يدعم Smart Rotation: يخزن آخر `ad_id` ظهر للمستخدم في localStorage ويرجّع التالي
- يسجل impression تلقائياً عند ظهور الإعلان

### مكوّن `<AdSlot placement="home" />`
- يختار العرض المناسب حسب `type`:
  - `banner` → كارت أفقي
  - `popup` → Dialog
  - `video` → فيديو autoplay muted
  - `story` → عرض ملء الشاشة لفترة
  - `notification` → toast
  - `fullscreen` → overlay كامل مع زر إغلاق
  - `reward` → فيديو + زر "احصل على المكافأة"
- يسجل click عند النقر ويفتح `external_link`

### دمج في الصفحات
- `home.tsx`: `<AdSlot placement="home" />`
- `book.tsx`: `<AdSlot placement="book" />` و `placement="pre_confirm"` قبل زر التأكيد
- `ride.$id.tsx`: `placement="waiting_driver"` (status=accepted) و `placement="post_ride"` (status=completed)
- `driver.tsx`: `<AdSlot placement="driver_app" />`

## 4. Cron job لتحديث حالات الإعلانات

`src/routes/api/public/hooks/ads-tick.ts` (POST):
- يحول `scheduled → active` لو `start_at <= now()`
- يحول `active → ended` لو `end_at < now()`
- يدخل notification للـ admin عند انتهاء حملة
- تأمين بـ apikey (anon)
- يتم استدعاؤها من pg_cron كل 5 دقائق

## 5. ترجمات
إضافة كل المفاتيح الجديدة في `src/lib/i18n.tsx` (ar + en).

## تفاصيل تقنية
- نستخدم shadcn (Dialog, Tabs, Select, Calendar, Checkbox, Slider, Badge)
- recharts للتحليلات (مستخدم بالفعل)
- لا تعديل على types.ts (يولّد تلقائياً بعد الـ migration)

هل أكمل التنفيذ؟
