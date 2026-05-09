import { useEffect, useState } from 'react';
import { Activity, DollarSign, Plane, Map, CheckSquare, Vote, MessageSquare, UserPlus, Loader2, Search, SlidersHorizontal, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { TripActivityLog, Profile } from '../../lib/types';

type Props = { tripId: string };

type FilterType = 'all' | 'expense' | 'booking' | 'itinerary' | 'task' | 'poll' | 'message';

const ACTION_META: Record<string, { icon: typeof Activity; color: string; bg: string; label: string }> = {
  // Expenses
  expense_added:      { icon: DollarSign,  color: 'text-green-700',  bg: 'bg-green-100',  label: 'Added expense' },
  expense_updated:    { icon: DollarSign,  color: 'text-green-700',  bg: 'bg-green-100',  label: 'Updated expense' },
  expense_deleted:    { icon: DollarSign,  color: 'text-red-600',    bg: 'bg-red-100',    label: 'Deleted expense' },
  expense_flagged:    { icon: DollarSign,  color: 'text-amber-700',  bg: 'bg-amber-100',  label: 'Flagged expense' },
  settlement_created: { icon: DollarSign,  color: 'text-teal-700',   bg: 'bg-teal-100',   label: 'Settled up' },
  // Bookings
  booking_created:    { icon: Plane,       color: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Created booking' },
  booking_updated:    { icon: Plane,       color: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Updated booking' },
  booking_confirmed:  { icon: Plane,       color: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Confirmed booking' },
  booking_cancelled:  { icon: Plane,       color: 'text-red-600',    bg: 'bg-red-100',    label: 'Cancelled booking' },
  // Itinerary
  activity_created:   { icon: Map,         color: 'text-teal-700',   bg: 'bg-teal-100',   label: 'Added activity' },
  activity_updated:   { icon: Map,         color: 'text-teal-700',   bg: 'bg-teal-100',   label: 'Updated activity' },
  activity_deleted:   { icon: Map,         color: 'text-red-600',    bg: 'bg-red-100',    label: 'Removed activity' },
  activity_status:    { icon: Map,         color: 'text-teal-700',   bg: 'bg-teal-100',   label: 'Updated status' },
  // Tasks
  task_created:       { icon: CheckSquare, color: 'text-amber-700',  bg: 'bg-amber-100',  label: 'Created task' },
  task_moved:         { icon: CheckSquare, color: 'text-amber-700',  bg: 'bg-amber-100',  label: 'Moved task' },
  task_completed:     { icon: CheckSquare, color: 'text-green-700',  bg: 'bg-green-100',  label: 'Completed task' },
  task_deleted:       { icon: CheckSquare, color: 'text-red-600',    bg: 'bg-red-100',    label: 'Deleted task' },
  // Polls
  poll_created:       { icon: Vote,        color: 'text-violet-700', bg: 'bg-violet-100', label: 'Created poll' },
  poll_voted:         { icon: Vote,        color: 'text-violet-700', bg: 'bg-violet-100', label: 'Voted in poll' },
  poll_closed:        { icon: Vote,        color: 'text-violet-700', bg: 'bg-violet-100', label: 'Closed poll' },
  // Messages / Members
  message:            { icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Sent message' },
  trip_created:       { icon: Map,           color: 'text-teal-700',  bg: 'bg-teal-100',  label: 'Created trip' },
  member_joined:      { icon: UserPlus,      color: 'text-teal-700',  bg: 'bg-teal-100',  label: 'Joined trip' },
};

const FILTER_META: Record<FilterType, { label: string }> = {
  all:       { label: 'All Activity' },
  expense:   { label: 'Expenses' },
  booking:   { label: 'Bookings' },
  itinerary: { label: 'Itinerary' },
  task:      { label: 'Tasks' },
  poll:      { label: 'Polls' },
  message:   { label: 'Chat' },
};

function filterMatches(log: TripActivityLog, filter: FilterType): boolean {
  if (filter === 'all') return true;
  const t = log.action_type;
  if (filter === 'expense') return t.startsWith('expense') || t.startsWith('settlement');
  if (filter === 'booking') return t.startsWith('booking');
  if (filter === 'itinerary') return t.startsWith('activity') || t.startsWith('trip_created');
  if (filter === 'task') return t.startsWith('task');
  if (filter === 'poll') return t.startsWith('poll');
  if (filter === 'message') return t === 'message';
  return true;
}

function groupByDate(logs: TripActivityLog[]): { label: string; items: TripActivityLog[] }[] {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);

  const groups: Record<string, TripActivityLog[]> = {};
  for (const log of logs) {
    const d = new Date(log.created_at); d.setHours(0,0,0,0);
    let label: string;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= lastWeek) label = 'This Week';
    else label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(log);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function LiveActivityFeed({ tripId }: Props) {
  const [logs, setLogs] = useState<TripActivityLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const load = async (reset = false) => {
    if (reset) setLoading(true);
    const { data: lg } = await supabase
      .from('trip_activity_logs')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * (reset ? 1 : page));
    const data = lg ?? [];
    setLogs(data);
    const ids = [...new Set(data.map(l => l.actor_id))];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('*').in('id', ids);
      setProfiles(prev => ({ ...prev, ...Object.fromEntries((ps ?? []).map(p => [p.id, p])) }));
    }
    if (reset) setLoading(false);
  };

  useEffect(() => { load(true); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`activity-feed:${tripId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_activity_logs', filter: `trip_id=eq.${tripId}` }, (payload) => {
        const newLog = payload.new as TripActivityLog;
        setLogs(prev => [newLog, ...prev]);
        // Load profile if missing
        if (!profiles[newLog.actor_id]) {
          supabase.from('profiles').select('*').eq('id', newLog.actor_id).maybeSingle().then(({ data }) => {
            if (data) setProfiles(prev => ({ ...prev, [data.id]: data }));
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const filtered = logs.filter(l => {
    if (!filterMatches(l, filter)) return false;
    if (search && !l.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activity..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-stone-600 bg-white border border-stone-200 rounded-xl hover:border-stone-300 transition">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {(Object.keys(FILTER_META) as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition ${filter === f ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-400'}`}
          >
            {FILTER_META[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-700" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-12 text-center">
          <Activity className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">{search ? 'No matching activity.' : 'Activity will appear here as the group collaborates.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px bg-stone-200 flex-1" />
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide px-2">{group.label}</span>
                <div className="h-px bg-stone-200 flex-1" />
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-50">
                {group.items.map(log => {
                  const meta = ACTION_META[log.action_type] ?? ACTION_META.activity_updated;
                  const Icon = meta.icon;
                  const actor = profiles[log.actor_id];
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-stone-50 transition group animate-fade-in">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-stone-800">
                              {actor?.full_name ?? 'Someone'}
                            </span>
                            <span className="text-sm text-stone-600"> {log.description}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 shrink-0 mt-0.5">{timeAgo(log.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filtered.length >= PAGE_SIZE && (
            <button
              onClick={() => { setPage(p => p + 1); load(); }}
              className="w-full py-3 border border-dashed border-stone-300 rounded-2xl text-sm text-stone-500 hover:border-teal-400 hover:text-teal-700 transition flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" /> Load more activity
            </button>
          )}
        </div>
      )}
    </div>
  );
}
