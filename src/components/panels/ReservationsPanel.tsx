import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, Star, AlertCircle, Navigation, BookOpen, RefreshCw, ExternalLink, Phone, Globe, Clock, Navigation2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// --- Types ---
interface NearbyService {
  id: string;
  data_id: string | null;
  name: string;
  category: string;
  address: string;
  distance_km: number | null;
  rating: number | null;
  review_count: number;
  image_url: string | null;
  price_level: number | null;
  price: string | null;
  estimated_cost: number | null;
  opening_hours: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  type: string;
  open_state: string | null;
  description: string | null;
}

interface PlaceDetails {
  name: string;
  address: string;
  rating: number | null;
  reviews: number;
  type: string;
  types: string[];
  price: string | null;
  description: string | null;
  thumbnail: string | null;
  photos: string[];
  gps_coordinates: { latitude: number; longitude: number } | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  operating_hours: { open_state: string | null; hours: Record<string, string> | null } | null;
  service_options: Record<string, boolean>;
}

interface Props {
  tripId: string;
}

// --- Category Config ---
const CATEGORY_CONFIG = {
  car_rental:   { label: 'Car Rentals', icon: '🚗', query: 'car rental', color: 'from-blue-500 to-blue-600' },
  restaurant:   { label: 'Restaurants', icon: '🍽️', query: 'restaurants', color: 'from-red-500 to-orange-600' },
  hotel:        { label: 'Hotels', icon: '🏨', query: 'hotels', color: 'from-emerald-500 to-emerald-600' },
  cafe:         { label: 'Cafes', icon: '☕', query: 'cafes', color: 'from-amber-500 to-amber-600' },
  attraction:   { label: 'Attractions', icon: '🎭', query: 'tourist attractions', color: 'from-pink-500 to-rose-600' },
  emergency:    { label: 'Emergency', icon: '🚑', query: 'hospital emergency', color: 'from-red-600 to-red-700' },
  fuel_station: { label: 'Fuel', icon: '⛽', query: 'gas stations', color: 'from-yellow-500 to-yellow-600' },
} as const;

type CategoryKey = keyof typeof CATEGORY_CONFIG;

// --- Leaflet types ---
declare const L: {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (m: LMap) => unknown };
  layerGroup: () => LLayerGroup;
  marker: (coords: [number, number], opts?: Record<string, unknown>) => LMarker;
  circle: (coords: [number, number], opts: Record<string, unknown>) => { addTo: (m: LMap) => unknown };
  icon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (coords: [number, number][]) => LBounds;
};
type LMap = { setView: (c: [number, number], z: number) => LMap; fitBounds: (b: LBounds, o?: Record<string, unknown>) => void; invalidateSize: () => void };
type LMarker = { bindPopup: (s: string) => LMarker; on: (e: string, f: () => void) => LMarker; addTo: (g: LLayerGroup) => LMarker };
type LLayerGroup = { addTo: (m: LMap) => LLayerGroup; clearLayers: () => void; addLayer: (m: LMarker) => void };
type LBounds = unknown;

// --- API helper ---
const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nearby-services`;
const API_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

async function fetchNearbyServices(lat: number, lng: number, category: string): Promise<NearbyService[]> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ lat, lng, category }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.results || [];
}

async function fetchPlaceDetails(data_id: string): Promise<PlaceDetails | null> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ action: 'details', data_id }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.place || null;
}

// --- Haversine (client-side fallback) ---
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
function toRad(deg: number) { return (deg * Math.PI) / 180; }

// --- Open Google Maps navigation ---
function openNavigation(destLat: number, destLng: number, originLat?: number, originLng?: number) {
  const origin = originLat && originLng ? `&origin=${originLat},${originLng}` : '';
  const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${destLat},${destLng}&travelmode=driving`;
  window.open(url, '_blank');
}

