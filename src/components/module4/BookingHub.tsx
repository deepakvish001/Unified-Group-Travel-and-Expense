import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, LayoutGrid, User, Clock, CheckCircle2, ListChecks, Activity as ActivityIcon, Bell, BadgeCheck, AlertTriangle, Download, Compass } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Booking, BookingParticipant, BookingType, BookingStatus, BookingActivityLog, Trip } from '../../lib/types';
import { BOOKING_TYPE_META, STATUS_META, BOOKING_STATUS_KEYS, PRIORITY_META } from './constants';
import { CreateBookingWizard } from './CreateBookingWizard';
import { BookingDetail } from './BookingDetail';
import { TravelerVault } from './TravelerVault';
import { Discovery } from './Discovery';
import type { PlaceResult } from '../../lib/discovery';
import { currencyFmt, formatDate, formatDateTime, memberName, timeAgo, toCSV, downloadBlob, computeCompleteness, type MemberRow } from './utils';

type Props = { tripId: string; trip: Trip; members: MemberRow[] };

type Tab = 'all' | 'mine' | 'pending' | 'confirmed' | 'vault' | 'checklist' | 'discover' | 'log';

export function BookingHub({ tripId, trip, members }: Props) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [participants, setParticipants] = useState<BookingParticipant[]>([]);
  const [logs, setLogs] = useState<BookingActivityLog[]>([]);
  const [vaults, setVaults] = useState<Record<string, { pct: number }>>({});
  const [tab, setTab] = useState<Tab>('all');
  const [openWizard, setOpenWizard] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<PlaceResult | null>(null);
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<BookingType | ''>('');
  const [filterStatus, setFilterStatus] = useState<BookingStatus | ''>('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [bRes, pRes, lRes, vRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('booking_participants').select('*').in('booking_id', (await supabase.from('bookings').select('id').eq('trip_id', tripId)).data?.map(x => x.id) || []),
      supabase.from('booking_activity_logs').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(100),
      supabase.from('traveler_profiles').select('*').in('user_id', members.map(m => m.user_id)),
    ]);
    setBookings(bRes.data ?? []);
    setParticipants(pRes.data ?? []);
    setLogs(lRes.data ?? []);
    const vmap: Record<string, { pct: number }> = {};
    (vRes.data ?? []).forEach(v => { vmap[v.user_id] = { pct: computeCompleteness(v).pct }; });
    members.forEach(m => { if (!vmap[m.user_id]) vmap[m.user_id] = { pct: 0 }; });
    setVaults(vmap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId, members.length]);

  useEffect(() => {
    const ch = supabase.channel(`booking-hub:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_participants' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_activity_logs', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traveler_profiles' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const pending = bookings.filter(b => b.status === 'pending' || b.status === 'requires_action').length;
    const inProgress = bookings.filter(b => b.status === 'in_progress').length;
    const estimated = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (Number(b.actual_cost) || Number(b.estimated_cost) || Number(b.cost) || 0), 0);
    return { total, confirmed, pending, inProgress, estimated };
  }, [bookings]);

  const filtered = useMemo(() => {
    let list = bookings;
    if (tab === 'mine') list = list.filter(b => b.assigned_coordinator === user?.id);
    if (tab === 'pending') list = list.filter(b => b.status === 'pending' || b.status === 'requires_action' || b.status === 'in_progress');
    if (tab === 'confirmed') list = list.filter(b => b.status === 'confirmed');
    if (filterType) list = list.filter(b => b.type === filterType);
    if (filterStatus) list = list.filter(b => b.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.notes.toLowerCase().includes(q));
    }
    return list;
  }, [bookings, tab, filterType, filterStatus, search, user]);

  const partsOf = (bookingId: string) => participants.filter(p => p.booking_id === bookingId && p.participation_status === 'included');

  const exportAll = () => {
    const rows = bookings.map(b => ({
      Title: b.title,
      Type: BOOKING_TYPE_META[b.type]?.label || b.type,
      Status: STATUS_META[b.status]?.label || b.status,
      Priority: b.priority,
      Coordinator: memberName(b.assigned_coordinator, members),
      'Travel Date': b.travel_date || '',
      Deadline: b.booking_deadline || '',
      Travelers: partsOf(b.id).length,
      'Estimated Cost': b.estimated_cost || b.cost || 0,
      'Actual Cost': b.actual_cost || 0,
      Currency: b.currency,
      Reference: b.booking_reference || '',
      'Linked Expense': b.linked_expense_id ? 'Yes' : 'No',
    }));
    downloadBlob(toCSV(rows), `bookings-${trip.name}.csv`);
  };

  if (loading) return <div className="animate-pulse bg-white rounded-2xl h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Booking coordination</h2>
          <p className="text-sm text-stone-600">Prepare traveler data, assign coordinators, and track bookings end-to-end.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportAll} className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-teal-900 rounded-lg text-sm font-medium"><Download className="w-4 h-4" />Export</button>
          <button onClick={() => setOpenWizard(true)} className="inline-flex items-center gap-1.5 bg-teal-900 text-stone-50 hover:bg-teal-800 px-4 py-2 rounded-lg text-sm font-medium"><Plus className="w-4 h-4" />New booking</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat icon={LayoutGrid} label="Total" value={stats.total} />
        <Stat icon={CheckCircle2} label="Confirmed" value={stats.confirmed} accent="teal" />
        <Stat icon={Clock} label="Pending" value={stats.pending} accent="amber" />
        <Stat icon={ActivityIcon} label="In progress" value={stats.inProgress} accent="sky" />
        <Stat icon={User} label="Est. cost" value={currencyFmt(stats.estimated, trip.currency)} wide />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-stone-200">
        {([
          { id: 'all', label: 'All bookings', icon: LayoutGrid },
          { id: 'mine', label: 'My assigned', icon: User },
          { id: 'pending', label: 'Pending action', icon: Clock },
          { id: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
          { id: 'vault', label: 'My vault', icon: BadgeCheck },
          { id: 'checklist', label: 'Readiness', icon: ListChecks },
          { id: 'discover', label: 'Discover', icon: Compass },
          { id: 'log', label: 'Activity', icon: Bell },
        ] as { id: Tab; label: string; icon: typeof LayoutGrid }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${tab === t.id ? 'border-teal-900 text-teal-900 font-semibold' : 'border-transparent text-stone-500 hover:text-teal-900'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'vault' && <TravelerVault />}

      {tab === 'checklist' && <Checklist bookings={bookings} members={members} vaults={vaults} currency={trip.currency} />}

      {tab === 'log' && <ActivityFeed logs={logs} members={members} bookings={bookings} />}

      {tab === 'discover' && (
        <Discovery
          initialLocation={trip.destination}
          onAddToBooking={(p) => { setWizardPrefill(p); setOpenWizard(true); }}
        />
      )}

      {tab !== 'vault' && tab !== 'checklist' && tab !== 'log' && tab !== 'discover' && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bookings..." className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-lg text-sm" />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-2">
              <Filter className="w-4 h-4 text-stone-400" />
              <select value={filterType} onChange={e => setFilterType(e.target.value as BookingType | '')} className="py-2 text-sm bg-transparent">
                <option value="">All types</option>
                {(Object.keys(BOOKING_TYPE_META) as BookingType[]).filter(k => k !== 'transport').map(k => <option key={k} value={k}>{BOOKING_TYPE_META[k].label}</option>)}
              </select>
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as BookingStatus | '')} className="py-2 px-3 bg-white border border-stone-200 rounded-lg text-sm">
              <option value="">All statuses</option>
              {BOOKING_STATUS_KEYS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-stone-300 rounded-2xl">
              <LayoutGrid className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <div className="font-display text-lg font-bold text-teal-950">No bookings yet</div>
              <p className="text-sm text-stone-600 mt-1 mb-4">Start coordinating trains, hotels, activities and more.</p>
              <button onClick={() => setOpenWizard(true)} className="inline-flex items-center gap-1 bg-teal-900 text-stone-50 hover:bg-teal-800 px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" />Create booking</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {filtered.map(b => (
                <BookingCard key={b.id} b={b} participants={partsOf(b.id)} members={members} onOpen={() => setOpenBooking(b)} />
              ))}
            </div>
          )}
        </>
      )}

      {openWizard && <CreateBookingWizard tripId={tripId} currency={trip.currency} members={members} prefill={wizardPrefill} onClose={() => { setOpenWizard(false); setWizardPrefill(null); }} onSaved={load} />}
      {openBooking && <BookingDetail booking={openBooking} members={members} onClose={() => setOpenBooking(null)} onChanged={load} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent, wide }: { icon: typeof Clock; label: string; value: string | number; accent?: 'teal' | 'amber' | 'sky'; wide?: boolean }) {
  const color = accent === 'teal' ? 'text-teal-700' : accent === 'amber' ? 'text-amber-700' : accent === 'sky' ? 'text-sky-700' : 'text-teal-900';
  return (
    <div className={`bg-white border border-stone-200 rounded-xl p-3 ${wide ? 'col-span-2 md:col-span-1' : ''}`}>
      <div className="text-[11px] uppercase tracking-wide text-stone-500 flex items-center gap-1 mb-1"><Icon className="w-3 h-3" />{label}</div>
      <div className={`font-display text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BookingCard({ b, participants, members, onOpen }: { b: Booking; participants: BookingParticipant[]; members: MemberRow[]; onOpen: () => void }) {
  const M = BOOKING_TYPE_META[b.type];
  const Icon = M.icon;
  const S = STATUS_META[b.status];
  const overdue = b.booking_deadline && new Date(b.booking_deadline) < new Date() && b.status !== 'confirmed' && b.status !== 'cancelled';
  return (
    <button onClick={onOpen} className="bg-white border border-stone-200 rounded-2xl p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${M.color}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${S.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${S.dot}`} />{S.label}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_META[b.priority].color}`}>{PRIORITY_META[b.priority].label}</span>
            {overdue && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200"><AlertTriangle className="w-3 h-3" />Overdue</span>}
          </div>
          <div className="font-semibold text-teal-950 truncate">{b.title}</div>
          <div className="text-xs text-stone-500">{M.label}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-stone-600 mt-2">
        <div className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{b.booking_deadline ? formatDateTime(b.booking_deadline) : formatDate(b.travel_date)}</div>
        <div className="text-right font-semibold text-teal-950">{currencyFmt(Number(b.actual_cost) || Number(b.estimated_cost) || Number(b.cost) || 0, b.currency)}</div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <div className="w-5 h-5 rounded-full bg-amber-300 text-teal-950 flex items-center justify-center text-[10px] font-bold">{memberName(b.assigned_coordinator, members).charAt(0).toUpperCase()}</div>
          {memberName(b.assigned_coordinator, members)}
        </div>
        <div className="text-xs text-stone-600 inline-flex items-center gap-1"><User className="w-3 h-3" />{participants.length} travelers</div>
        {b.linked_expense_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">Linked</span>}
      </div>
    </button>
  );
}

function Checklist({ bookings, members, vaults, currency }: { bookings: Booking[]; members: MemberRow[]; vaults: Record<string, { pct: number }>; currency: string }) {
  const totalMembers = members.length;
  const completeProfiles = members.filter(m => (vaults[m.user_id]?.pct || 0) === 100).length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const total = bookings.length;
  const withAttach = bookings.filter(b => (b.attachments || []).length > 0).length;
  const withLinked = bookings.filter(b => b.linked_expense_id).length;
  const bookingPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const profilePct = totalMembers > 0 ? Math.round((completeProfiles / totalMembers) * 100) : 0;
  const docPct = total > 0 ? Math.round((withAttach / total) * 100) : 0;
  const overall = Math.round((bookingPct + profilePct + docPct) / 3);
  const overdue = bookings.filter(b => b.booking_deadline && new Date(b.booking_deadline) < new Date() && b.status !== 'confirmed' && b.status !== 'cancelled');

  return (
    <div className="space-y-5">
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-xl font-bold text-teal-950">Trip readiness</h3>
            <p className="text-sm text-stone-600">Auto-generated checklist based on bookings and traveler profiles.</p>
          </div>
          <div className="font-display text-3xl font-bold text-teal-900">{overall}%</div>
        </div>
        <div className="space-y-3">
          <Bar label="Bookings confirmed" value={bookingPct} detail={`${confirmed}/${total}`} />
          <Bar label="Traveler profiles complete" value={profilePct} detail={`${completeProfiles}/${totalMembers}`} />
          <Bar label="Confirmations attached" value={docPct} detail={`${withAttach}/${total}`} />
          <Bar label="Linked to expenses" value={total > 0 ? Math.round((withLinked / total) * 100) : 0} detail={`${withLinked}/${total}`} />
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h4 className="font-semibold text-teal-950 mb-3">Action items</h4>
        <ul className="space-y-2 text-sm">
          {overdue.map(b => (
            <li key={b.id} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
              <div>
                <div className="text-red-900 font-medium">{b.title} is overdue</div>
                <div className="text-xs text-red-700">Deadline was {formatDateTime(b.booking_deadline)} · coordinator: {memberName(b.assigned_coordinator, members)}</div>
              </div>
            </li>
          ))}
          {members.filter(m => (vaults[m.user_id]?.pct || 0) < 100).map(m => (
            <li key={m.user_id} className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <BadgeCheck className="w-4 h-4 text-amber-700 mt-0.5" />
              <div>
                <div className="text-amber-900 font-medium">{m.profile.full_name}'s vault is {vaults[m.user_id]?.pct || 0}% complete</div>
                <div className="text-xs text-amber-700">Finish the traveler vault for faster bookings.</div>
              </div>
            </li>
          ))}
          {bookings.filter(b => b.status === 'confirmed' && (b.attachments || []).length === 0).map(b => (
            <li key={b.id} className="flex items-start gap-2 p-2 bg-sky-50 border border-sky-200 rounded-lg">
              <ListChecks className="w-4 h-4 text-sky-700 mt-0.5" />
              <div>
                <div className="text-sky-900 font-medium">Attach confirmation for {b.title}</div>
                <div className="text-xs text-sky-700">Confirmed but no booking document attached yet.</div>
              </div>
            </li>
          ))}
          {overdue.length === 0 && completeProfiles === totalMembers && withAttach === total && total > 0 && (
            <li className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-teal-700" />
              <span className="text-teal-900 font-medium">Everything looks ready for travel.</span>
            </li>
          )}
          {total === 0 && <li className="text-stone-500 text-sm">No bookings yet.</li>}
        </ul>
      </div>

      <div className="text-xs text-stone-500">Trip currency: {currency}</div>
    </div>
  );
}

function Bar({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-teal-950">{label}</span>
        <span className="text-stone-600 text-xs">{detail} · {value}%</span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${value === 100 ? 'bg-teal-700' : value >= 60 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ActivityFeed({ logs, members, bookings }: { logs: BookingActivityLog[]; members: MemberRow[]; bookings: Booking[] }) {
  const titleOf = (id: string) => bookings.find(b => b.id === id)?.title || 'Booking';
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <h4 className="font-semibold text-teal-950 mb-3">Booking activity</h4>
      {logs.length === 0 ? <div className="text-sm text-stone-500">No booking activity yet.</div> : (
        <ul className="space-y-3">
          {logs.map(l => (
            <li key={l.id} className="flex items-start gap-3 text-sm border-b border-stone-100 pb-3 last:border-0">
              <div className="w-8 h-8 rounded-full bg-amber-300 text-teal-950 flex items-center justify-center text-xs font-bold flex-shrink-0">{memberName(l.performed_by, members).charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-teal-950"><span className="font-medium">{memberName(l.performed_by, members)}</span> · <span className="text-stone-600">{titleOf(l.booking_id)}</span></div>
                <div className="text-stone-700">{l.message}</div>
                <div className="text-[11px] text-stone-500">{timeAgo(l.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
