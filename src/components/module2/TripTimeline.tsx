import { useEffect, useState } from 'react';
import { Loader2, Activity, CheckCircle2, MessageSquare, Vote, ListChecks, MapPin, UserCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { TripActivityLog, Profile, ItineraryItem } from '../../lib/types';

const ICON_MAP: Record<string, typeof Activity> = {
  trip_created: MapPin,
  activity_created: MapPin,
  activity_updated: Activity,
  activity_deleted: Activity,
  activity_status: CheckCircle2,
  task_created: ListChecks,
  task_moved: ListChecks,
  task_deleted: ListChecks,
  poll_created: Vote,
  message: MessageSquare,
};

export function TripTimeline({ tripId }: { tripId: string }) {
  const [logs, setLogs] = useState<TripActivityLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: lg } = await supabase.from('trip_activity_logs').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(100);
    setLogs(lg ?? []);
    const { data: it } = await supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('day_number').order('start_time');
    setItems(it ?? []);
    const userIds = [...new Set((lg ?? []).map(l => l.actor_id))];
    if (userIds.length) {
      const { data: ps } = await supabase.from('profiles').select('*').in('id', userIds);
      setProfiles(Object.fromEntries((ps ?? []).map(p => [p.id, p])));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`m2-timeline:${tripId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_activity_logs', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itinerary_items', filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-teal-900" /></div>;

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(d).toLocaleDateString();
  };

  const itemsByDay = items.reduce<Record<number, ItineraryItem[]>>((acc, it) => {
    (acc[it.day_number] ??= []).push(it);
    return acc;
  }, {});
  const days = Object.keys(itemsByDay).map(Number).sort((a, b) => a - b);

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
      <section>
        <h2 className="font-display text-2xl font-bold text-teal-950 mb-1">Trip timeline</h2>
        <p className="text-stone-600 text-sm mb-5">Chronological flow of activities across days.</p>
        {days.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center text-stone-500 text-sm">
            Add activities to see them on the timeline.
          </div>
        ) : (
          <div className="space-y-6">
            {days.map(d => (
              <div key={d} className="relative pl-6 border-l-2 border-stone-200">
                <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-teal-900" />
                <div className="font-display text-sm font-bold text-amber-700 uppercase tracking-wider mb-2">Day {d}</div>
                <div className="space-y-2">
                  {itemsByDay[d].map(it => (
                    <div key={it.id} className="bg-white rounded-xl border border-stone-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-teal-950 text-sm truncate">{it.title}</div>
                          <div className="text-xs text-stone-500 flex flex-wrap gap-x-2">
                            {it.start_time && <span>{it.start_time}{it.end_time ? `–${it.end_time}` : ''}</span>}
                            {it.location && <span>· {it.location}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] font-medium capitalize px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">{it.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold text-teal-950 mb-1">Activity feed</h2>
        <p className="text-stone-600 text-sm mb-5">Live operational log of every change.</p>
        {logs.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center text-stone-500 text-sm">
            Activity will appear here as the group collaborates.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
            {logs.map(l => {
              const Icon = ICON_MAP[l.action_type] ?? Activity;
              const actor = profiles[l.actor_id];
              return (
                <div key={l.id} className="flex items-start gap-3 p-3 hover:bg-stone-50 transition">
                  <div className="w-8 h-8 rounded-full bg-teal-900 text-amber-300 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-teal-950">
                      <span className="font-semibold">{actor?.full_name || 'Someone'}</span>
                      <span className="text-stone-600"> · {l.description}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5 inline-flex items-center gap-1">
                      <UserCircle2 className="w-3 h-3" /> {timeAgo(l.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
