// ADDED: Saved Reservations - View saved and recent reservations
import { useEffect, useState } from 'react';
import { Heart, Calendar, MapPin, Clock, Loader2, BookmarkX, Trash2, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SavedService {
  id: string;
  service: {
    id: string;
    name: string;
    category: string;
    distance_km: number;
    rating: number | null;
    address: string;
    image_url: string | null;
    estimated_cost: number | null;
  };
  saved_at: string;
}

interface Reservation {
  id: string;
  service_id: string;
  category: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  estimated_cost: number | null;
  total_cost: number | null;
  confirmation_number: string | null;
  notes: string | null;
  created_at: string;
  service?: {
    name: string;
    address: string;
    image_url: string | null;
  };
}

interface Props {
  tripId: string;
}

const STATUS_COLORS = {
  pending:    'bg-amber-100 text-amber-800 border-amber-200',
  confirmed:  'bg-teal-100 text-teal-800 border-teal-200',
  completed:  'bg-green-100 text-green-800 border-green-200',
  cancelled:  'bg-red-100 text-red-800 border-red-200',
};

const CATEGORY_ICONS = {
  car_rental:   '🚗',
  restaurant:   '🍽️',
  hotel:        '🏨',
  cafe:         '☕',
  attraction:   '🎭',
  emergency:    '🚑',
  fuel_station: '⛽',
  other:        '📍',
};

export function SavedReservations({ tripId }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'saved' | 'reservations'>('saved');
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Load saved services
    const { data: saved } = await supabase
      .from('saved_services')
      .select(`
        id,
        saved_at,
        nearby_services (
          id,
          name,
          category,
          distance_km,
          rating,
          address,
          image_url,
          estimated_cost
        )
      `)
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    setSavedServices((saved ?? []).map(s => ({
      id: s.id,
      service: s.nearby_services as any,
      saved_at: s.saved_at,
    })));

    // Load reservations
    const { data: res } = await supabase
      .from('service_reservations')
      .select(`
        *,
        nearby_services (
          name,
          address,
          image_url
        )
      `)
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setReservations((res ?? []).map(r => ({
      ...r,
      service: r.nearby_services,
    })) as Reservation[]);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tripId, user?.id]);

  const unsave = async (id: string) => {
    await supabase.from('saved_services').delete().eq('id', id);
    load();
  };

  const cancelReservation = async (id: string) => {
    await supabase.from('service_reservations').update({ status: 'cancelled' }).eq('id', id);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-900 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Loading your reservations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-display text-2xl font-bold text-teal-950">My Reservations</h3>
        <p className="text-stone-500 text-sm mt-1">View and manage your saved services and bookings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {['saved', 'reservations'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition ${
              tab === t
                ? 'bg-teal-900 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-teal-300'
            }`}
          >
            {t === 'saved' && <Heart className="w-4 h-4" />}
            {t === 'reservations' && <Calendar className="w-4 h-4" />}
            {t === 'saved' ? `Saved (${savedServices.length})` : `Reservations (${reservations.length})`}
          </button>
        ))}
      </div>

      {/* Saved Services */}
      {tab === 'saved' &&
        (savedServices.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <Heart className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="font-medium text-stone-600">No saved services yet</p>
            <p className="text-xs text-stone-400 mt-1">Save services to access them quickly later</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedServices.map(item => (
              <div
                key={item.id}
                className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition group"
              >
                <div className="relative h-40 overflow-hidden bg-stone-200">
                  {item.service.image_url ? (
                    <img
                      src={item.service.image_url}
                      alt={item.service.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-300 to-stone-400">
                      <span className="text-3xl">
                        {CATEGORY_ICONS[item.service.category as keyof typeof CATEGORY_ICONS] || '📍'}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button className="p-2 bg-white rounded-full hover:bg-red-50 transition">
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="font-semibold text-teal-950 line-clamp-1">{item.service.name}</h4>
                  <p className="text-xs text-stone-500 mt-1 flex items-center gap-1 line-clamp-1">
                    <MapPin className="w-3 h-3" />
                    {item.service.distance_km} km away
                  </p>

                  <div className="flex items-center justify-between mt-3 mb-3">
                    {item.service.rating && (
                      <div className="flex items-center gap-1">
                        <span className="text-amber-400">⭐</span>
                        <span className="text-xs font-semibold text-stone-700">{item.service.rating}</span>
                      </div>
                    )}
                    {item.service.estimated_cost && (
                      <span className="text-xs font-bold text-teal-700">
                        ₹{item.service.estimated_cost.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 bg-teal-900 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition">
                      Reserve
                    </button>
                    <button
                      onClick={() => unsave(item.id)}
                      className="p-2 text-stone-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Reservations */}
      {tab === 'reservations' &&
        (reservations.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <BookmarkX className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="font-medium text-stone-600">No reservations yet</p>
            <p className="text-xs text-stone-400 mt-1">Book a service to see your reservations here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map(res => (
              <div
                key={res.id}
                className="bg-white border border-stone-200 rounded-2xl p-4 hover:shadow-md transition"
              >
                <div className="flex gap-4 items-start">
                  {res.service?.image_url && (
                    <img
                      src={res.service.image_url}
                      alt={res.service?.name}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-semibold text-teal-950 text-sm">{res.service?.name}</h4>
                        <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {res.service?.address}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                          STATUS_COLORS[res.status]
                        }`}
                      >
                        {res.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-stone-600 mt-3">
                      {res.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(res.start_date).toLocaleDateString()}
                        </span>
                      )}
                      {res.confirmation_number && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Ref: {res.confirmation_number}
                        </span>
                      )}
                      {res.total_cost && (
                        <span className="font-bold text-teal-700">
                          ₹{res.total_cost.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button className="text-xs font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        Share
                      </button>
                      {res.status !== 'cancelled' && res.status !== 'completed' && (
                        <button
                          onClick={() => cancelReservation(res.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-800 ml-auto"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
