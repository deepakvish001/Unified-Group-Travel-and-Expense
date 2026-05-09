const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discovery`;
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

export type AutocompleteSuggestion = {
  value: string;
  type?: string;
  subtext?: string;
  reference?: string;
  coordinates?: { latitude: number; longitude: number };
};

export type PlaceResult = {
  position: number;
  title: string;
  place_id?: string;
  data_id?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  price?: string;
  address?: string;
  description?: string;
  thumbnail?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  phone?: string;
  website?: string;
  hours?: string;
  service_options?: Record<string, boolean>;
};

export async function autocomplete(query: string, lat: number, lng: number, zoom = 12): Promise<AutocompleteSuggestion[]> {
  if (!query.trim()) return [];
  const res = await fetch(API_URL, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ action: 'autocomplete', query, lat, lng, zoom }),
  });
  const data = await res.json();
  return data.suggestions || [];
}

export async function nearby(query: string, lat: number, lng: number, zoom = 13): Promise<PlaceResult[]> {
  const res = await fetch(API_URL, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ action: 'nearby', query, lat, lng, zoom }),
  });
  const data = await res.json();
  return data.results || [];
}

export async function placeDetails(data_id: string): Promise<Record<string, unknown>> {
  const res = await fetch(API_URL, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ action: 'details', data_id }),
  });
  const data = await res.json();
  return data.place || {};
}
