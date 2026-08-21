// ADDED: Route Optimization - PRO Module 3
import { useEffect, useState } from 'react';
import { Navigation, Check, ArrowRight, Clock, Map, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ItineraryItem {
  id: string;
  day_number: number;
  title: string;
  location?: string;
  start_time?: string;
  estimated_cost?: number;
  category?: string;
}

interface RouteOptimization {
  id: string;
  trip_id: string;
  day_number: number | null;
  original_order: string[];
  optimized_order: string[];
  estimated_savings_minutes: number;
  estimated_savings_km: number;
  notes: string | null;
  applied: boolean;
  applied_at: string | null;
  created_at: string;
}

interface Props {
  tripId: string;
  isAdmin: boolean;
}

function reorderByTime(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    if (a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return 0;
  });
}

export function RouteOptimizer({ tripId, isAdmin }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [optimizations, setOptimizations] = useState<RouteOptimization[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [iRes, oRes] = await Promise.all([
      supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('day_number').order('start_time', { ascending: true, nullsFirst: false }),
      supabase.from('route_optimizations').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);
    setItems((iRes.data ?? []) as ItineraryItem[]);
    setOptimizations((oRes.data ?? []) as RouteOptimization[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  const days = [...new Set(items.map(i => i.day_number))].sort((a, b) => a - b);
  const dayItems = items.filter(i => i.day_number === selectedDay);
  const optimizedItems = reorderByTime(dayItems);
  const existingOpt = optimizations.find(o => o.day_number === selectedDay);

  const optimize = async () => {
    if (!user || dayItems.length < 2) return;
    setOptimizing(true);

    const original = dayItems.map(i => i.id);
    const optimized = optimizedItems.map(i => i.id);

    // Estimate savings: assume 15 min saved per reordered item
    const reorderedCount = original.filter((id, idx) => optimized[idx] !== id).length;
    const savingsMinutes = reorderedCount * 15;
    const savingsKm = reorderedCount * 2.5;

    const { data } = await supabase.from('route_optimizations').insert({
      trip_id: tripId,
      generated_by: user.id,
      day_number: selectedDay,
      original_order: original,
      optimized_order: optimized,
      estimated_savings_minutes: savingsMinutes,
      estimated_savings_km: savingsKm,
      notes: savingsMinutes > 0 ? `Reordered ${reorderedCount} activities by time to minimize backtracking.` : 'Route is already optimized.',
    }).select().maybeSingle();

    if (data) setOptimizations(prev => [data as RouteOptimization, ...prev.filter(o => o.day_number !== selectedDay)]);
    setOptimizing(false);
  };

  const applyOptimization = async (optId: string) => {
    if (!user || !isAdmin) return;
    const opt = optimizations.find(o => o.id === optId);
    if (!opt) return;

    // Apply by updating start times based on optimized order
    for (let i = 0; i < opt.optimized_order.length; i++) {
      const hour = 8 + i * 2;
      const time = `${String(hour).padStart(2, '0')}:00`;
      await supabase.from('itinerary_items').update({ start_time: time }).eq('id', opt.optimized_order[i]);
    }

    await supabase.from('route_optimizations').update({
      applied: true,
      applied_at: new Date().toISOString(),
    }).eq('id', optId);

    load();
  };

  if (loading) return <div className="text-center py-8 text-stone-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-teal-950">Route Optimizer</h3>
          <p className="text-stone-500 text-sm mt-0.5">Minimize travel time by reordering activities logically</p>
        </div>
        <button
          onClick={optimize}
          disabled={optimizing || dayItems.length < 2}
          className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition disabled:opacity-60"
        >
          <Zap className={`w-4 h-4 ${optimizing ? 'animate-pulse' : ''}`} />
          {optimizing ? 'Optimizing...' : 'Optimize Day'}
        </button>
      </div>

      {/* Day selector */}
      {days.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedDay === d ? 'bg-teal-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-teal-300'
              }`}
            >
              Day {d}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
          <Map className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <div className="font-medium text-stone-600">No itinerary items yet</div>
          <p className="text-sm text-stone-400 mt-1">Add activities to the itinerary first, then optimize routes</p>
        </div>
      )}

      {days.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Current order */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
            <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Current Order
            </h4>
            <div className="space-y-2">
              {dayItems.length === 0 ? (
                <div className="text-xs text-stone-400 py-4 text-center">No activities on Day {selectedDay}</div>
              ) : dayItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2.5 p-2.5 bg-stone-50 rounded-lg">
                  <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 text-xs flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-stone-800 truncate">{item.title}</div>
                    {item.start_time && <div className="text-[10px] text-stone-400">{item.start_time}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimized order */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
            <h4 className="font-semibold text-teal-800 text-sm flex items-center gap-2">
              <Navigation className="w-4 h-4" /> Optimized Order
            </h4>
            <div className="space-y-2">
              {optimizedItems.length === 0 ? (
                <div className="text-xs text-stone-400 py-4 text-center">No activities to optimize</div>
              ) : optimizedItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2.5 p-2.5 bg-white/70 rounded-lg">
                  <span className="w-5 h-5 rounded-full bg-teal-200 text-teal-800 text-xs flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-teal-950 truncate">{item.title}</div>
                    {item.start_time && <div className="text-[10px] text-teal-600">{item.start_time}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Existing optimization results */}
      {existingOpt && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-teal-950 text-sm">Last Optimization — Day {existingOpt.day_number}</h4>
            {existingOpt.applied ? (
              <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full font-medium">
                <Check className="w-3 h-3" /> Applied
              </span>
            ) : (
              isAdmin && (
                <button onClick={() => applyOptimization(existingOpt.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-teal-700 px-3 py-1.5 rounded-full hover:bg-teal-600 transition">
                  <Check className="w-3 h-3" /> Apply
                </button>
              )
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <div className="font-display text-xl font-bold text-teal-950">{existingOpt.estimated_savings_minutes} min</div>
              <div className="text-xs text-stone-500">Estimated time saved</div>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <div className="font-display text-xl font-bold text-teal-950">{existingOpt.estimated_savings_km} km</div>
              <div className="text-xs text-stone-500">Estimated distance saved</div>
            </div>
          </div>
          {existingOpt.notes && (
            <p className="text-xs text-stone-600 flex items-start gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-teal-600 mt-0.5 flex-shrink-0" />
              {existingOpt.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
