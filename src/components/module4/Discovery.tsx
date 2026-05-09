import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, Star, Phone, ExternalLink, Loader2, Hotel, Utensils, Ticket, Navigation, Plus } from 'lucide-react';
import { autocomplete, nearby, type AutocompleteSuggestion, type PlaceResult } from '../../lib/discovery';

declare const L: {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: LMap) => unknown };
  layerGroup: () => LLayerGroup;
  marker: (coords: [number, number]) => LMarker;
  latLngBounds: (coords: [number, number][]) => LBounds;
};
type LMap = { setView: (c: [number, number], z: number) => LMap; fitBounds: (b: LBounds, o?: Record<string, unknown>) => void };
type LMarker = { bindPopup: (s: string) => LMarker; on: (e: string, f: () => void) => LMarker };
type LLayerGroup = { addTo: (m: LMap) => LLayerGroup; clearLayers: () => void; addLayer: (m: LMarker) => void };
type LBounds = unknown;

type Category = { key: string; label: string; query: string; icon: typeof Hotel };

const CATEGORIES: Category[] = [
  { key: 'hotels', label: 'Hotels', query: 'hotels', icon: Hotel },
  { key: 'restaurants', label: 'Restaurants', query: 'restaurants', icon: Utensils },
  { key: 'attractions', label: 'Attractions', query: 'top attractions', icon: Ticket },
  { key: 'cafes', label: 'Cafes', query: 'cafes', icon: Utensils },
];

type Props = {
  initialLocation?: string;
  onAddToBooking?: (place: PlaceResult) => void;
};

