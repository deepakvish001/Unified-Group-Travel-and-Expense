import { useEffect, useState } from 'react';
import { Plus, X, Loader2, Trash2, Check, Vote, Lock, Clock, Users, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { TripPoll, TripPollOption, TripPollVote, Profile } from '../../lib/types';

const CATEGORIES = ['general', 'destination', 'activity', 'food', 'lodging', 'transport'];

function useCountdown(expiresAt: string | null): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!expiresAt) { setLabel(''); return; }
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 24) setLabel(`${Math.floor(h/24)}d ${h%24}h`);
      else if (h > 0) setLabel(`${h}h ${m}m`);
      else setLabel(`${m}m ${s}s`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  return label;
}

function PollCountdown({ expiresAt }: { expiresAt: string }) {
  const label = useCountdown(expiresAt);
  if (!label) return null;
  const expired = label === 'Expired';
  return (
    <div className={`inline-flex items-center gap-1.5 mt-1 text-xs font-medium ${expired ? 'text-red-600' : 'text-amber-700'}`}>
      <Clock className="w-3 h-3" />
      <span>{expired ? 'Poll expired' : `Closes in ${label}`}</span>
    </div>
  );
}

export function TripPolls({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<TripPoll[]>([]);
  const [options, setOptions] = useState<TripPollOption[]>([]);
  const [votes, setVotes] = useState<TripPollVote[]>([]);
  const [voters, setVoters] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newVoteFor, setNewVoteFor] = useState<string | null>(null);

  const load = async () => {
    const { data: ps } = await supabase.from('trip_polls').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    setPolls(ps ?? []);
    const ids = (ps ?? []).map(p => p.id);
    if (ids.length) {
      const { data: os } = await supabase.from('trip_poll_options').select('*').in('poll_id', ids).order('position');
      setOptions(os ?? []);
      const optionIds = (os ?? []).map(o => o.id);
      if (optionIds.length) {
        const { data: vs } = await supabase.from('trip_poll_votes').select('*').in('option_id', optionIds);
        setVotes(vs ?? []);
        // Load voter profiles
        const voterIds = [...new Set((vs ?? []).map(v => v.user_id))];
        if (voterIds.length) {
          const { data: profs } = await supabase.from('profiles').select('*').in('id', voterIds);
          setVoters(Object.fromEntries((profs ?? []).map(p => [p.id, p])));
        }
      } else setVotes([]);
    } else { setOptions([]); setVotes([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`m2-polls:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_polls', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_poll_options' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_poll_votes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const castVote = async (poll: TripPoll, optionId: string) => {
    if (!user) return;
    const pollOptIds = options.filter(o => o.poll_id === poll.id).map(o => o.id);
    const mine = votes.filter(v => v.user_id === user.id && pollOptIds.includes(v.option_id));
    const existing = mine.find(v => v.option_id === optionId);
    if (existing) {
      await supabase.from('trip_poll_votes').delete().eq('id', existing.id);
    } else {
      if (!poll.allow_multiple && mine.length > 0) {
        await supabase.from('trip_poll_votes').delete().in('id', mine.map(v => v.id));
      }
      await supabase.from('trip_poll_votes').insert({ option_id: optionId, user_id: user.id });
      // Pulse indicator
      setNewVoteFor(poll.id);
      setTimeout(() => setNewVoteFor(null), 1500);
      // Activity log
      const opt = options.find(o => o.id === optionId);
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id, action_type: 'poll_voted',
        description: opt
          ? `voted "${opt.option_text}" in poll "${poll.question}"`
          : `voted in poll "${poll.question}"`,
        related_entity_type: 'trip_poll', related_entity_id: poll.id,
      });
    }
  };

  const closePoll = async (id: string) => {
    await supabase.from('trip_polls').update({ is_closed: true }).eq('id', id);
  };
  const removePoll = async (id: string) => {
    await supabase.from('trip_polls').delete().eq('id', id);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-teal-900" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Polls & voting</h2>
          <p className="text-stone-600 text-sm">Decide together on destinations, activities, and more.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
          <Plus className="w-4 h-4" /> New poll
        </button>
      </div>

      {polls.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center">
          <Vote className="w-10 h-10 text-stone-400 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">No polls yet. Create one to start deciding together.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map(p => {
            const opts = options.filter(o => o.poll_id === p.id);
            const pollOptIds = opts.map(o => o.id);
            const pollVotes = votes.filter(v => pollOptIds.includes(v.option_id));
            const totalVotes = pollVotes.length;
            const expired = !!(p.expires_at && new Date(p.expires_at) < new Date());
            const closed = p.is_closed || expired;
            const isOwner = user?.id === p.created_by;
            const isNew = newVoteFor === p.id;

            // Find winner
            const winnerOpt = closed && opts.length > 0
              ? opts.reduce((a, b) => {
                  const av = pollVotes.filter(v => v.option_id === a.id).length;
                  const bv = pollVotes.filter(v => v.option_id === b.id).length;
                  return bv > av ? b : a;
                })
              : null;

            // Recent voters (last 5)
            const recentVoterIds = [...new Set(pollVotes.slice(-5).map(v => v.user_id))];

            return (
              <div key={p.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${isNew ? 'border-teal-400 shadow-lg shadow-teal-100' : 'border-stone-200'}`}>
                {/* Closed winner banner */}
                {closed && winnerOpt && totalVotes > 0 && (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-white" />
                    <span className="text-sm font-semibold text-white">Winner: {winnerOpt.option_text}</span>
                    <span className="text-xs text-amber-100 ml-auto">{pollVotes.filter(v => v.option_id === winnerOpt.id).length}/{totalVotes} votes</span>
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{p.category}</span>
                        {p.is_anonymous && <span className="text-[10px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">Anonymous</span>}
                        {p.allow_multiple && <span className="text-[10px] font-medium text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">Multi-select</span>}
                        {closed && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full"><Lock className="w-2.5 h-2.5" /> Closed</span>}
                        {isNew && <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full animate-pulse">New vote!</span>}
                      </div>
                      <h3 className="font-display font-bold text-teal-950 text-lg">{p.question}</h3>
                      {p.expires_at && !closed && (
                        <PollCountdown expiresAt={p.expires_at} />
                      )}
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 shrink-0">
                        {!closed && <button onClick={() => closePoll(p.id)} className="text-xs text-stone-500 hover:text-teal-900 px-2 py-1 rounded transition border border-stone-200 hover:border-teal-400">Close</button>}
                        <button onClick={() => removePoll(p.id)} className="text-stone-400 hover:text-red-600 p-1 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {opts.map(o => {
                      const optVotes = pollVotes.filter(v => v.option_id === o.id);
                      const myVote = optVotes.some(v => v.user_id === user?.id);
                      const pct = totalVotes > 0 ? (optVotes.length / totalVotes) * 100 : 0;
                      const isWinner = closed && winnerOpt?.id === o.id && totalVotes > 0;
                      return (
                        <button
                          key={o.id}
                          disabled={closed}
                          onClick={() => castVote(p, o.id)}
                          className={`relative w-full text-left rounded-xl border-2 overflow-hidden transition-all ${isWinner ? 'border-amber-400' : myVote ? 'border-teal-800' : 'border-stone-200 hover:border-stone-300'} ${closed ? 'cursor-default' : 'hover:shadow-sm'}`}
                        >
                          <div className={`absolute inset-y-0 left-0 transition-all duration-700 ${isWinner ? 'bg-amber-50' : 'bg-teal-50'}`} style={{ width: `${pct}%` }} />
                          <div className="relative flex items-center justify-between px-4 py-2.5 gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isWinner ? 'bg-amber-500 text-white' : myVote ? 'bg-teal-900 text-stone-50' : 'border border-stone-300'}`}>
                                {isWinner ? <Trophy className="w-3 h-3" /> : myVote ? <Check className="w-3 h-3" /> : null}
                              </div>
                              <span className={`font-medium text-sm truncate ${isWinner ? 'text-amber-800' : 'text-teal-950'}`}>{o.option_text}</span>
                            </div>
                            <div className="text-xs font-semibold text-stone-600 flex-shrink-0">
                              {optVotes.length} <span className="text-stone-400 font-normal">({pct.toFixed(0)}%)</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Recent voters */}
                    {!p.is_anonymous && recentVoterIds.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {recentVoterIds.map(uid => (
                          <div key={uid} title={voters[uid]?.full_name} className="w-5 h-5 rounded-full bg-teal-800 text-amber-300 text-[9px] font-bold flex items-center justify-center border border-white">
                            {(voters[uid]?.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <NewPollModal tripId={tripId} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function NewPollModal({ tripId, onClose, onCreated }: { tripId: string; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('general');
  const [opts, setOpts] = useState<string[]>(['', '']);
  const [anonymous, setAnonymous] = useState(false);
  const [multiple, setMultiple] = useState(false);
  const [expires, setExpires] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = opts.filter(o => o.trim());
    if (!user || !question.trim() || valid.length < 2) return;
    setLoading(true);
    const { data: poll } = await supabase.from('trip_polls').insert({
      trip_id: tripId, question, category, is_anonymous: anonymous, allow_multiple: multiple,
      expires_at: expires || null, created_by: user.id,
    }).select().maybeSingle();
    if (poll) {
      await supabase.from('trip_poll_options').insert(valid.map((o, i) => ({ poll_id: poll.id, option_text: o.trim(), position: i })));
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id, action_type: 'poll_created',
        description: `Created poll "${question}"`, related_entity_type: 'trip_poll', related_entity_id: poll.id,
      });
    }
    setLoading(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950">New poll</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          <input required autoFocus value={question} onChange={e => setQuestion(e.target.value)} placeholder="Poll question" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white capitalize">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-600">Options</label>
            {opts.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input value={o} onChange={e => setOpts(opts.map((v, j) => j === i ? e.target.value : v))} placeholder={`Option ${i + 1}`} className="flex-1 px-3 py-2 border border-stone-300 rounded-lg" />
                {opts.length > 2 && (
                  <button type="button" onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="p-2 text-stone-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setOpts([...opts, ''])} className="text-sm text-teal-900 font-medium hover:underline">+ Add option</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} className="accent-teal-900" />
              Anonymous
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={multiple} onChange={e => setMultiple(e.target.checked)} className="accent-teal-900" />
              Multi-select
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Deadline (optional)</label>
            <input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}Create poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
