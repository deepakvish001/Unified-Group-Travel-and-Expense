import { useEffect, useState } from 'react';
import { Plus, Clock, MapPin, Trash2, Utensils, Car, Bed, Camera, X, Loader2, AlertTriangle, CheckCircle2, Circle, CircleDot, XCircle, Timer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { ItineraryItem, TripMember, Profile, ActivityStatus, Priority } from '../../lib/types';

type MemberRow = TripMember & { profile: Profile };

const CAT_META: Record<string, { icon: typeof Camera; color: string }> = {
  activity: { icon: Camera, color: 'bg-teal-100 text-teal-900' },
  food: { icon: Utensils, color: 'bg-amber-100 text-amber-900' },
  transport: { icon: Car, color: 'bg-sky-100 text-sky-900' },
  rest: { icon: Bed, color: 'bg-stone-200 text-stone-700' },
};

const STATUS_META: Record<ActivityStatus, { label: string; icon: typeof CircleDot; color: string }> = {
  planned: { label: 'Planned', icon: Circle, color: 'bg-stone-100 text-stone-700' },
  confirmed: { label: 'Confirmed', icon: CircleDot, color: 'bg-sky-100 text-sky-800' },
  ongoing: { label: 'Ongoing', icon: Timer, color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800' },
  delayed: { label: 'Delayed', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-stone-100 text-stone-600' },
  medium: { label: 'Medium', color: 'bg-sky-100 text-sky-800' },
  high: { label: 'High', color: 'bg-amber-100 text-amber-800' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
};

export function DayItinerary({ tripId, members, currency }: { tripId: string; members: MemberRow[]; currency: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [addingDay, setAddingDay] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('day_number').order('position');
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`m2-itinerary:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itinerary_items', filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const days = [...new Set([1, 2, 3, ...items.map(i => i.day_number)])].sort((a, b) => a - b);
  const byDay = (d: number) => items.filter(i => i.day_number === d);

  const remove = async (id: string) => {
    if (!user) return;
    const item = items.find(i => i.id === id);
    await supabase.from('itinerary_items').delete().eq('id', id);
    if (item) {
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id, action_type: 'activity_deleted',
        description: `Removed "${item.title}" from Day ${item.day_number}`,
        related_entity_type: 'itinerary_item', related_entity_id: id,
      });
    }
  };

  const quickStatus = async (item: ItineraryItem, status: ActivityStatus) => {
    if (!user) return;
    await supabase.from('itinerary_items').update({ status, last_edited_by: user.id, updated_at: new Date().toISOString() }).eq('id', item.id);
    await supabase.from('trip_activity_logs').insert({
      trip_id: tripId, actor_id: user.id, action_type: 'activity_status',
      description: `Marked "${item.title}" as ${STATUS_META[status].label}`,
      related_entity_type: 'itinerary_item', related_entity_id: item.id,
    });
  };

  const memberName = (id: string | null) => id ? (members.find(m => m.user_id === id)?.profile.full_name || 'Member') : null;

  const addDay = () => {
    const max = Math.max(0, ...items.map(i => i.day_number));
    setAddingDay(max + 1);
    setEditing({
      id: '', trip_id: tripId, day_number: max + 1, start_time: '', end_time: '', duration_minutes: 0,
      title: '', location: '', notes: '', category: 'activity', status: 'planned', priority: 'medium',
      assigned_to: null, estimated_cost: 0, actual_cost: 0, created_by: user?.id ?? null, last_edited_by: null,
      position: 0, created_at: '',
    });
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-teal-900" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Day-by-day itinerary</h2>
          <p className="text-stone-600 text-sm">Plan activities, assign coordinators, track progress in real time.</p>
        </div>
        <button onClick={addDay} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
          <Plus className="w-4 h-4" /> Add day
        </button>
      </div>

      {days.map((d) => {
        const dayItems = byDay(d);
        const totalEst = dayItems.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
        return (
          <div key={d}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-900 text-stone-50 flex flex-col items-center justify-center">
                <div className="text-[10px] uppercase tracking-wider text-amber-300">Day</div>
                <div className="font-display text-xl font-bold">{d}</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-stone-200" />
                  <div className="text-xs text-stone-500">{dayItems.length} activities · est. {currency} {totalEst.toLocaleString()}</div>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>
              </div>
              <button onClick={() => { setAddingDay(d); setEditing({
                id: '', trip_id: tripId, day_number: d, start_time: '', end_time: '', duration_minutes: 0,
                title: '', location: '', notes: '', category: 'activity', status: 'planned', priority: 'medium',
                assigned_to: null, estimated_cost: 0, actual_cost: 0, created_by: user?.id ?? null, last_edited_by: null,
                position: dayItems.length, created_at: '',
              }); }} className="text-sm text-teal-900 font-medium hover:underline">+ Add activity</button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {dayItems.length === 0 && (
                <div className="md:col-span-2 text-sm text-stone-500 italic py-6 text-center bg-white rounded-xl border border-dashed border-stone-300">No activities planned for this day.</div>
              )}
              {dayItems.map((it) => {
                const meta = CAT_META[it.category] ?? CAT_META.activity;
                const Icon = meta.icon;
                const st = STATUS_META[it.status] ?? STATUS_META.planned;
                const StatusIcon = st.icon;
                const pr = PRIORITY_META[it.priority] ?? PRIORITY_META.medium;
                return (
                  <div key={it.id} className="group bg-white rounded-xl border border-stone-200 p-4 hover:border-teal-800 hover:shadow-md transition">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-teal-950 truncate">{it.title}</h4>
                          <button onClick={() => remove(it.id)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 transition p-1 -mt-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                          {it.start_time && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{it.start_time}{it.end_time ? `–${it.end_time}` : ''}</span>}
                          {it.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{it.location}</span>}
                        </div>
                        {it.notes && <p className="text-xs text-stone-600 mt-1.5 line-clamp-2">{it.notes}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                            <StatusIcon className="w-3 h-3" />{st.label}
                          </span>
                          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${pr.color}`}>
                            {pr.label}
                          </span>
                          {it.assigned_to && <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-900">{memberName(it.assigned_to)}</span>}
                          {Number(it.estimated_cost) > 0 && <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{currency} {Number(it.estimated_cost).toLocaleString()}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(['confirmed', 'ongoing', 'completed', 'delayed'] as ActivityStatus[]).filter(s => s !== it.status).map(s => (
                            <button key={s} onClick={() => quickStatus(it, s)} className="text-[10px] px-2 py-0.5 rounded-full border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-teal-900 transition">
                              {STATUS_META[s].label}
                            </button>
                          ))}
                          <button onClick={() => setEditing(it)} className="text-[10px] px-2 py-0.5 rounded-full border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-teal-900 transition">Edit</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {editing && (
        <ActivityModal
          tripId={tripId}
          item={editing}
          members={members}
          currency={currency}
          onClose={() => { setEditing(null); setAddingDay(null); }}
          onSaved={() => { setEditing(null); setAddingDay(null); load(); }}
          isNew={!editing.id || addingDay !== null}
        />
      )}
    </div>
  );
}

function ActivityModal({ tripId, item, members, currency, onClose, onSaved, isNew }: {
  tripId: string; item: ItineraryItem; members: MemberRow[]; currency: string;
  onClose: () => void; onSaved: () => void; isNew: boolean;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState(item);
  const [loading, setLoading] = useState(false);

  const update = (k: keyof ItineraryItem, v: unknown) => setForm(f => ({ ...f, [k]: v } as ItineraryItem));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setLoading(true);
    if (isNew) {
      const { data } = await supabase.from('itinerary_items').insert({
        trip_id: tripId, day_number: form.day_number, start_time: form.start_time, end_time: form.end_time,
        duration_minutes: form.duration_minutes, title: form.title, location: form.location, notes: form.notes,
        category: form.category, status: form.status, priority: form.priority, assigned_to: form.assigned_to,
        estimated_cost: form.estimated_cost, actual_cost: form.actual_cost, created_by: user.id,
        last_edited_by: user.id, position: form.position,
      }).select().maybeSingle();
      if (data) {
        await supabase.from('trip_activity_logs').insert({
          trip_id: tripId, actor_id: user.id, action_type: 'activity_created',
          description: `Added "${form.title}" to Day ${form.day_number}`,
          related_entity_type: 'itinerary_item', related_entity_id: data.id,
        });
      }
    } else {
      await supabase.from('itinerary_items').update({
        start_time: form.start_time, end_time: form.end_time, duration_minutes: form.duration_minutes,
        title: form.title, location: form.location, notes: form.notes, category: form.category,
        status: form.status, priority: form.priority, assigned_to: form.assigned_to,
        estimated_cost: form.estimated_cost, actual_cost: form.actual_cost,
        last_edited_by: user.id, updated_at: new Date().toISOString(),
      }).eq('id', form.id);
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id, action_type: 'activity_updated',
        description: `Updated "${form.title}"`,
        related_entity_type: 'itinerary_item', related_entity_id: form.id,
      });
    }
    setLoading(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950">{isNew ? 'New activity' : 'Edit activity'} · Day {form.day_number}</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <input required autoFocus value={form.title} onChange={e => update('title', e.target.value)} placeholder="Activity title" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.start_time} onChange={e => update('start_time', e.target.value)} placeholder="Start (09:30)" className="px-3 py-2 border border-stone-300 rounded-lg" />
            <input value={form.end_time} onChange={e => update('end_time', e.target.value)} placeholder="End (11:00)" className="px-3 py-2 border border-stone-300 rounded-lg" />
          </div>
          <input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Location" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
              <select value={form.category} onChange={e => update('category', e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
                <option value="activity">Activity</option><option value="food">Food</option>
                <option value="transport">Transport</option><option value="rest">Rest</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => update('priority', e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Status</label>
              <select value={form.status} onChange={e => update('status', e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
                {(Object.keys(STATUS_META) as ActivityStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Coordinator</label>
              <select value={form.assigned_to ?? ''} onChange={e => update('assigned_to', e.target.value || null)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Estimated cost ({currency})</label>
              <input type="number" step="0.01" value={form.estimated_cost} onChange={e => update('estimated_cost', Number(e.target.value))} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Actual cost ({currency})</label>
              <input type="number" step="0.01" value={form.actual_cost} onChange={e => update('actual_cost', Number(e.target.value))} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
            </div>
          </div>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
