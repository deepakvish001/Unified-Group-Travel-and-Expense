import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") ?? "1ae22813b09ed031380bab50136592672725dc49b706c3003c0c861dc2753ce5";

type Body = {
  action: "autocomplete" | "nearby" | "details";
  query?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  place_id?: string;
  data_id?: string;
  category?: string;
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

    let url = "";
    if (action === "autocomplete") {
      const q = (body.query ?? "").trim();
      if (!q) return json({ suggestions: [] });
      const lat = body.lat ?? 20.5937;
      const lng = body.lng ?? 78.9629;
      const zoom = body.zoom ?? 10;
      url = `https://serpapi.com/search.json?engine=google_maps_autocomplete&q=${encodeURIComponent(q)}&ll=@${lat},${lng},${zoom}z&api_key=${SERPAPI_KEY}`;
    } else if (action === "nearby") {
      const q = (body.query ?? body.category ?? "hotels").trim();
      const lat = body.lat ?? 20.5937;
      const lng = body.lng ?? 78.9629;
      const zoom = body.zoom ?? 13;
      url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(q)}&ll=@${lat},${lng},${zoom}z&api_key=${SERPAPI_KEY}`;
    } else if (action === "details") {
      const id = body.data_id || body.place_id;
      if (!id) return json({ error: "place_id or data_id required" }, 400);
      url = `https://serpapi.com/search.json?engine=google_maps&data_id=${encodeURIComponent(id)}&api_key=${SERPAPI_KEY}`;
    } else {
      return json({ error: "Unknown action" }, 400);
    }

    const res = await fetch(url);
    const data = await res.json();

    if (action === "autocomplete") {
      const suggestions = (data.suggestions ?? []).map((s: Record<string, unknown>) => ({
        value: s.value,
        type: s.type,
        subtext: s.subtext,
        reference: s.reference,
        coordinates: s.coordinates,
      }));
      return json({ suggestions });
    }

    if (action === "nearby") {
      const localResults: Record<string, unknown>[] = (data.local_results ?? data.place_results ? [data.place_results] : []) as Record<string, unknown>[];
      const results = (data.local_results ?? localResults ?? []).map((r: Record<string, unknown>) => ({
        position: r.position,
        title: r.title,
        place_id: r.place_id,
        data_id: r.data_id,
        rating: r.rating,
        reviews: r.reviews,
        type: r.type,
        types: r.types,
        price: r.price,
        address: r.address,
        description: r.description,
        thumbnail: r.thumbnail,
        gps_coordinates: r.gps_coordinates,
        phone: r.phone,
        website: r.website,
        hours: r.hours,
        service_options: r.service_options,
      }));
      return json({ results, search_information: data.search_information });
    }

    return json({ place: data.place_results ?? data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
