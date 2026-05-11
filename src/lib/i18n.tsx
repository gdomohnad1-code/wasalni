import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  ar: {
    // nav
    "nav.home": "الرئيسية",
    "nav.account": "حسابي",

    // profile
    "profile.menu": "القائمة الرئيسية",
    "profile.home": "الرئيسية",
    "profile.trips": "رحلاتي السابقة",
    "profile.wallet": "المحفظة",
    "profile.referral": "كود الدعوة",
    "profile.support": "الدعم والشكاوى",
    "profile.settings": "الإعدادات",
    "profile.referral_badge": "اربح 50 ج.م",
    "profile.join_driver": "انضم كسائق مع وصلني",
    "profile.join_driver_sub": "سجّل دلوقتي وابدأ تكسب من رحلاتك",
    "profile.new_badge": "جديد",
    "profile.admin_panel": "فتح لوحة الإدارة",
    "profile.signout": "تسجيل الخروج",
    "profile.version": "وصلني • الإصدار 1.0",

    // settings
    "settings.title": "الإعدادات",
    "settings.edit_profile": "تعديل البيانات",
    "settings.name": "الاسم",
    "settings.phone": "رقم الهاتف",
    "settings.email": "البريد الإلكتروني",
    "settings.save": "حفظ التغييرات",
    "settings.password": "تغيير كلمة المرور",
    "settings.new_password": "كلمة المرور الجديدة",
    "settings.confirm_password": "تأكيد كلمة المرور",
    "settings.password_hint": "6 أحرف على الأقل",
    "settings.password_confirm_hint": "أعد كتابة كلمة المرور",
    "settings.update_password": "تحديث كلمة المرور",
    "settings.notifications": "الإشعارات",
    "settings.notifications_sub": "استقبال إشعارات الرحلات والعروض",
    "settings.rate_app": "تقييم التطبيق",
    "settings.terms": "شروط الاستخدام",
    "settings.privacy": "سياسة الخصوصية",
    "settings.delete_account": "حذف الحساب",
    "settings.delete_confirm": "هل أنت متأكد من حذف حسابك؟",
    "settings.delete_desc": "سيتم حذف بياناتك بشكل دائم ولا يمكن التراجع.",
    "settings.cancel": "إلغاء",
    "settings.delete_final": "احذف نهائياً",
    "settings.signout": "تسجيل الخروج",
    "settings.language": "اللغة",
    "settings.language_sub": "اختر لغة التطبيق",
    "settings.language_ar": "العربية",
    "settings.language_en": "English",
    "settings.language_changed": "تم تغيير اللغة",

    // home
    "home.hello": "أهلاً",
    "home.guest": "ضيفنا الكريم",
    "home.wallet": "المحفظة",
    "home.book_now": "احجز الآن",
    "home.cta": "وصلني فوراً",
    "home.services": "الخدمات",
    "home.offers": "عروض",
    "home.my_trips": "رحلاتي",
    "home.destinations": "وجهاتي",
  },
  en: {
    // nav
    "nav.home": "Home",
    "nav.account": "Account",

    // profile
    "profile.menu": "Main Menu",
    "profile.home": "Home",
    "profile.trips": "Past Trips",
    "profile.wallet": "Wallet",
    "profile.referral": "Referral Code",
    "profile.support": "Support & Complaints",
    "profile.settings": "Settings",
    "profile.referral_badge": "Earn 50 EGP",
    "profile.join_driver": "Join Wasalni as a driver",
    "profile.join_driver_sub": "Register now and start earning",
    "profile.new_badge": "New",
    "profile.admin_panel": "Open Admin Panel",
    "profile.signout": "Sign Out",
    "profile.version": "Wasalni • v1.0",

    // settings
    "settings.title": "Settings",
    "settings.edit_profile": "Edit Profile",
    "settings.name": "Name",
    "settings.phone": "Phone Number",
    "settings.email": "Email",
    "settings.save": "Save Changes",
    "settings.password": "Change Password",
    "settings.new_password": "New Password",
    "settings.confirm_password": "Confirm Password",
    "settings.password_hint": "At least 6 characters",
    "settings.password_confirm_hint": "Re-enter password",
    "settings.update_password": "Update Password",
    "settings.notifications": "Notifications",
    "settings.notifications_sub": "Receive trip and offer notifications",
    "settings.rate_app": "Rate the App",
    "settings.terms": "Terms of Use",
    "settings.privacy": "Privacy Policy",
    "settings.delete_account": "Delete Account",
    "settings.delete_confirm": "Are you sure you want to delete your account?",
    "settings.delete_desc": "Your data will be permanently deleted and cannot be recovered.",
    "settings.cancel": "Cancel",
    "settings.delete_final": "Delete Permanently",
    "settings.signout": "Sign Out",
    "settings.language": "Language",
    "settings.language_sub": "Choose app language",
    "settings.language_ar": "العربية",
    "settings.language_en": "English",
    "settings.language_changed": "Language changed",

    // home
    "home.hello": "Hello",
    "home.guest": "Guest",
    "home.wallet": "Wallet",
    "home.book_now": "Book now",
    "home.cta": "Wasalni instantly",
    "home.services": "Services",
    "home.offers": "Offers",
    "home.my_trips": "My Trips",
    "home.destinations": "Destinations",
  },
} as const;

type Key = keyof typeof dict["ar"];

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  dir: "rtl" | "ltr";
}

const Ctx = createContext<I18nCtx | null>(null);

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  const stored = localStorage.getItem("app_lang");
  return stored === "en" ? "en" : "ar";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("app_lang", l);
  }, []);

  const t = useCallback((k: Key) => (dict[lang] as Record<string, string>)[k] ?? (dict.ar as Record<string, string>)[k] ?? k, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, dir: (lang === "ar" ? "rtl" : "ltr") as "rtl" | "ltr" }),
    [lang, setLang, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}
