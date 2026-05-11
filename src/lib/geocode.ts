// Geocoding عبر OpenStreetMap Nominatim (مجاني — بدون مفتاح)
export type LatLng = { lat: number; lng: number };

const UA = "WasalniApp/1.0 (rider booking)";

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  if (!query || query.trim().length < 2) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ar&countrycodes=eg&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "ar" } });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr?.[0]) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}

export async function reverseGeocode(p: LatLng): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=ar&lat=${p.lat}&lon=${p.lng}`;
    const res = await fetch(url, { headers: { "Accept-Language": "ar" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
