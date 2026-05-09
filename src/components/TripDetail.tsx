import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, MapPin, Users, Wallet, Map, Plane, Sparkles, MessageCircle, Kanban, Vote, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Trip, TripMember, Profile, Expense } from '../lib/types';
import { BookingHub } from './module4/BookingHub';
import { ExpenseHub } from './module3/ExpenseHub';
import { AIPanel } from './panels/AIPanel';
import { ChatPanel } from './panels/ChatPanel';
import { MembersPanel } from './panels/MembersPanel';
import { DayItinerary } from './module2/DayItinerary';
import { KanbanBoard } from './module2/KanbanBoard';
import { TripPolls } from './module2/TripPolls';
import { TripTimeline } from './module2/TripTimeline';
import { PresenceBar } from './module6/PresenceBar';
import { LiveActivityFeed } from './module6/LiveActivityFeed';

type Tab = 'itinerary' | 'tasks' | 'polls' | 'timeline' | 'bookings' | 'expenses' | 'ai' | 'chat';

type Props = {
  tripId: string;
  onBack: () => void;
};

export function TripDetail({ tripId, onBack }: Props) {
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<(TripMember & { profile: Profile })[]>([]);
  const [spent, setSpent] = useState(0);
  const [tab, setTab] = useState<Tab>('itinerary');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);

  const load = async () => {
    try {
      const { data: t, error: tErr } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
      if (tErr) console.error('trips load', tErr);
      setTrip(t);
      const { data: m, error: mErr } = await supabase.from('trip_members').select('*').eq('trip_id', tripId);
      if (mErr) console.error('members load', mErr);
      const rows = m ?? [];
      if (rows.length > 0) {
        const ids = rows.map(x => x.user_id);
        const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
        const map = new Map((profs ?? []).map(p => [p.id, p]));
        setMembers(rows.map(x => ({ ...x, profile: map.get(x.user_id) ?? { id: x.user_id, full_name: 'Member', email: '', avatar_url: '', created_at: '' } })));
      } else {
        setMembers([]);
      }
      const { data: exps } = await supabase.from('expenses').select('amount').eq('trip_id', tripId);
      setSpent((exps ?? []).reduce((s, e: Pick<Expense, 'amount'>) => s + Number(e.amount), 0));
    } catch (e) {
      console.error('trip load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`trip-header:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 animate-pulse">
        <div className="h-64 md:h-80 bg-stone-200" />
        <div className="max-w-7xl mx-auto p-6 space-y-4">
          <div className="h-12 bg-stone-200 rounded w-1/3" />
          <div className="h-48 bg-stone-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="font-display text-2xl font-bold text-teal-950 mb-2">Trip not found</div>
        <p className="text-stone-600 mb-6 max-w-md">This trip may have been deleted or you might not have access. Try signing out and back in.</p>
        <button onClick={onBack} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-5 py-2.5 rounded-full font-medium hover:bg-teal-800 transition">
          <ArrowLeft className="w-4 h-4" /> Back to trips
        </button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Map }[] = [
    { id: 'itinerary', label: 'Itinerary', icon: Map },
    { id: 'tasks', label: 'Tasks', icon: Kanban },
    { id: 'polls', label: 'Polls', icon: Vote },
    { id: 'timeline', label: 'Timeline', icon: Activity },
    { id: 'bookings', label: 'Bookings', icon: Plane },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
  ];

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const budget = Number(trip.budget) || 0;
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent > budget && budget > 0;

  return (
    <div className="min-h-screen bg-stone-50 pb-24 md:pb-0">
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img src={trip.cover_url || 'https://images.pexels.com/photos/2356059/pexels-photo-2356059.jpeg?auto=compress&cs=tinysrgb&w=1600'} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-teal-950/60 via-teal-950/20 to-teal-950/80" />
        <div className="absolute inset-0 flex flex-col">
          <div className="p-6">
            <button onClick={onBack} className="inline-flex items-center gap-2 text-stone-100 hover:text-amber-300 transition text-sm">
              <ArrowLeft className="w-4 h-4" /> All trips
            </button>
          </div>
          <div className="mt-auto p-6 md:p-8 text-stone-50">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 max-w-7xl mx-auto w-full">
              <div className="min-w-0 flex-1">
                <div className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-2">{trip.status}</div>
                <h1 className="font-display text-4xl md:text-5xl font-bold mb-2 truncate">{trip.name}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-stone-200">
                  <div className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{trip.destination || 'Destination TBD'}</div>
                  <div className="inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" />{fmt(trip.start_date)} – {fmt(trip.end_date)}</div>
                </div>
                {budget > 0 && (
                  <div className="mt-3 max-w-sm">
                    <div className="flex items-center justify-between text-xs text-stone-200 mb-1">
                      <span>{trip.currency} {spent.toLocaleString()} spent</span>
                      <span className={over ? 'text-red-300 font-semibold' : 'text-amber-200'}>of {trip.currency} {budget.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-amber-300'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setShowMembers(true)} className="inline-flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20 transition rounded-full px-4 py-2 w-fit">
                <div className="flex -space-x-2">
                  {members.slice(0, 4).map((m) => (
                    <div key={m.id} className="w-7 h-7 rounded-full bg-amber-300 text-teal-950 border-2 border-teal-900 flex items-center justify-center text-xs font-bold">
                      {(m.profile.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 text-sm text-stone-50">
                  <Users className="w-4 h-4" /> {members.length}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <PresenceBar tripId={tripId} currentView={tab} />

      <div className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-200 hidden md:block">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-2 py-4 px-4 text-sm font-medium whitespace-nowrap transition ${
                tab === t.id ? 'text-teal-900' : 'text-stone-500 hover:text-teal-900'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {tab === t.id && <span className="absolute bottom-0 inset-x-2 h-0.5 bg-teal-900 rounded-t" />}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 animate-fade-in">
        {tab === 'itinerary' && <DayItinerary tripId={tripId} members={members} currency={trip.currency} />}
        {tab === 'tasks' && <KanbanBoard tripId={tripId} members={members} />}
        {tab === 'polls' && <TripPolls tripId={tripId} />}
        {tab === 'timeline' && (
          <div className="space-y-8">
            <LiveActivityFeed tripId={tripId} />
            <TripTimeline tripId={tripId} />
          </div>
        )}
        {tab === 'bookings' && <BookingHub tripId={tripId} trip={trip} members={members} />}
        {tab === 'expenses' && <ExpenseHub tripId={tripId} trip={trip} members={members} />}
        {tab === 'ai' && <AIPanel tripId={tripId} trip={trip} onApplied={load} />}
        {tab === 'chat' && <ChatPanel tripId={tripId} />}
      </div>

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 min-w-[60px] flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${tab === t.id ? 'text-teal-900' : 'text-stone-500'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {showMembers && <MembersPanel tripId={tripId} trip={trip} members={members} onClose={() => setShowMembers(false)} onChange={load} />}
    </div>
  );
}
