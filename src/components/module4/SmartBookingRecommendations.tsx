// ADDED: Smart Booking Recommendations - PRO Module 3
import { useEffect, useState } from 'react';
import { Star, Plus, Check, X, ExternalLink, Hotel, Plane, Utensils, Car, Ticket, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip } from '../../lib/types';

interface BookingRecommendation {
  id: string;
  trip_id: string;
  booking_type: 'hotel' | 'flight' | 'train' | 'bus' | 'activity' | 'car' | 'restaurant';
  title: string;
  description: string | null;
  estimated_cost: number;
  provider: string | null;
  rating: number | null;
  reasons: string[];
  pros: string[];
  cons: string[];
  external_url: string | null;
  status: 'suggested' | 'accepted' | 'rejected' | 'booked';
  created_at: string;
}

interface Props {
  tripId: string;
  trip: Trip;
}

const TYPE_META: Record<string, { icon: typeof Hotel; label: string; color: string }> = {
  hotel:      { icon: Hotel,     label: 'Hotel',      color: 'bg-blue-100 text-blue-800' },
  flight:     { icon: Plane,     label: 'Flight',     color: 'bg-sky-100 text-sky-800' },
  train:      { icon: Plane,     label: 'Train',      color: 'bg-indigo-100 text-indigo-800' },
  bus:        { icon: Car,       label: 'Bus',        color: 'bg-stone-100 text-stone-700' },
  activity:   { icon: Ticket,    label: 'Activity',   color: 'bg-teal-100 text-teal-800' },
  car:        { icon: Car,       label: 'Car Rental', color: 'bg-amber-100 text-amber-800' },
  restaurant: { icon: Utensils,  label: 'Restaurant', color: 'bg-rose-100 text-rose-800' },
};

const STATUS_META = {
  suggested: { label: 'Suggested', color: 'bg-stone-100 text-stone-600' },
  accepted:  { label: 'Accepted',  color: 'bg-teal-100 text-teal-700' },
  rejected:  { label: 'Skipped',   color: 'bg-red-50 text-red-600' },
  booked:    { label: 'Booked',    color: 'bg-teal-900 text-white' },
};

// Generate static demo recommendations based on trip data
function buildDemoRecommendations(trip: Trip): Omit<BookingRecommendation, 'id' | 'trip_id' | 'created_at'>[] {
  const dest = trip.destination || 'your destination';
  const budget = Number(trip.budget) || 50000;
  return [
    {
      booking_type: 'hotel',
      title: `Budget-Friendly Hotel in ${dest}`,
      description: `A well-rated hotel near the city centre, ideal for groups with good amenities and free breakfast.`,
      estimated_cost: Math.round(budget * 0.3),
      provider: 'MakeMyTrip / Booking.com',
      rating: 4.2,
      reasons: ['Within budget', 'Central location', 'Good group facilities'],
      pros: ['Free breakfast', 'Group rooms available', 'Easy cancellation'],
      cons: ['Book early — limited availability'],
      external_url: null,
      status: 'suggested',
    },
    {
      booking_type: 'activity',
      title: `Guided City Tour — ${dest}`,
      description: `A half-day guided tour covering the top landmarks. Group discounts available for 5+ people.`,
      estimated_cost: Math.round(budget * 0.08),
      provider: 'Viator / GetYourGuide',
      rating: 4.6,
      reasons: ['Group discount available', 'Popular attraction', 'Highly rated'],
      pros: ['Skip-the-line access', 'Expert guide', 'Flexible timing'],
      cons: ['Needs pre-booking'],
      external_url: null,
      status: 'suggested',
    },
    {
      booking_type: 'restaurant',
      title: `Local Cuisine Experience in ${dest}`,
      description: `A highly-rated local restaurant offering authentic regional dishes, perfect for the whole group.`,
      estimated_cost: Math.round(budget * 0.05),
      provider: 'Zomato / TripAdvisor',
      rating: 4.4,
      reasons: ['Authentic local food', 'Group-friendly seating', 'Budget-conscious'],
      pros: ['Large group seating', 'Vegetarian options', 'Good value'],
      cons: ['May need reservation on weekends'],
      external_url: null,
      status: 'suggested',
    },
  ];
}

