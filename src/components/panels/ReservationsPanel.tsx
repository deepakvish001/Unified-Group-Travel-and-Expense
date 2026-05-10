// ADDED: Reservations & Nearby Services Panel
import { useState, useEffect } from 'react';
import { MapPin, Search, Loader2, MapPinIcon, Star, AlertCircle, Navigation, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NearbyService {
  id: string;
  name: string;
  category: 'car_rental' | 'restaurant' | 'hotel' | 'cafe' | 'attraction' | 'emergency' | 'fuel_station' | 'other';
  address: string;
  distance_km: number;
  rating: number | null;
  review_count: number;
  image_url: string | null;
  estimated_cost: number | null;
  opening_hours: Record<string, unknown>;
  price_level: number | null;
  availability: boolean;
  phone: string | null;
  website: string | null;
}

interface Props {
  tripId: string;
}

const CATEGORY_CONFIG = {
  car_rental:   { label: 'Car Rentals', icon: '🚗', color: 'from-blue-500 to-blue-600' },
  restaurant:   { label: 'Restaurants', icon: '🍽️', color: 'from-red-500 to-orange-600' },
  hotel:        { label: 'Hotels', icon: '🏨', color: 'from-purple-500 to-purple-600' },
  cafe:         { label: 'Cafes', icon: '☕', color: 'from-amber-500 to-amber-600' },
  attraction:   { label: 'Attractions', icon: '🎭', color: 'from-pink-500 to-rose-600' },
  emergency:    { label: 'Emergency', icon: '🚑', color: 'from-red-600 to-red-700' },
  fuel_station: { label: 'Fuel', icon: '⛽', color: 'from-yellow-500 to-yellow-600' },
  other:        { label: 'Other', icon: '📍', color: 'from-slate-500 to-slate-600' },
};

export function ReservationsPanel({ tripId }: Props) {
  const { user } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof CATEGORY_CONFIG>('restaurant');
  const [services, setServices] = useState<NearbyService[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance');
  const [selectedService, setSelectedService] = useState<NearbyService | null>(null);

  // Get user location
  const getLocation = () => {
    setLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocating(false);
        loadMockServices(latitude, longitude);
      },
      (error) => {
        setLocationError(error.message || 'Unable to access location');
        setLocating(false);
        // Fallback to default location (India)
        const defaultLat = 20.5937;
        const defaultLng = 78.9629;
        setLocation({ lat: defaultLat, lng: defaultLng });
        loadMockServices(defaultLat, defaultLng);
      },
      { timeout: 10000 }
    );
  };

  // Load mock nearby services (since real API requires key)
  const loadMockServices = (lat: number, lng: number) => {
    setLoading(true);

    const mockServices: Record<string, NearbyService[]> = {
      car_rental: [
        { id: '1', name: 'Drive Premium Rentals', category: 'car_rental', address: 'Central Station, 0.5 km away', distance_km: 0.5, rating: 4.8, review_count: 342, image_url: 'https://images.pexels.com/photos/3587620/pexels-photo-3587620.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 1200, opening_hours: {}, price_level: 3, availability: true, phone: '+91-98765-43210', website: 'https://example.com' },
        { id: '2', name: 'Budget Car Hire', category: 'car_rental', address: 'Downtown, 1.2 km away', distance_km: 1.2, rating: 4.3, review_count: 156, image_url: 'https://images.pexels.com/photos/97075/pexels-photo-97075.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 800, opening_hours: {}, price_level: 2, availability: true, phone: '+91-98765-43211', website: 'https://example.com' },
        { id: '3', name: 'Luxury Wheels', category: 'car_rental', address: 'Airport Terminal, 2.1 km away', distance_km: 2.1, rating: 4.6, review_count: 289, image_url: 'https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 2500, opening_hours: {}, price_level: 4, availability: true, phone: '+91-98765-43212', website: 'https://example.com' },
      ],
      restaurant: [
        { id: '4', name: 'Spice Route Café', category: 'restaurant', address: 'Main Street, 0.3 km away', distance_km: 0.3, rating: 4.7, review_count: 428, image_url: 'https://images.pexels.com/photos/1410235/pexels-photo-1410235.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 400, opening_hours: {}, price_level: 2, availability: true, phone: '+91-98765-43220', website: 'https://example.com' },
        { id: '5', name: 'The Grand Feast', category: 'restaurant', address: 'Market Square, 0.8 km away', distance_km: 0.8, rating: 4.5, review_count: 312, image_url: 'https://images.pexels.com/photos/1217394/pexels-photo-1217394.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 800, opening_hours: {}, price_level: 3, availability: true, phone: '+91-98765-43221', website: 'https://example.com' },
        { id: '6', name: 'Michelin Modern', category: 'restaurant', address: 'Downtown Elite Zone, 1.5 km away', distance_km: 1.5, rating: 4.9, review_count: 567, image_url: 'https://images.pexels.com/photos/262047/pexels-photo-262047.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 1500, opening_hours: {}, price_level: 4, availability: true, phone: '+91-98765-43222', website: 'https://example.com' },
      ],
      hotel: [
        { id: '7', name: 'Comfort Inn City', category: 'hotel', address: 'Business District, 0.7 km away', distance_km: 0.7, rating: 4.4, review_count: 189, image_url: 'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 3500, opening_hours: {}, price_level: 2, availability: true, phone: '+91-98765-43230', website: 'https://example.com' },
        { id: '8', name: 'Luxury Towers', category: 'hotel', address: 'Premium Zone, 2.0 km away', distance_km: 2.0, rating: 4.8, review_count: 523, image_url: 'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 8000, opening_hours: {}, price_level: 4, availability: true, phone: '+91-98765-43231', website: 'https://example.com' },
      ],
      cafe: [
        { id: '9', name: 'Brew & Bliss', category: 'cafe', address: 'Corner Cafe Lane, 0.2 km away', distance_km: 0.2, rating: 4.6, review_count: 234, image_url: 'https://images.pexels.com/photos/1987317/pexels-photo-1987317.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 150, opening_hours: {}, price_level: 2, availability: true, phone: '+91-98765-43240', website: 'https://example.com' },
      ],
      attraction: [
        { id: '10', name: 'Ancient Monument', category: 'attraction', address: 'Heritage Zone, 1.8 km away', distance_km: 1.8, rating: 4.9, review_count: 1203, image_url: 'https://images.pexels.com/photos/3707582/pexels-photo-3707582.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 200, opening_hours: {}, price_level: 1, availability: true, phone: '+91-98765-43250', website: 'https://example.com' },
      ],
      fuel_station: [
        { id: '11', name: 'Premium Fuel Hub', category: 'fuel_station', address: 'Highway Junction, 0.9 km away', distance_km: 0.9, rating: 4.2, review_count: 156, image_url: 'https://images.pexels.com/photos/4553618/pexels-photo-4553618.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 0, opening_hours: {}, price_level: 1, availability: true, phone: '+91-98765-43260', website: 'https://example.com' },
      ],
      emergency: [
        { id: '12', name: 'Emergency Response Center', category: 'emergency', address: 'Medical District, 0.6 km away', distance_km: 0.6, rating: 4.9, review_count: 847, image_url: 'https://images.pexels.com/photos/4238521/pexels-photo-4238521.jpeg?auto=compress&cs=tinysrgb&w=400', estimated_cost: 0, opening_hours: {}, price_level: 0, availability: true, phone: '102', website: 'https://example.com' },
      ],
    };

    setTimeout(() => {
      setServices(mockServices[selectedCategory] || []);
      setLoading(false);
    }, 800);
  };

  // Handle category change
  useEffect(() => {
    if (location) {
      loadMockServices(location.lat, location.lng);
    }
  }, [selectedCategory]);

  // Sort services
  const sortedServices = [...services].sort((a, b) => {
    if (sortBy === 'distance') return a.distance_km - b.distance_km;
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'price') return (a.estimated_cost || 0) - (b.estimated_cost || 0);
    return 0;
  });

  const categoryConfig = CATEGORY_CONFIG[selectedCategory];

  return (
    <div className="space-y-6">
      {/* Location & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-bold text-teal-950">Nearby Services</h3>
          <p className="text-stone-500 text-sm mt-1">Discover and reserve nearby travel services</p>
        </div>
        <button
          onClick={getLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 bg-teal-900 text-white px-4 py-2 rounded-full font-medium hover:bg-teal-800 transition disabled:opacity-60"
        >
          {locating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Locating...
            </>
          ) : location ? (
            <>
              <Navigation className="w-4 h-4" />
              Location Set
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              Find My Location
            </>
          )}
        </button>
      </div>

      {/* Location error alert */}
      {locationError && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-amber-900 text-sm">{locationError}</div>
            <p className="text-xs text-amber-700 mt-0.5">Using default location for demo. Grant location permission for accurate results.</p>
          </div>
        </div>
      )}

      {location && (
        <>
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as keyof typeof CATEGORY_CONFIG)}
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

          {/* Sort & Filter */}
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
                {option === 'distance' && '📍 Nearest'}
                {option === 'rating' && '⭐ Highest Rated'}
                {option === 'price' && '💰 Cheapest'}
              </button>
            ))}
          </div>

          {/* Services Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-900 mx-auto mb-3" />
                <p className="text-stone-500 text-sm">Discovering nearby {categoryConfig.label.toLowerCase()}...</p>
              </div>
            </div>
          ) : sortedServices.length === 0 ? (
            <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
              <MapPinIcon className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="font-medium text-stone-600">No {categoryConfig.label.toLowerCase()} found nearby</p>
              <p className="text-xs text-stone-400 mt-1">Try a different category or location</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  isSelected={selectedService?.id === service.id}
                  onSelect={() => setSelectedService(service)}
                />
              ))}
            </div>
          )}

          {/* Service Detail */}
          {selectedService && (
            <ServiceDetail service={selectedService} tripId={tripId} />
          )}
        </>
      )}
    </div>
  );
}

// Service Card Component
function ServiceCard({
  service,
  isSelected,
  onSelect,
}: {
  service: NearbyService;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const priceIndicator = service.price_level ? '₹'.repeat(service.price_level) : 'N/A';

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
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-300 to-stone-400">
            <span className="text-3xl opacity-50">📍</span>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full">
          <span className="text-xs font-semibold text-stone-700">{service.distance_km} km</span>
        </div>
      </div>

      <div className="p-3 bg-white">
        <h4 className="font-semibold text-teal-950 text-sm mb-1 line-clamp-1">{service.name}</h4>
        <p className="text-xs text-stone-500 mb-2 line-clamp-1">{service.address}</p>

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
          <span className="text-xs font-bold text-stone-600">{priceIndicator}</span>
        </div>

        {service.estimated_cost !== null && service.estimated_cost > 0 && (
          <div className="text-xs font-semibold text-teal-700 mb-2">
            ₹{service.estimated_cost.toLocaleString()} / day
          </div>
        )}

        <button
          onClick={e => {
            e.stopPropagation();
            onSelect();
          }}
          className="w-full py-2 bg-teal-900 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition"
        >
          {service.availability ? '✓ Available' : '✗ Unavailable'}
        </button>
      </div>
    </button>
  );
}

// Service Detail Component
function ServiceDetail({ service, tripId }: { service: NearbyService; tripId: string }) {
  const [showReservation, setShowReservation] = useState(false);

  return (
    <div className="bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-2xl p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-display text-xl font-bold text-teal-950 mb-2">{service.name}</h4>
          <p className="text-stone-600 text-sm mb-4">{service.address}</p>

          <div className="space-y-2">
            {service.rating && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm text-stone-700">
                  {service.rating} rating ({service.review_count} reviews)
                </span>
              </div>
            )}
            {service.phone && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-700">📞 {service.phone}</span>
              </div>
            )}
            {service.website && (
              <div className="flex items-center gap-2">
                <a
                  href={service.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-teal-700 hover:underline"
                >
                  🌐 Visit Website
                </a>
              </div>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowReservation(!showReservation)}
            className="w-full py-3 bg-gradient-to-r from-teal-900 to-teal-700 text-white font-semibold rounded-xl hover:from-teal-800 hover:to-teal-600 transition flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            {showReservation ? 'Cancel' : 'Reserve Now'}
          </button>

          {showReservation && (
            <ReservationForm service={service} tripId={tripId} />
          )}
        </div>
      </div>
    </div>
  );
}

// Reservation Form Component
function ReservationForm({ service, tripId }: { service: NearbyService; tripId: string }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    notes: '',
  });
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
        {success ? '✓ Reserved!' : loading ? 'Reserving...' : 'Confirm Reservation'}
      </button>
    </form>
  );
}
