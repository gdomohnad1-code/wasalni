import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Runs an async mutation with exponential-backoff retry.
 * Never throws to the caller — optimistic UI stays applied while we retry
 * silently in the background. Only surfaces a soft toast after final failure.
 */
export async function retryMutation<T>(
  fn: () => Promise<T>,
  opts: {
    retries?: number;
    baseDelayMs?: number;
    label?: string;
    onFinalFail?: (err: unknown) => void;
  } = {},
): Promise<T | null> {
  const retries = opts.retries ?? 5;
  const base = opts.baseDelayMs ?? 800;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fn();
      // Supabase returns { error } instead of throwing
      const err = (res as any)?.error;
      if (err) throw err;
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      // Wait for network before next attempt when offline
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await waitForOnline();
      } else {
        const delay = Math.min(base * Math.pow(2, attempt), 15_000) + Math.random() * 300;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  if (opts.onFinalFail) opts.onFinalFail(lastErr);
  else if (opts.label) {
    // Soft, non-blocking notice — no fatal error modal
    toast.warning(`تعذّر مزامنة "${opts.label}" حالياً — سنعيد المحاولة تلقائياً`);
  }
  return null;
}

function waitForOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || navigator.onLine) return resolve();
    const on = () => {
      window.removeEventListener("online", on);
      resolve();
    };
    window.addEventListener("online", on);
  });
}

export function useOnlineStatus() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