export function SmartBookingRecommendations({ tripId, trip }: Props) {
  const { user } = useAuth();
  const [recs, setRecs] = useState<BookingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('booking_recommendations')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    setRecs((data ?? []) as BookingRecommendation[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);
    const demos = buildDemoRecommendations(trip);
    for (const d of demos) {
      await supabase.from('booking_recommendations').insert({ trip_id: tripId, generated_by: user.id, ...d });
    }
    await load();
    setGenerating(false);
  };

  const updateStatus = async (id: string, status: BookingRecommendation['status']) => {
    await supabase.from('booking_recommendations').update({ status }).eq('id', id);
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const filtered = filter === 'all' ? recs : recs.filter(r => r.booking_type === filter || r.status === filter);

  if (loading) return <div className="text-center py-8 text-stone-500 text-sm">Loading recommendations...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-teal-950">Smart Recommendations</h3>
          <p className="text-stone-500 text-sm mt-0.5">AI-curated booking suggestions for your trip</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition disabled:opacity-60">
          <Sparkles className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
          {generating ? 'Generating...' : recs.length > 0 ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {recs.length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <div className="font-medium text-stone-600">No recommendations yet</div>
          <p className="text-sm text-stone-400 mt-1">Generate smart booking suggestions based on your trip details</p>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['all', 'hotel', 'activity', 'restaurant', 'accepted', 'booked'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition capitalize
                  ${filter === f ? 'bg-teal-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-teal-300'}`}>
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map(rec => {
              const typeMeta = TYPE_META[rec.booking_type] ?? TYPE_META.activity;
              const TypeIcon = typeMeta.icon;
              const statusMeta = STATUS_META[rec.status];

              return (
                <div key={rec.id} className={`bg-white border rounded-2xl overflow-hidden transition ${rec.status === 'rejected' ? 'border-stone-100 opacity-60' : 'border-stone-200 hover:shadow-sm'}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeMeta.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-teal-950 text-sm">{rec.title}</h4>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-stone-500 mb-2">
                          {rec.rating && (
                            <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                              <Star className="w-3 h-3 fill-current" /> {rec.rating}
                            </span>
                          )}
                          <span className="font-medium text-teal-700">{trip.currency} {rec.estimated_cost.toLocaleString()}</span>
                          {rec.provider && <span>{rec.provider}</span>}
                        </div>
                        {rec.description && <p className="text-xs text-stone-600 leading-relaxed">{rec.description}</p>}

                        {rec.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {rec.reasons.map(r => (
                              <span key={r} className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {rec.status === 'suggested' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                        <button onClick={() => updateStatus(rec.id, 'accepted')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-600 transition">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => updateStatus(rec.id, 'booked')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-900 text-white rounded-lg text-xs font-medium hover:bg-teal-800 transition">
                          <Plus className="w-3.5 h-3.5" /> Mark Booked
                        </button>
                        {rec.external_url && (
                          <a href={rec.external_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg text-xs hover:border-teal-300 transition ml-auto">
                            <ExternalLink className="w-3.5 h-3.5" /> View
                          </a>
                        )}
                        <button onClick={() => updateStatus(rec.id, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-stone-400 hover:text-red-500 text-xs transition ml-auto">
                          <X className="w-3.5 h-3.5" /> Skip
                        </button>
                      </div>
                    )}

                    {(rec.status === 'accepted' || rec.status === 'booked') && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                        <button onClick={() => updateStatus(rec.id, 'suggested')}
                          className="text-xs text-stone-400 hover:text-stone-600 transition">
                          Undo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
