// ADDED: Activity Suggestions + Approval Workflow - PRO Module 1
import { useEffect, useState } from 'react';
import { Plus, ThumbsUp, ThumbsDown, Check, X, MessageSquare, Clock, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../lib/types';

interface ActivitySuggestion {
  id: string;
  trip_id: string;
  suggested_by: string;
  day_number: number | null;
  title: string;
  description: string | null;
  time_slot: string | null;
  estimated_cost: number;
  category: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'discussed';
  votes_for: number;
  votes_against: number;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Props {
  tripId: string;
  isAdmin: boolean;
  members: { user_id: string; profile: Profile }[];
  currency: string;
}

const STATUS_META = {
  pending:   { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' },
  approved:  { label: 'Approved', color: 'bg-teal-100 text-teal-800' },
  rejected:  { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  discussed: { label: 'Under Discussion', color: 'bg-blue-100 text-blue-800' },
};

const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'anytime'];
const CATEGORIES = ['activity', 'food', 'transport', 'sightseeing', 'accommodation', 'shopping', 'other'];

export function ActivitySuggestions({ tripId, isAdmin, members, currency }: Props) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [myVotes, setMyVotes] = useState<Map<string, 'for' | 'against'>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', day_number: '', time_slot: 'anytime',
    estimated_cost: '', category: 'activity', notes: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_suggestions')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    setSuggestions((data ?? []) as ActivitySuggestion[]);

    if (user) {
      const ids = (data ?? []).map(s => s.id);
      if (ids.length) {
        const { data: votes } = await supabase
          .from('suggestion_votes')
          .select('suggestion_id, vote')
          .in('suggestion_id', ids)
          .eq('user_id', user.id);
        const map = new Map<string, 'for' | 'against'>();
        for (const v of (votes ?? [])) map.set(v.suggestion_id, v.vote as 'for' | 'against');
        setMyVotes(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`suggestions:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_suggestions', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestion_votes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    await supabase.from('activity_suggestions').insert({
      trip_id: tripId,
      suggested_by: user.id,
      title: form.title.trim(),
      description: form.description || null,
      day_number: form.day_number ? parseInt(form.day_number) : null,
      time_slot: form.time_slot,
      estimated_cost: parseFloat(form.estimated_cost) || 0,
      category: form.category,
      notes: form.notes || null,
    });
    setForm({ title: '', description: '', day_number: '', time_slot: 'anytime', estimated_cost: '', category: 'activity', notes: '' });
    setShowForm(false);
  };

  const vote = async (suggestionId: string, voteType: 'for' | 'against') => {
    if (!user) return;
    const current = myVotes.get(suggestionId);
    if (current === voteType) {
      await supabase.from('suggestion_votes').delete().eq('suggestion_id', suggestionId).eq('user_id', user.id);
    } else {
      await supabase.from('suggestion_votes').upsert({ suggestion_id: suggestionId, user_id: user.id, vote: voteType }, { onConflict: 'suggestion_id,user_id' });
    }
    // Recalculate vote counts
    const { data: allVotes } = await supabase.from('suggestion_votes').select('vote').eq('suggestion_id', suggestionId);
    const forCount = (allVotes ?? []).filter(v => v.vote === 'for').length;
    const againstCount = (allVotes ?? []).filter(v => v.vote === 'against').length;
    await supabase.from('activity_suggestions').update({ votes_for: forCount, votes_against: againstCount }).eq('id', suggestionId);
    load();
  };

  const review = async (id: string, status: 'approved' | 'rejected' | 'discussed') => {
    if (!user) return;
    await supabase.from('activity_suggestions').update({
      status,
      admin_note: adminNote || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    setReviewingId(null);
    setAdminNote('');
    load();
  };

  const profileOf = (userId: string) => {
    const m = members.find(m => m.user_id === userId);
    return m?.profile.full_name || 'Member';
  };

  if (loading) return <div className="text-center py-12 text-stone-500 text-sm">Loading suggestions...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-teal-950">Activity Suggestions</h3>
          <p className="text-stone-500 text-sm mt-0.5">Members can propose activities for admin approval</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition"
        >
          <Plus className="w-4 h-4" /> Suggest Activity
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-teal-950 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600" /> New Suggestion
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1">Activity Title *</label>
              <input
                required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Sunrise hike to the viewpoint"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Day Number</label>
              <input
                type="number" min="1" value={form.day_number} onChange={e => setForm(p => ({ ...p, day_number: e.target.value }))}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Time Slot</label>
              <select value={form.time_slot} onChange={e => setForm(p => ({ ...p, time_slot: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Estimated Cost ({currency})</label>
              <input
                type="number" min="0" value={form.estimated_cost} onChange={e => setForm(p => ({ ...p, estimated_cost: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
              <textarea
                rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Why should we do this? What's special about it?"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="px-4 py-2 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition">
              Submit Suggestion
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-stone-600 hover:text-teal-900 text-sm transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {suggestions.length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
          <Lightbulb className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <div className="font-medium text-stone-600 mb-1">No suggestions yet</div>
          <p className="text-sm text-stone-400">Be the first to suggest an activity for the trip!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => {
            const myVote = myVotes.get(s.id);
            const isExpanded = expanded === s.id;
            const isReviewing = reviewingId === s.id;
            const meta = STATUS_META[s.status];

            return (
              <div key={s.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-sm transition">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-semibold text-teal-950">{s.title}</h4>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                        <span>By {profileOf(s.suggested_by)}</span>
                        {s.day_number && <span>Day {s.day_number}</span>}
                        {s.time_slot && s.time_slot !== 'anytime' && (
                          <span className="capitalize">{s.time_slot}</span>
                        )}
                        {s.estimated_cost > 0 && (
                          <span className="text-teal-700 font-medium">{currency} {s.estimated_cost.toLocaleString()}</span>
                        )}
                        <span className="capitalize bg-stone-100 px-1.5 py-0.5 rounded">{s.category}</span>
                      </div>
                    </div>
                    <button onClick={() => setExpanded(isExpanded ? null : s.id)} className="text-stone-400 hover:text-teal-900 transition p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {s.description && (
                    <p className="text-sm text-stone-600 mt-2 leading-relaxed">{s.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => vote(s.id, 'for')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
                        ${myVote === 'for' ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-600 hover:bg-teal-50 hover:text-teal-700'}`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> {s.votes_for}
                    </button>
                    <button
                      onClick={() => vote(s.id, 'against')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
                        ${myVote === 'against' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600 hover:bg-red-50 hover:text-red-600'}`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> {s.votes_against}
                    </button>
                    {isAdmin && s.status === 'pending' && (
                      <button
                        onClick={() => { setReviewingId(isReviewing ? null : s.id); setAdminNote(''); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100 transition ml-auto"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Review
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && s.admin_note && (
                  <div className="border-t border-stone-100 px-4 py-3 bg-stone-50">
                    <div className="text-xs font-medium text-stone-500 mb-1">Admin Note</div>
                    <p className="text-sm text-stone-700">{s.admin_note}</p>
                    {s.reviewed_at && (
                      <div className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Reviewed {new Date(s.reviewed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {isReviewing && isAdmin && (
                  <div className="border-t border-stone-100 px-4 py-3 bg-amber-50/50 space-y-3">
                    <div className="text-xs font-medium text-stone-600">Admin Review</div>
                    <textarea
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Optional note to the group..."
                      rows={2}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none bg-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => review(s.id, 'approved')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-600 transition">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => review(s.id, 'discussed')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition">
                        <MessageSquare className="w-3.5 h-3.5" /> Discuss
                      </button>
                      <button onClick={() => review(s.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 transition">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button onClick={() => setReviewingId(null)}
                        className="px-3 py-1.5 text-stone-500 hover:text-stone-700 text-xs transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
