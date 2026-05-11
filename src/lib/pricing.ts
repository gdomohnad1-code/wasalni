// تسعيرة الخدمات
export const RIDE_TYPES = {
  private: { label: "رحلة خاصة", icon: "🚗", multiplier: 1, color: "primary" },
  shared: { label: "مشاركة", icon: "👥", multiplier: 0.7, color: "accent" },
  package: { label: "توصيل طرد", icon: "📦", multiplier: 0.9, color: "warning" },
  female: { label: "رحلة نسائية", icon: "💗", multiplier: 1.15, color: "primary" },
  vip: { label: "VIP", icon: "👑", multiplier: 1.8, color: "primary" },
} as const;

export type RideTypeKey = keyof typeof RIDE_TYPES;

const BASE_PRICE = 30; // أول 3 كم
const BASE_KM = 3;
const PER_KM = 6;

export function calcPrice(distanceKm: number, type: RideTypeKey): number {
  const extra = Math.max(0, distanceKm - BASE_KM);
  const raw = (BASE_PRICE + extra * PER_KM) * RIDE_TYPES[type].multiplier;
  return Math.round(raw);
}

export function calcDuration(distanceKm: number): number {
  return Math.max(5, Math.round(distanceKm * 2.5));
}

// مسافة وهمية محسوبة من سلسلة العنوانين (للديمو)
export function fakeDistance(from: string, to: string): number {
  const seed = (from + to).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.round((3 + (seed % 18) + (seed % 7) * 0.3) * 10) / 10;
}
