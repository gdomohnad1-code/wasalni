import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

/**
 * Global in-app (foreground) realtime notifications for ride lifecycle events.
 * - Rider: gets toasts when a driver accepts, starts, or completes their ride.
 * - Driver: gets toasts when a new ride request appears (searching).
 * Mounts once in the app layout.
 */
export function useRideNotifications() {
  const { t } = useI18n();
  const lastStatus = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let riderCh: ReturnType<typeof supabase.channel> | null = null;
    let driverCh: ReturnType<typeof supabase.channel> | null = null;
    let newRideCh: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      // Detect role(s)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const isDriver = roles?.some((r) => r.role === "driver");

      // Rider channel: my rides updates
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
            if (r.status === "accepted") {
              toast.success(t("notif.driver_accepted"), { description: t("notif.driver_accepted_desc") });
            } else if (r.status === "in_progress") {
              toast.success(t("notif.ride_started"), { description: t("notif.ride_started_desc") });
            } else if (r.status === "completed") {
              toast.success(t("notif.ride_completed"));
            } else if (r.status === "cancelled") {
              toast.error(t("notif.ride_cancelled"));
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "rides", filter: `rider_id=eq.${uid}` },
          (payload) => {
            const r: any = payload.new;
            lastStatus.current.set(r.id, r.status);
            toast.success(t("notif.ride_booked"), { description: t("notif.ride_booked_desc") });
          },
        )
        .subscribe();

      // Driver channel: new ride requests + my driver ride updates
      if (isDriver) {
        newRideCh = supabase
          .channel(`notif-newride-${uid}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "rides" },
            (payload) => {
              const r: any = payload.new;
              if (r.status === "searching") {
                toast(t("notif.new_ride_request"), { description: r.pickup_address });
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
              if (r.status === "completed") {
                toast.success(t("notif.ride_completed"));
              } else if (r.status === "cancelled") {
                toast.error(t("notif.ride_cancelled"));
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
  }, [t]);
}
