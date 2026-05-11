// Web FCM token registration helper.
// Requires VITE_FIREBASE_* env vars to be set (in .env or Lovable env).

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function isFcmConfigured() {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId &&
      VAPID_KEY,
  );
}

function getFirebaseApp() {
  if (getApps().length) return getApp();
  return initializeApp(config as Record<string, string>);
}

async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const params = new URLSearchParams({
    apiKey: config.apiKey!,
    authDomain: config.authDomain!,
    projectId: config.projectId!,
    messagingSenderId: config.messagingSenderId!,
    appId: config.appId!,
  });
  return navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${params.toString()}`,
    { scope: "/" },
  );
}

/**
 * Request permission, fetch FCM token, and store it for the current user.
 * Safe to call multiple times — UPSERT on token uniqueness.
 */
export async function registerFcmTokenForCurrentUser(): Promise<{
  ok: boolean;
  reason?: string;
  token?: string;
}> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "ssr" };
    if (!isFcmConfigured()) return { ok: false, reason: "not-configured" };
    if (!(await isSupported())) return { ok: false, reason: "unsupported" };

    // skip in iframe / preview to avoid stale SW issues
    try {
      if (window.self !== window.top) return { ok: false, reason: "iframe" };
    } catch {
      return { ok: false, reason: "iframe" };
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { ok: false, reason: "no-user" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "permission-denied" };

    const swReg = await registerSw();
    if (!swReg) return { ok: false, reason: "no-sw" };

    getFirebaseApp();
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY!,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return { ok: false, reason: "no-token" };

    // upsert into device_tokens
    const { error } = await supabase
      .from("device_tokens")
      .upsert(
        { user_id: userId, token, platform: "web" },
        { onConflict: "token" },
      );
    if (error) return { ok: false, reason: error.message };

    // Foreground messages → optional UI toast hook
    onMessage(messaging, (payload) => {
      // Simple browser notification fallback
      if (Notification.permission === "granted" && payload?.notification) {
        new Notification(payload.notification.title ?? "إشعار", {
          body: payload.notification.body ?? "",
          icon: "/favicon.ico",
        });
      }
    });

    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "unknown" };
  }
}
