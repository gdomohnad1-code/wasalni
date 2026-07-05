import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "@tanstack/react-router";

/**
 * Global in-app (foreground) realtime notifications for ride lifecycle events.
 * Each toast has a "Open" action that deep-links to the relevant screen:
 * - Rider events → /ride/$id
 * - Driver new request → /driver
 */
export function useRideNotifications() {
  const { t } = useI18n();
  const router = useRouter();
  const lastStatus = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let riderCh: ReturnType<typeof supabase.channel> | null = null;
    let driverCh: ReturnType<typeof supabase.channel> | null = null;
    let newRideCh: ReturnType<typeof supabase.channel> | null = null;

    const openLabel = t("notif.open") || "فتح";
    const openRide = (rideId: string) =>
      router.navigate({ to: "/ride/$id", params: { id: rideId } });
    const openDriver = () => router.navigate({ to: "/driver" });

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const isDriver = roles?.some((r) => r.role === "driver");

      riderCh = supabase
        .channel(`notif-rider-${uid}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rides", filter: `rider_id=eq.${uid}` },
          (payload) => {
            const r: any = payload.new;
            const prev = lastStatus.current.get(r.id);
            lastStatus.current.set(r.id, r.status);
            if (prev === r.status) return;
            const action = { label: openLabel, onClick: () => openRide(r.id) };
            if (r.status === "accepted") {
              toast.success(t("notif.driver_accepted"), { description: t("notif.driver_accepted_desc"), action });
            } else if (r.status === "in_progress") {
              toast.success(t("notif.ride_started"), { description: t("notif.ride_started_desc"), action });
            } else if (r.status === "completed") {
              toast.success(t("notif.ride_completed"), { action });
            } else if (r.status === "cancelled") {
              toast.error(t("notif.ride_cancelled"), { action });
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "rides", filter: `rider_id=eq.${uid}` },
          (payload) => {
            const r: any = payload.new;
            lastStatus.current.set(r.id, r.status);
            toast.success(t("notif.ride_booked"), {
              description: t("notif.ride_booked_desc"),
              action: { label: openLabel, onClick: () => openRide(r.id) },
            });
          },
        )
        .subscribe();

      if (isDriver) {
        newRideCh = supabase
          .channel(`notif-newride-${uid}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "rides" },
            (payload) => {
              const r: any = payload.new;
              if (r.status === "searching") {
                toast(t("notif.new_ride_request"), {
                  description: r.pickup_address,
                  action: { label: openLabel, onClick: () => openDriver() },
                });
              }
            },
          )
          .subscribe();

        driverCh = supabase
          .channel(`notif-driver-${uid}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${uid}` },
            (payload) => {
              const r: any = payload.new;
              const prev = lastStatus.current.get(r.id);
              lastStatus.current.set(r.id, r.status);
              if (prev === r.status) return;
              const action = { label: openLabel, onClick: () => openRide(r.id) };
              if (r.status === "completed") {
                toast.success(t("notif.ride_completed"), { action });
              } else if (r.status === "cancelled") {
                toast.error(t("notif.ride_cancelled"), { action });
              }
            },
          )
          .subscribe();
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (riderCh) supabase.removeChannel(riderCh);
      if (driverCh) supabase.removeChannel(driverCh);
      if (newRideCh) supabase.removeChannel(newRideCh);
    };
  }, [t, router]);
}
