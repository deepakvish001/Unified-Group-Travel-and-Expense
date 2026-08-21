import { useEffect, useState } from 'react';
import { X, Loader2, Users, Mountain, Briefcase, GraduationCap, Home, Compass, PenLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import type { Group, TripCategory } from '../lib/types';

type Props = {
  onClose: () => void;
  onCreated: (id: string) => void;
  covers: string[];
};

const CATEGORIES: { value: TripCategory; label: string; icon: typeof Users; tint: string }[] = [
  { value: 'friends', label: 'Friends', icon: Users, tint: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'family', label: 'Family', icon: Home, tint: 'bg-rose-100 text-rose-800 border-rose-300' },
  { value: 'college', label: 'College', icon: GraduationCap, tint: 'bg-sky-100 text-sky-800 border-sky-300' },
  { value: 'trekking', label: 'Trekking', icon: Mountain, tint: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'corporate', label: 'Corporate', icon: Briefcase, tint: 'bg-slate-100 text-slate-800 border-slate-300' },
  { value: 'adventure', label: 'Adventure', icon: Compass, tint: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'other', label: 'Other', icon: PenLine, tint: 'bg-teal-100 text-teal-800 border-teal-300' },
];

export function NewTripModal({ onClose, onCreated, covers }: Props) {
  const { user } = useAuth();
  const { setCurrency: setGlobalCurrency } = useCurrency();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<TripCategory>>(new Set(['friends']));
  const [customCategory, setCustomCategory] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [budget, setBudget] = useState('1000');
  const [currency, setCurrency] = useState('USD');
  const [cover, setCover] = useState(covers[0]);
  const [groupId, setGroupId] = useState<string>('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
      const ids = (memberships ?? []).map(m => m.group_id);
      if (ids.length === 0) { setGroups([]); return; }
      const { data: gs } = await supabase.from('groups').select('*').in('id', ids);
      setGroups(gs ?? []);
    })();
  }, [user]);

  const toggleCategory = (cat: TripCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const buildCategoryString = (): string => {
    const parts: string[] = [];
    for (const cat of selectedCategories) {
      if (cat === 'other') {
        const trimmed = customCategory.trim();
        if (trimmed) parts.push(trimmed);
      } else {
        parts.push(cat);
      }
    }
    return parts.join(',');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedCategories.size === 0) { setErr('Select at least one trip type'); return; }
    if (selectedCategories.has('other') && !customCategory.trim()) { setErr('Enter a custom trip type'); return; }

    setLoading(true); setErr(null);
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string) ?? user.email ?? '',
      avatar_url: '',
    }, { onConflict: 'id', ignoreDuplicates: true });

    const category = buildCategoryString();
    const { data, error } = await supabase.from('trips').insert({
      owner_id: user.id,
      group_id: groupId || null,
      name,
      destination,
      category,
      start_date: start || null,
      end_date: end || null,
      budget: Number(budget) || 0,
      currency,
      cover_url: cover,
      status: 'planning',
    }).select().maybeSingle();
    if (error || !data) { setErr(error?.message ?? 'Failed'); setLoading(false); return; }
    setGlobalCurrency(currency);
    await supabase.from('trip_members').insert({ trip_id: data.id, user_id: user.id, role: 'admin' });

    if (groupId) {
      const { data: others } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
      const rows = (others ?? [])
        .filter(m => m.user_id !== user.id)
        .map(m => ({ trip_id: data.id, user_id: m.user_id, role: 'member' }));
      if (rows.length) await supabase.from('trip_members').insert(rows);
    }

    await supabase.from('trip_activity_logs').insert({
      trip_id: data.id, actor_id: user.id, action_type: 'trip_created',
      description: `Created trip "${name}"`,
    });
    setLoading(false);
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h2 className="font-display text-xl font-bold text-teal-950">New trip</h2>
          <button onClick={onClose} aria-label="Close new trip dialog" className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Trip name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Cherry Blossom Tour" className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Destination</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Kyoto, Japan" className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Trip type <span className="text-stone-400 font-normal">(select one or more)</span></label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => {
                const active = selectedCategories.has(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCategory(c.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${active ? c.tint : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}
                  >
                    <c.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{c.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </button>
                );
              })}
            </div>
            {selectedCategories.has('other') && (
              <input
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="Enter your trip type (e.g. Pilgrimage, Wellness...)"
                className="mt-2 w-full px-4 py-2.5 border border-teal-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800 bg-teal-50 text-sm"
                autoFocus
              />
            )}
          </div>
          {groups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Link a group (optional)</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full px-4 py-2.5 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800">
                <option value="">No group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <p className="text-xs text-stone-500 mt-1">All group members will be added to this trip automatically.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Start</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">End</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Budget</label>
              <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800 bg-white">
                {['USD','EUR','GBP','JPY','INR','AUD','CAD'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Cover image</label>
            <div className="grid grid-cols-4 gap-2">
              {covers.map((c) => (
                <button type="button" key={c} onClick={() => setCover(c)} className={`relative h-20 rounded-lg overflow-hidden border-2 transition ${cover === c ? 'border-teal-800 ring-2 ring-teal-200' : 'border-transparent'}`}>
                  <img src={c} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-stone-700 hover:bg-stone-100 rounded-xl font-medium">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-900 text-stone-50 rounded-xl font-medium hover:bg-teal-800 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create trip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
