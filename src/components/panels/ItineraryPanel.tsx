import { useEffect, useState } from 'react';
import { Plus, Clock, MapPin, Trash2, Utensils, Car, Bed, Camera, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { ItineraryItem, ItineraryVote } from '../../lib/types';

const CAT_META: Record<string, { icon: typeof Camera; color: string }> = {
  activity: { icon: Camera, color: 'bg-teal-100 text-teal-900' },
  food: { icon: Utensils, color: 'bg-amber-100 text-amber-900' },
  transport: { icon: Car, color: 'bg-sky-100 text-sky-900' },
  rest: { icon: Bed, color: 'bg-stone-200 text-stone-700' },
};

export function ItineraryPanel({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [votes, setVotes] = useState<ItineraryVote[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', location: '', start_time: '', category: 'activity', notes: '' });

  const load = async () => {
    const { data } = await supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('day_number').order('position');
    setItems(data ?? []);
    const ids = (data ?? []).map(i => i.id);
    if (ids.length) {
      const { data: v } = await supabase.from('itinerary_votes').select('*').in('item_id', ids);
      setVotes(v ?? []);
    } else setVotes([]);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`itinerary:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itinerary_items', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itinerary_votes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const days = [...new Set([1, 2, 3, ...items.map(i => i.day_number)])].sort((a, b) => a - b);
  const byDay = (d: number) => items.filter(i => i.day_number === d);
  const voteStats = (id: string) => {
    const list = votes.filter(v => v.item_id === id);
    const up = list.filter(v => v.value > 0).length;
    const down = list.filter(v => v.value < 0).length;
    const mine = list.find(v => v.user_id === user?.id)?.value ?? 0;
    return { up, down, mine };
  };

  const add = async (day: number) => {
    if (!form.title.trim() || !user) return;
    await supabase.from('itinerary_items').insert({
      trip_id: tripId, day_number: day, ...form, created_by: user.id,
      position: byDay(day).length,
    });
    setForm({ title: '', location: '', start_time: '', category: 'activity', notes: '' });
    setAdding(null);
  };

  const remove = async (id: string) => {
    await supabase.from('itinerary_items').delete().eq('id', id);
  };

  const vote = async (itemId: string, value: number) => {
    if (!user) return;
    const existing = votes.find(v => v.item_id === itemId && v.user_id === user.id);
    if (existing && existing.value === value) {
      await supabase.from('itinerary_votes').delete().eq('id', existing.id);
    } else if (existing) {
      await supabase.from('itinerary_votes').update({ value }).eq('id', existing.id);
    } else {
      await supabase.from('itinerary_votes').insert({ item_id: itemId, user_id: user.id, value });
    }
  };

  const move = async (item: ItineraryItem, dir: -1 | 1) => {
    const sibs = byDay(item.day_number);
    const idx = sibs.findIndex(s => s.id === item.id);
    const swap = sibs[idx + dir];
    if (!swap) return;
    await supabase.from('itinerary_items').update({ position: swap.position }).eq('id', item.id);
    await supabase.from('itinerary_items').update({ position: item.position }).eq('id', swap.id);
  };

  const addDay = () => {
    const max = Math.max(0, ...items.map(i => i.day_number));
    setAdding(max + 1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Itinerary</h2>
          <p className="text-stone-600 text-sm">Day-by-day plan for your group. Vote on what stays.</p>
        </div>
        <button onClick={addDay} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
          <Plus className="w-4 h-4" /> Add day
        </button>
      </div>

      {days.map((d) => {
        const dayItems = byDay(d);
        return (
          <div key={d} className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-900 text-stone-50 flex flex-col items-center justify-center">
                <div className="text-[10px] uppercase tracking-wider text-amber-300">Day</div>
                <div className="font-display text-xl font-bold">{d}</div>
              </div>
              <div className="flex-1 h-px bg-stone-200" />
              <button onClick={() => setAdding(d)} className="text-sm text-teal-900 font-medium hover:underline">+ Add item</button>
            </div>

            <div className="space-y-2 ml-4 pl-14 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-stone-200" />
              {dayItems.length === 0 && adding !== d && (
                <div className="text-sm text-stone-500 italic py-2">No items yet.</div>
              )}
              {dayItems.map((it, idx) => {
                const meta = CAT_META[it.category] ?? CAT_META.activity;
                const Icon = meta.icon;
                const v = voteStats(it.id);
                return (
                  <div key={it.id} className="group flex gap-3 items-start bg-white rounded-xl border border-stone-200 p-4 hover:border-teal-800 transition">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                        <h4 className="font-semibold text-teal-950">{it.title}</h4>
                        {it.start_time && <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Clock className="w-3 h-3" />{it.start_time}</span>}
                        {it.location && <span className="inline-flex items-center gap-1 text-xs text-stone-500"><MapPin className="w-3 h-3" />{it.location}</span>}
                      </div>
                      {it.notes && <p className="text-sm text-stone-600 mt-1">{it.notes}</p>}
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => vote(it.id, 1)} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition ${v.mine === 1 ? 'bg-teal-900 text-amber-300' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                          <ThumbsUp className="w-3 h-3" /> {v.up}
                        </button>
                        <button onClick={() => vote(it.id, -1)} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition ${v.mine === -1 ? 'bg-red-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                          <ThumbsDown className="w-3 h-3" /> {v.down}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => move(it, -1)} disabled={idx === 0} className="text-stone-400 hover:text-teal-900 disabled:opacity-30 text-xs px-1">up</button>
                      <button onClick={() => move(it, 1)} disabled={idx === dayItems.length - 1} className="text-stone-400 hover:text-teal-900 disabled:opacity-30 text-xs px-1">down</button>
                    </div>
                    <button onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 transition p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {adding === d && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3 animate-fade-in">
                  <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Activity title" className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} placeholder="e.g. 09:30" className="px-3 py-2 border border-stone-300 rounded-lg bg-white" />
                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="px-3 py-2 border border-stone-300 rounded-lg bg-white" />
                  </div>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
                    <option value="activity">Activity</option>
                    <option value="food">Food</option>
                    <option value="transport">Transport</option>
                    <option value="rest">Rest</option>
                  </select>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setAdding(null)} className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-200 rounded-lg">Cancel</button>
                    <button onClick={() => add(d)} className="px-3 py-1.5 text-sm bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800">Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