// --- Main Component ---
export function ReservationsPanel({ tripId }: Props) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('restaurant');
  const [services, setServices] = useState<NearbyService[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance');
  const [selectedService, setSelectedService] = useState<NearbyService | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<LLayerGroup | null>(null);
  const watchRef = useRef<number | null>(null);

  // --- Geolocation ---
  const startLocation = useCallback(() => {
    setLocating(true);
    setLocationError(null);
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      (err) => {
        setLocationDenied(true);
        if (err.code === 1) {
          setLocationError('Location permission denied. Please enable location access in your browser settings.');
        } else if (err.code === 2) {
          setLocationError('Location unavailable. Please check your device settings.');
        } else {
          setLocationError('Location request timed out. Please try again.');
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Watch position for continuous updates
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  }, []);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // --- Fetch services ---
  const loadServices = useCallback(async (lat: number, lng: number, category: string) => {
    setLoading(true);
    setApiError(null);
    try {
      const results = await fetchNearbyServices(lat, lng, category);
      // Recalculate distances client-side for accuracy
      const enriched = results.map(r => ({
        ...r,
        distance_km: r.latitude && r.longitude
          ? haversine(lat, lng, r.latitude, r.longitude)
          : r.distance_km,
      }));
      setServices(enriched);
    } catch (err) {
      setApiError((err as Error).message);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on location or category change
  useEffect(() => {
    if (location) {
      loadServices(location.lat, location.lng, CATEGORY_CONFIG[selectedCategory].query);
    }
  }, [location, selectedCategory, loadServices]);

  // --- Initialize Leaflet map ---
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const tryInit = () => {
      if (typeof L === 'undefined') return false;
      if (!mapElRef.current || mapRef.current) return true;

      const center: [number, number] = location ? [location.lat, location.lng] : [20.5937, 78.9629];
      mapRef.current = L.map(mapElRef.current, { zoomControl: true }).setView(center, 14);
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
  }, [location]);

  // Update map center when location changes
  useEffect(() => {
    if (mapRef.current && location) {
      mapRef.current.setView([location.lat, location.lng], 14);
    }
  }, [location]);

  // Update markers when services change
  useEffect(() => {
    if (!markersRef.current || !mapReady) return;
    markersRef.current.clearLayers();

    // User location marker
    if (location) {
      L.circle([location.lat, location.lng], {
        radius: 200, color: '#0d9488', fillColor: '#0d9488', fillOpacity: 0.15, weight: 2,
      }).addTo(mapRef.current!);
    }

    // Service markers
    services.forEach(s => {
      if (!s.latitude || !s.longitude) return;
      const m = L.marker([s.latitude, s.longitude])
        .bindPopup(`<strong>${escapeHtml(s.name)}</strong><br/>${s.rating ? '★ ' + s.rating : ''}${s.distance_km ? ' · ' + s.distance_km + ' km' : ''}<br/>${s.address ? escapeHtml(s.address) : ''}`);
      m.on('click', () => setSelectedService(s));
      markersRef.current!.addLayer(m);
    });

    // Fit bounds to show all markers
    if (services.length && mapRef.current) {
      const valid = services.filter(s => s.latitude && s.longitude);
      if (valid.length) {
        const bounds = L.latLngBounds(valid.map(s => [s.latitude!, s.longitude!]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [services, mapReady, location]);

  // Focus map on selected service
  useEffect(() => {
    if (selectedService?.latitude && selectedService?.longitude && mapRef.current) {
      mapRef.current.setView([selectedService.latitude, selectedService.longitude], 16);
    }
  }, [selectedService]);

  // --- Sort ---
  const sortedServices = [...services].sort((a, b) => {
    if (sortBy === 'distance') return (a.distance_km ?? 999) - (b.distance_km ?? 999);
    if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    if (sortBy === 'price') {
      const pa = a.price_level ?? 99;
      const pb = b.price_level ?? 99;
      return pa - pb;
    }
    return 0;
  });

  const categoryConfig = CATEGORY_CONFIG[selectedCategory];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-bold text-teal-950">Nearby Services</h3>
          <p className="text-stone-500 text-sm mt-1">
            {location
              ? `Live results near ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
              : 'Discover and reserve nearby travel services'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {location && (
            <button
              onClick={() => loadServices(location.lat, location.lng, CATEGORY_CONFIG[selectedCategory].query)}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-stone-100 text-stone-700 px-3 py-2 rounded-full font-medium text-sm hover:bg-stone-200 transition disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={startLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 bg-teal-900 text-white px-4 py-2 rounded-full font-medium hover:bg-teal-800 transition disabled:opacity-60"
          >
            {locating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Locating...</>
            ) : location ? (
              <><Navigation className="w-4 h-4" /> Location Active</>
            ) : (
              <><MapPin className="w-4 h-4" /> Find My Location</>
            )}
          </button>
        </div>
      </div>

      {/* Location error */}
      {locationError && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-amber-900 text-sm">{locationError}</div>
            {locationDenied && (
              <p className="text-xs text-amber-700 mt-1">
                To enable: open your browser settings &rarr; Site settings &rarr; Location &rarr; Allow.
                Then click "Find My Location" again.
              </p>
            )}
            {!locationDenied && (
              <p className="text-xs text-amber-700 mt-1">Grant location permission for accurate nearby results.</p>
            )}
          </div>
        </div>
      )}

      {/* API error */}
      {apiError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-red-900 text-sm">Failed to load nearby services</div>
            <p className="text-xs text-red-700 mt-1">{apiError}</p>
            <button onClick={() => location && loadServices(location.lat, location.lng, CATEGORY_CONFIG[selectedCategory].query)} className="text-xs text-red-800 font-semibold mt-2 hover:underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Prompt to get location */}
      {!location && !locating && !locationError && (
        <div className="text-center py-16 bg-gradient-to-br from-teal-50 to-stone-50 rounded-2xl border border-dashed border-teal-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-900 flex items-center justify-center mb-4">
            <Navigation className="w-7 h-7 text-amber-300" />
          </div>
          <h4 className="font-display text-xl font-bold text-teal-950 mb-2">Enable your location</h4>
          <p className="text-stone-600 text-sm max-w-md mx-auto mb-6">
            We need your live location to discover real nearby services, calculate distances, and provide navigation.
          </p>
          <button
            onClick={startLocation}
            className="inline-flex items-center gap-2 bg-teal-900 text-white px-6 py-3 rounded-full font-medium hover:bg-teal-800 transition"
          >
            <MapPin className="w-4 h-4" /> Enable Location
          </button>
        </div>
      )}

      {location && (
        <>
          {/* Interactive Map */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div ref={mapElRef} className="w-full h-64 md:h-80" />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => { setSelectedCategory(key as CategoryKey); setSelectedService(null); }}
                className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition ${
                  selectedCategory === key
                    ? 'bg-teal-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-teal-300'
                }`}
              >
                <span>{config.icon}</span>
                {config.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600 font-medium">Sort by:</span>
            {(['distance', 'rating', 'price'] as const).map(option => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  sortBy === option
                    ? 'bg-teal-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {option === 'distance' && 'Nearest'}
                {option === 'rating' && 'Highest Rated'}
                {option === 'price' && 'Cheapest'}
              </button>
            ))}
            <span className="text-xs text-stone-400 ml-auto">{services.length} results</span>
          </div>

          {/* Services Grid */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white border border-stone-200 rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-40 bg-stone-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                    <div className="h-3 bg-stone-100 rounded w-1/2" />
                    <div className="h-3 bg-stone-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedServices.length === 0 ? (
            <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
              <MapPin className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="font-medium text-stone-600">No {categoryConfig.label.toLowerCase()} found nearby</p>
              <p className="text-xs text-stone-400 mt-1">Try a different category or refresh</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  isSelected={selectedService?.id === service.id}
                  userLocation={location}
                  onSelect={() => setSelectedService(selectedService?.id === service.id ? null : service)}
                />
              ))}
            </div>
          )}

          {/* Service Detail */}
          {selectedService && (
            <ServiceDetail
              service={selectedService}
              tripId={tripId}
              userLocation={location}
              onClose={() => setSelectedService(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// --- Service Card ---
function ServiceCard({
  service,
  isSelected,
  userLocation,
  onSelect,
}: {
  service: NearbyService;
  isSelected: boolean;
  userLocation: { lat: number; lng: number } | null;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`text-left group rounded-2xl overflow-hidden border-2 transition-all ${
        isSelected
          ? 'border-teal-600 shadow-lg scale-[1.02]'
          : 'border-stone-200 hover:border-teal-300 hover:shadow-md'
      }`}
    >
      <div className="relative h-40 overflow-hidden bg-stone-200">
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-300 to-stone-400">
            <span className="text-3xl opacity-50">{CATEGORY_CONFIG[service.category as CategoryKey]?.icon ?? '📍'}</span>
          </div>
        )}
        {/* Distance badge */}
        {service.distance_km !== null && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full">
            <span className="text-xs font-semibold text-stone-700">{service.distance_km} km</span>
          </div>
        )}
        {/* Open/closed badge */}
        {service.open_state && (
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            service.open_state === 'Open' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
          }`}>
            {service.open_state}
          </div>
        )}
      </div>

      <div className="p-3 bg-white">
        <h4 className="font-semibold text-teal-950 text-sm mb-1 line-clamp-1">{service.name}</h4>
        <p className="text-xs text-stone-500 mb-2 line-clamp-1">{service.address || service.type}</p>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {service.rating ? (
              <>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-semibold text-stone-700">{service.rating}</span>
                <span className="text-xs text-stone-400">({service.review_count})</span>
              </>
            ) : (
              <span className="text-xs text-stone-400">No ratings</span>
            )}
          </div>
          {service.price_level && (
            <span className="text-xs font-bold text-stone-600">{'$'.repeat(service.price_level)}</span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={e => { e.stopPropagation(); onSelect(); }}
            className="flex-1 py-2 bg-teal-900 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition"
          >
            Details
          </button>
          {service.latitude && service.longitude && userLocation && (
            <button
              onClick={e => { e.stopPropagation(); openNavigation(service.latitude!, service.longitude!, userLocation.lat, userLocation.lng); }}
              className="py-2 px-3 bg-stone-100 text-teal-900 text-xs font-semibold rounded-lg hover:bg-stone-200 transition flex items-center gap-1"
              title="Get directions"
            >
              <Navigation2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// --- Service Detail ---
function ServiceDetail({
  service,
  tripId,
  userLocation,
  onClose,
}: {
  service: NearbyService;
  tripId: string;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const [showReservation, setShowReservation] = useState(false);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (!service.data_id) return;
    let cancelled = false;
    setLoadingDetails(true);
    setDetailsError(null);
    fetchPlaceDetails(service.data_id)
      .then(d => { if (!cancelled) { setDetails(d); setLoadingDetails(false); } })
      .catch(e => { if (!cancelled) { setDetailsError(e.message); setLoadingDetails(false); } });
    return () => { cancelled = true; };
  }, [service.data_id]);

  // Merge list data with detail data (details take priority)
  const d = details;
  const name = d?.name || service.name;
  const address = d?.address || service.address;
  const rating = d?.rating || service.rating;
  const reviewCount = d?.reviews || service.review_count;
  const phone = d?.phone || service.phone;
  const website = d?.website || service.website;
  const description = d?.description || service.description;
  const hours = d?.hours || service.opening_hours;
  const openState = d?.operating_hours?.open_state || service.open_state;
  const price = d?.price || service.price;
  const photos = d?.photos?.length ? d.photos : (service.image_url ? [service.image_url] : []);
  const lat = d?.gps_coordinates?.latitude || service.latitude;
  const lng = d?.gps_coordinates?.longitude || service.longitude;
  const serviceOptions = d?.service_options || {};

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden animate-fade-in">
      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="relative h-48 md:h-56 overflow-hidden">
          <img src={photos[0]} alt={name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h4 className="font-display text-2xl font-bold text-white mb-1">{name}</h4>
            <p className="text-white/80 text-sm">{address || service.type}</p>
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-stone-600 hover:bg-white transition">
            &times;
          </button>
          {photos.length > 1 && (
            <div className="absolute bottom-4 right-4 flex gap-1.5">
              {photos.slice(1, 4).map((p, i) => (
                <img key={i} src={p} alt="" className="w-14 h-14 rounded-lg object-cover border-2 border-white/80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        {!photos.length && (
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-display text-xl font-bold text-teal-950">{name}</h4>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">&times;</button>
          </div>
        )}
        {!photos.length && <p className="text-stone-600 text-sm mb-4">{address || service.type}</p>}

        {/* Loading details indicator */}
        {loadingDetails && (
          <div className="flex items-center gap-2 py-3 text-sm text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading full details...
          </div>
        )}

        {detailsError && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4">
            Could not load full details. Showing basic information.
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-stone-700 leading-relaxed mb-4">{description}</p>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {rating && (
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400 mx-auto mb-1" />
              <div className="text-sm font-bold text-teal-950">{rating}</div>
              <div className="text-[10px] text-stone-500">{reviewCount} reviews</div>
            </div>
          )}
          {service.distance_km !== null && (
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <MapPin className="w-5 h-5 text-teal-700 mx-auto mb-1" />
              <div className="text-sm font-bold text-teal-950">{service.distance_km} km</div>
              <div className="text-[10px] text-stone-500">away</div>
            </div>
          )}
          {price && (
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <span className="text-lg font-bold text-teal-950 block">{price}</span>
              <div className="text-[10px] text-stone-500">price</div>
            </div>
          )}
          {openState && (
            <div className={`rounded-xl p-3 text-center ${openState === 'Open' ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <span className={`w-2 h-2 rounded-full inline-block mb-1 ${openState === 'Open' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div className={`text-sm font-bold ${openState === 'Open' ? 'text-emerald-800' : 'text-red-800'}`}>{openState}</div>
              <div className="text-[10px] text-stone-500">now</div>
            </div>
          )}
        </div>

        {/* Hours table from details */}
        {d?.operating_hours?.hours && typeof d.operating_hours.hours === 'object' && (
          <div className="mb-5">
            <h5 className="text-sm font-semibold text-teal-950 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-700" /> Operating Hours
            </h5>
            <div className="bg-stone-50 rounded-xl p-3 space-y-1.5">
              {Object.entries(d.operating_hours.hours).map(([day, time]) => (
                <div key={day} className="flex justify-between text-xs">
                  <span className="text-stone-600 font-medium capitalize">{day}</span>
                  <span className="text-stone-800">{time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service options from details */}
        {Object.keys(serviceOptions).length > 0 && (
          <div className="mb-5">
            <h5 className="text-sm font-semibold text-teal-950 mb-2">Service Options</h5>
            <div className="flex flex-wrap gap-2">
              {Object.entries(serviceOptions).filter(([, v]) => v).map(([key]) => (
                <span key={key} className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-medium border border-teal-200">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact details */}
        <div className="space-y-2 mb-5">
          {hours && !d?.operating_hours?.hours && (
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <Clock className="w-4 h-4 text-teal-700 flex-shrink-0" />
              <span>{hours}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <Phone className="w-4 h-4 text-teal-700 flex-shrink-0" />
              <a href={`tel:${phone}`} className="text-teal-700 hover:underline">{phone}</a>
            </div>
          )}
          {website && (
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <Globe className="w-4 h-4 text-teal-700 flex-shrink-0" />
              <a href={website} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline truncate">
                Visit Website
              </a>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {lat && lng && (
            <button
              onClick={() => openNavigation(lat!, lng!, userLocation?.lat, userLocation?.lng)}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-900 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-teal-800 transition"
            >
              <Navigation2 className="w-4 h-4" />
              Get Directions
            </button>
          )}
          {lat && lng && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-stone-100 text-teal-900 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-200 transition"
            >
              <ExternalLink className="w-4 h-4" />
              View on Maps
            </a>
          )}
          <button
            onClick={() => setShowReservation(!showReservation)}
            className="inline-flex items-center justify-center gap-2 bg-stone-100 text-teal-900 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-200 transition"
          >
            <BookOpen className="w-4 h-4" />
            {showReservation ? 'Cancel' : 'Reserve'}
          </button>
        </div>

        {showReservation && (
          <ReservationForm service={service} tripId={tripId} />
        )}
      </div>
    </div>
  );
}

// --- Reservation Form ---
function ReservationForm({ service, tripId }: { service: NearbyService; tripId: string }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ startDate: '', endDate: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    await supabase.from('service_reservations').insert({
      trip_id: tripId,
      service_id: service.id,
      user_id: user.id,
      category: service.category,
      reservation_type: 'standard',
      status: 'pending',
      start_date: formData.startDate,
      end_date: formData.endDate,
      notes: formData.notes || null,
      estimated_cost: service.estimated_cost,
      created_by: user.id,
    });
    setLoading(false);
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setFormData({ startDate: '', endDate: '', notes: '' }); }, 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 p-4 bg-white rounded-xl">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Start Date</label>
        <input
          type="datetime-local"
          required
          value={formData.startDate}
          onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">End Date</label>
        <input
          type="datetime-local"
          required
          value={formData.endDate}
          onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
        <textarea
          rows={2}
          value={formData.notes}
          onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
          placeholder="Any special requests?"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading || success}
        className="w-full py-2 bg-teal-900 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 transition disabled:opacity-60"
      >
        {success ? 'Reserved!' : loading ? 'Reserving...' : 'Confirm Reservation'}
      </button>
    </form>
  );
}

// --- Utility ---
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
