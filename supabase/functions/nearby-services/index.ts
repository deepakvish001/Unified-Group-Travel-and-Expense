import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") ?? "";

type CategoryMap = { [key: string]: string };

const CATEGORY_QUERIES: CategoryMap = {
  car_rental: "car rental",
  restaurant: "restaurants",
  hotel: "hotels",
  cafe: "cafes",
  attraction: "tourist attractions",
  fuel_station: "gas stations",
  emergency: "hospital emergency",
};

type Body = {
  lat: number;
  lng: number;
  category: string;
  radius?: number;
  data_id?: string;
  action?: "search" | "details";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!SERPAPI_KEY) {
      return json({ error: "SERPAPI_KEY not configured" }, 500);
    }

    const body = (await req.json()) as Body;
    const { action } = body;

    // Details action: fetch full place details by data_id
    if (action === "details" && body.data_id) {
      const url = `https://serpapi.com/search.json?engine=google_maps&data_id=${encodeURIComponent(body.data_id)}&api_key=${SERPAPI_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const place = data.place_results as Record<string, unknown> | undefined;

      if (!place) {
        return json({ error: "Place not found" }, 404);
      }

      const gps = place.gps_coordinates as { latitude: number; longitude: number } | undefined;
      const operatingHours = place.operating_hours as Record<string, unknown> | undefined;
      const photos = (place.photos as Record<string, unknown>[]) ?? [];

      return json({
        place: {
          id: (place.data_id as string) || (place.place_id as string) || "",
          name: place.title ?? "Unknown",
          address: place.address ?? "",
          rating: place.rating ?? null,
          reviews: place.reviews ?? 0,
          type: place.type ?? "",
          types: place.types ?? [],
          price: place.price ?? null,
          description: place.description ?? null,
          thumbnail: place.thumbnail ?? null,
          photos: photos.slice(0, 5).map((p: Record<string, unknown>) => p.thumbnail ?? p.link ?? null).filter(Boolean),
          gps_coordinates: gps ? { latitude: gps.latitude, longitude: gps.longitude } : null,
          phone: place.phone ?? null,
          website: place.website ?? null,
          hours: place.hours ?? null,
          operating_hours: operatingHours ? {
            open_state: operatingHours.open_state ?? null,
            hours: operatingHours.hours ?? null,
          } : null,
          service_options: place.service_options ?? {},
        },
      });
    }

    // Search action: nearby search
    const { lat, lng, category, radius } = body;
    if (!lat || !lng) {
      return json({ error: "lat and lng required" }, 400);
    }

    const query = CATEGORY_QUERIES[category] || category || "restaurants";
    const zoom = radius && radius > 5000 ? 12 : 14;
    const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&ll=@${lat},${lng},${zoom}z&type=search&api_key=${SERPAPI_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    const localResults = (data.local_results ?? []) as Record<string, unknown>[];
    const results = localResults.map((r: Record<string, unknown>, i: number) => {
      const gps = r.gps_coordinates as { latitude: number; longitude: number } | undefined;
      let distance_km: number | null = null;
      if (gps) {
        distance_km = haversine(lat, lng, gps.latitude, gps.longitude);
      }
      const operatingHours = r.operating_hours as Record<string, unknown> | undefined;
      return {
        id: (r.data_id as string) || (r.place_id as string) || `place-${i}`,
        data_id: r.data_id ?? null,
        name: r.title ?? "Unknown",
        category,
        address: r.address ?? "",
        distance_km,
        rating: r.rating ?? null,
        review_count: r.reviews ?? 0,
        image_url: r.thumbnail ?? null,
        price_level: parsePriceLevel(r.price as string | undefined),
        price: r.price ?? null,
        estimated_cost: null,
        opening_hours: r.hours ?? null,
        phone: r.phone ?? null,
        website: r.website ?? null,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
        type: r.type ?? "",
        open_state: operatingHours?.open_state ?? null,
        description: r.description ?? null,
      };
    });

    results.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));

    return json({ results, source: "serpapi_google_maps" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function toRad(deg: number): number { return (deg * Math.PI) / 180; }

function parsePriceLevel(price?: string): number | null {
  if (!price) return null;
  const count = (price.match(/\$/g) || []).length;
  return count > 0 ? count : null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
