import { useState } from 'react';
import { Sparkles, Loader2, Plus, RefreshCw, Clock, DollarSign, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip } from '../../lib/types';

type Props = { trip: Trip; onActivityAdded: () => void };

type Activity = {
  title: string;
  description: string;
  duration: string;
  totalCost: number;
  costPerPerson: number;
  category: string;
  bestFor: string;
  reason: string;
  distance: string;
  tips: string;
};

const TIME_SLOTS = ['Morning (6AM-12PM)', 'Afternoon (12PM-5PM)', 'Evening (5PM-10PM)', 'Full Day'];
const CATEGORIES = ['All', 'adventure', 'relaxation', 'cultural', 'food', 'shopping', 'nightlife', 'nature'];

const CATEGORY_EMOJI: Record<string, string> = {
  adventure: '🏄', relaxation: '🌴', cultural: '🏛️', food: '🍽️',
  shopping: '🛍️', nightlife: '🎉', nature: '🌿', activity: '🎯', transport: '🚗',
};

export function ActivityRecommender({ trip, onActivityAdded }: Props) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [timeSlot, setTimeSlot] = useState('Afternoon (12PM-5PM)');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupSize] = useState(4);

  const budgetPerActivity = Math.round(Number(trip.budget) / Math.max(1, 10));

  const tripDays = trip.start_date && trip.end_date
    ? Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1)
    : 3;

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant/activity-recommendations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            destination: trip.destination,
            tripType: trip.category || 'Friends Trip',
            groupSize,
            budgetPerActivity,
            currency: trip.currency,
            timeOfDay: timeSlot,
          }),
        }
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setActivities(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  const addToItinerary = async (act: Activity, idx: number) => {
    if (!user) return;
    setAdding(idx);
    const timeMap: Record<string, string> = {
      'Morning (6AM-12PM)': '09:00',
      'Afternoon (12PM-5PM)': '14:00',
      'Evening (5PM-10PM)': '19:00',
      'Full Day': '09:00',
    };
    await supabase.from('itinerary_items').insert({
      trip_id: trip.id, day_number: selectedDay, title: act.title,
      notes: `${act.description}\n\nWhy: ${act.reason}\nTip: ${act.tips}`,
      location: act.distance, category: act.category === 'food' ? 'food' : act.category === 'transport' ? 'transport' : 'activity',
      start_time: timeMap[timeSlot] || '10:00', estimated_cost: act.totalCost,
      position: 99, created_by: user.id, status: 'planned', priority: 'medium',
    });
    await supabase.from('ai_activity_log').insert({
      trip_id: trip.id, performed_by: user.id,
      action: 'ActivityRecommended',
      summary: `Added AI-suggested activity: ${act.title} for Day ${selectedDay}`,
      details: { activity: act.title, day: selectedDay, cost: act.totalCost },
    });
    setAdding(null);
    onActivityAdded();
  };

  const filtered = categoryFilter === 'All' ? activities : activities.filter(a => a.category === categoryFilter);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Day</label>
            <div className="relative">
              <select className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white" value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))}>
                {Array.from({ length: tripDays }, (_, i) => <option key={i+1} value={i+1}>Day {i+1}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Time of Day</label>
            <div className="relative">
              <select className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 flex items-end">
            <button onClick={fetchRecommendations} disabled={loading || !trip.destination} className="w-full flex items-center justify-center gap-2 bg-teal-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-800 transition disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {activities.length > 0 ? 'Refresh' : 'Get Suggestions'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Users className="w-3.5 h-3.5" />{groupSize} people
          <span className="mx-1">·</span>
          <DollarSign className="w-3.5 h-3.5" />Budget/activity: {trip.currency} {budgetPerActivity.toLocaleString()}
          <span className="mx-1">·</span>
          <span className="font-medium text-teal-700">{trip.destination}</span>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {activities.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1 rounded-full text-xs font-medium border transition capitalize ${categoryFilter === c ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-400'}`}>
              {c !== 'All' && (CATEGORY_EMOJI[c] || '')} {c}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-700 mb-3" />
          <p className="text-sm text-stone-500">Finding the best activities for your group...</p>
        </div>
      )}

      {!loading && activities.length === 0 && (
        <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-900 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>
          <h3 className="font-semibold text-stone-700 mb-1">Get AI-Powered Suggestions</h3>
          <p className="text-sm text-stone-500 max-w-xs mx-auto">Click "Get Suggestions" to see activities tailored to your group, budget, and destination.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((act, idx) => (
          <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-5 hover:border-teal-300 hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{CATEGORY_EMOJI[act.category] || '🎯'}</span>
                  <h3 className="font-semibold text-stone-800">{act.title}</h3>
                  <span className="ml-auto text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full capitalize shrink-0">{act.category}</span>
                </div>
                <p className="text-sm text-stone-600 mb-3">{act.description}</p>
                <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{act.duration}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-teal-700"><DollarSign className="w-3 h-3" />{trip.currency} {act.totalCost?.toLocaleString()} ({trip.currency} {act.costPerPerson?.toLocaleString()}/person)</span>
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{act.bestFor}</span>
                </div>
                {act.reason && <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 italic">{act.reason}</div>}
                {act.tips && <div className="mt-1.5 text-xs text-stone-500">💡 {act.tips}</div>}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
              <span className="text-xs text-stone-400">{act.distance}</span>
              <button onClick={() => addToItinerary(act, idx)} disabled={adding === idx} className="inline-flex items-center gap-1.5 text-sm font-medium bg-teal-900 text-white px-4 py-2 rounded-xl hover:bg-teal-800 transition disabled:opacity-50">
                {adding === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add to Day {selectedDay}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <button onClick={fetchRecommendations} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-stone-300 rounded-2xl text-sm text-stone-500 hover:border-teal-400 hover:text-teal-700 transition">
          <RefreshCw className="w-4 h-4" /> Show different suggestions
        </button>
      )}
    </div>
  );
}