export function Discovery({ initialLocation = '', onAddToBooking }: Props) {
  const [center, setCenter] = useState<{ lat: number; lng: number; label: string }>({ lat: 20.5937, lng: 78.9629, label: initialLocation || 'India' });
  const [query, setQuery] = useState(initialLocation);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<LLayerGroup | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const tryInit = () => {
      if (typeof L === 'undefined') return false;
      if (!mapEl.current || mapRef.current) return true;
      mapRef.current = L.map(mapEl.current, { zoomControl: true }).setView([center.lat, center.lng], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
      setMapReady(true);
      return true;
    };
    if (!tryInit()) {
      const id = setInterval(() => { if (tryInit()) clearInterval(id); }, 200);
      return () => clearInterval(id);
    }
  }, []);

  useEffect(() => {
    if (mapRef.current && mapReady) mapRef.current.setView([center.lat, center.lng], 12);
  }, [center, mapReady]);

  useEffect(() => {
    if (!markersRef.current || !mapReady) return;
    markersRef.current.clearLayers();
    results.forEach(r => {
      if (!r.gps_coordinates) return;
      const m = L.marker([r.gps_coordinates.latitude, r.gps_coordinates.longitude])
        .bindPopup(`<strong>${escapeHtml(r.title)}</strong><br/>${r.rating ? '★ ' + r.rating : ''} ${r.price ? ' · ' + escapeHtml(r.price) : ''}<br/>${r.address ? escapeHtml(r.address) : ''}`);
      m.on('click', () => setSelected(r));
      markersRef.current!.addLayer(m);
    });
    if (results.length && mapRef.current) {
      const valid = results.filter(r => r.gps_coordinates);
      if (valid.length) {
        const bounds = L.latLngBounds(valid.map(r => [r.gps_coordinates!.latitude, r.gps_coordinates!.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [results, mapReady]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim() || query === center.label) { setSuggestions([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      const s = await autocomplete(query, center.lat, center.lng);
      setSuggestions(s);
    }, 350);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, center.lat, center.lng]);

  const pickLocation = (s: AutocompleteSuggestion) => {
    if (s.coordinates) {
      setCenter({ lat: s.coordinates.latitude, lng: s.coordinates.longitude, label: s.value });
    }
    setQuery(s.value);
    setShowSuggest(false);
    setSuggestions([]);
  };

  const runSearch = async () => {
    setLoading(true);
    try {
      const q = `${category.query} in ${center.label}`;
      const r = await nearby(q, center.lat, center.lng);
      setResults(r);
      setSelected(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (center.label && center.label !== 'India') runSearch();
  }, [center, category]);

  const mapHeight = useMemo(() => 'h-72 md:h-[420px]', []);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
              placeholder="Search a city or area (e.g. Goa, Manali, Kyoto)..."
              className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 focus:border-teal-700 focus:bg-white rounded-lg text-sm outline-none"
            />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-xl border border-stone-200 max-h-72 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button key={i} onMouseDown={() => pickLocation(s)} className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-start gap-2 text-sm border-b border-stone-100 last:border-0">
                    <MapPin className="w-4 h-4 text-teal-700 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-teal-950 font-medium truncate">{s.value}</div>
                      {s.subtext && <div className="text-xs text-stone-500 truncate">{s.subtext}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(c => {
              const Icon = c.icon; const active = c.key === category.key;
              return (
                <button key={c.key} onClick={() => setCategory(c)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition border ${active ? 'bg-teal-900 text-stone-50 border-teal-900' : 'bg-white border-stone-200 text-stone-700 hover:border-teal-300'}`}>
                  <Icon className="w-4 h-4" /> {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 text-xs text-stone-500 flex items-center gap-1"><Navigation className="w-3 h-3" /> Showing {results.length} {category.label.toLowerCase()} near {center.label}</div>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div ref={mapEl} className={`w-full ${mapHeight}`} />
        </div>
        <div className="md:col-span-2 space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-stone-500 p-4"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="text-sm text-stone-500 p-4 text-center border border-dashed border-stone-200 rounded-lg">Search a location above to discover places.</div>
          )}
          {results.map(r => (
            <button key={(r.data_id || r.place_id || r.title) + r.position} onClick={() => setSelected(r)} className={`w-full text-left bg-white border rounded-xl p-3 transition hover:shadow-sm ${selected?.data_id === r.data_id ? 'border-teal-700 ring-2 ring-teal-100' : 'border-stone-200'}`}>
              <div className="flex gap-3">
                {r.thumbnail && <img src={r.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-teal-950 truncate">{r.title}</div>
                  <div className="text-xs text-stone-500 truncate">{r.type}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                    {r.rating && <span className="inline-flex items-center gap-0.5 text-amber-700 font-semibold"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />{r.rating}{r.reviews && <span className="text-stone-500 font-normal">({r.reviews.toLocaleString()})</span>}</span>}
                    {r.price && <span className="text-teal-800 font-semibold">{r.price}</span>}
                  </div>
                  {r.address && <div className="text-[11px] text-stone-500 truncate mt-0.5">{r.address}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setSelected(null)}>
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {selected.thumbnail && <img src={selected.thumbnail} alt="" className="w-full h-48 object-cover md:rounded-t-2xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            <div className="p-5 space-y-3">
              <div>
                <h3 className="font-display text-xl font-bold text-teal-950">{selected.title}</h3>
                <div className="text-xs text-stone-500">{selected.type}</div>
              </div>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                {selected.rating && <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><Star className="w-4 h-4 fill-amber-500 text-amber-500" />{selected.rating} <span className="text-stone-500 font-normal">({selected.reviews?.toLocaleString() || 0} reviews)</span></span>}
                {selected.price && <span className="bg-teal-50 text-teal-800 border border-teal-200 rounded px-2 py-0.5 text-xs font-semibold">{selected.price}</span>}
              </div>
              {selected.description && <p className="text-sm text-stone-700">{selected.description}</p>}
              {selected.address && <div className="flex items-start gap-2 text-sm text-stone-700"><MapPin className="w-4 h-4 text-teal-700 mt-0.5" /><span>{selected.address}</span></div>}
              {selected.phone && <div className="flex items-center gap-2 text-sm text-stone-700"><Phone className="w-4 h-4 text-teal-700" /><a href={`tel:${selected.phone}`} className="hover:underline">{selected.phone}</a></div>}
              {selected.website && <a href={selected.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-teal-800 hover:underline"><ExternalLink className="w-4 h-4" /> Visit website</a>}
              <div className="flex gap-2 pt-2">
                {onAddToBooking && <button onClick={() => { onAddToBooking(selected); setSelected(null); }} className="flex-1 inline-flex items-center justify-center gap-1.5 bg-teal-900 text-stone-50 hover:bg-teal-800 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Add to booking</button>}
                {selected.gps_coordinates && <a href={`https://www.google.com/maps/search/?api=1&query=${selected.gps_coordinates.latitude},${selected.gps_coordinates.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-teal-900 px-4 py-2 rounded-lg text-sm font-medium"><ExternalLink className="w-4 h-4" /> Google Maps</a>}
              </div>
              <button onClick={() => setSelected(null)} className="w-full text-center text-sm text-stone-600 hover:text-teal-900 mt-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
