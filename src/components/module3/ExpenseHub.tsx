import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, Flag, Pencil, Trash2, Lock, Users, Receipt, Download, ArrowRight, AlertTriangle, Check, TrendingUp, ScrollText, BellRing, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Expense, ExpenseSplit, Trip, TripAlert, TripActivityLog, Profile, ExpenseDispute } from '../../lib/types';
import { CATEGORY_KEYS, CATEGORY_META } from './constants';
import { formatCurrency, computeBalances, optimizeSettlements, memberName, type MemberRow } from './utils';
import { AddExpenseModal } from './AddExpenseModal';
import { FlagModal } from './FlagModal';

type SubTab = 'ledger' | 'expenses' | 'settlements' | 'analytics' | 'alerts' | 'log';

export function ExpenseHub({ tripId, trip, members }: { tripId: string; trip: Trip; members: MemberRow[] }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<SubTab>('ledger');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [alerts, setAlerts] = useState<TripAlert[]>([]);
  const [disputes, setDisputes] = useState<ExpenseDispute[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [logs, setLogs] = useState<TripActivityLog[]>([]);
  const [logProfiles, setLogProfiles] = useState<Record<string, Profile>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [flagging, setFlagging] = useState<Expense | null>(null);

  const currency = trip.currency;

  const load = async () => {
    const [eRes, aRes, sRes, lRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false }),
      supabase.from('trip_alerts').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('settlements').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('trip_activity_logs').select('*').eq('trip_id', tripId).in('action_type', ['expense_added','expense_updated','expense_deleted','expense_flagged','settlement_created','settlement_paid','settlement_confirmed','alert']).order('created_at', { ascending: false }).limit(80),
    ]);
    const exps = (eRes.data ?? []) as Expense[];
    setExpenses(exps);
    setAlerts((aRes.data ?? []) as TripAlert[]);
    setSettlements((sRes.data ?? []) as SettlementRow[]);
    setLogs((lRes.data ?? []) as TripActivityLog[]);

    const ids = exps.map(e => e.id);
    if (ids.length) {
      const [spRes, dRes] = await Promise.all([
        supabase.from('expense_splits').select('*').in('expense_id', ids),
        supabase.from('expense_disputes').select('*').in('expense_id', ids),
      ]);
      setSplits(spRes.data ?? []);
      setDisputes((dRes.data ?? []) as ExpenseDispute[]);
    } else { setSplits([]); setDisputes([]); }

    const actorIds = [...new Set((lRes.data ?? []).map(l => l.actor_id))];
    if (actorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', actorIds);
      setLogProfiles(Object.fromEntries((profs ?? []).map(p => [p.id, p])));
    }
  };

  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`m3-hub:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_alerts', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_disputes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_activity_logs', filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const visibleExpenses = useMemo(
    () => expenses.filter(e => e.expense_type !== 'personal' || e.created_by === user?.id),
    [expenses, user?.id]
  );
  const groupExpenses = useMemo(() => visibleExpenses.filter(e => e.expense_type !== 'personal'), [visibleExpenses]);
  const balances = useMemo(() => computeBalances(groupExpenses, splits, members), [groupExpenses, splits, members]);
  const optimized = useMemo(() => optimizeSettlements(balances), [balances]);

  const tabs: { id: SubTab; label: string; icon: typeof Wallet; count?: number }[] = [
    { id: 'ledger', label: 'Ledger', icon: Wallet },
    { id: 'expenses', label: 'Expenses', icon: Receipt, count: visibleExpenses.length },
    { id: 'settlements', label: 'Settlements', icon: ArrowRight, count: settlements.filter(s => s.status === 'pending').length + optimized.length },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'alerts', label: 'Alerts', icon: BellRing, count: alerts.filter(a => !a.acknowledged).length },
    { id: 'log', label: 'Log', icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Expenses & settlements</h2>
          <p className="text-stone-600 text-sm">Collaborative financial coordination for your trip.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowAdd(true); }} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
          <Plus className="w-4 h-4" /> Add expense
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-white p-1 rounded-xl border border-stone-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.id ? 'bg-teal-900 text-stone-50' : 'text-stone-600 hover:bg-stone-100'}`}>
            <t.icon className="w-4 h-4" />{t.label}
            {t.count !== undefined && t.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-amber-300 text-teal-950' : 'bg-teal-900 text-stone-50'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'ledger' && <Ledger expenses={groupExpenses} balances={balances} members={members} currency={currency} trip={trip} optimized={optimized} />}
      {tab === 'expenses' && <ExpensesList expenses={visibleExpenses} splits={splits} members={members} currency={currency} disputes={disputes} onEdit={e => { setEditing(e); setShowAdd(true); }} onFlag={setFlagging} onDelete={async (e) => deleteExpense(e, user?.id ?? null, tripId)} userId={user?.id ?? null} ownerId={trip.owner_id} />}
      {tab === 'settlements' && <SettlementsView tripId={tripId} members={members} currency={currency} optimized={optimized} settlements={settlements} userId={user?.id ?? null} onChange={load} />}
      {tab === 'analytics' && <Analytics expenses={groupExpenses} members={members} balances={balances} currency={currency} budget={Number(trip.budget) || 0} start={trip.start_date} end={trip.end_date} />}
      {tab === 'alerts' && <AlertsView alerts={alerts} onChange={load} userId={user?.id ?? null} />}
      {tab === 'log' && <ActivityLogView logs={logs} profiles={logProfiles} />}

      {showAdd && <AddExpenseModal tripId={tripId} currency={currency} members={members} editing={editing} onClose={() => { setShowAdd(false); setEditing(null); }} onSaved={() => { setShowAdd(false); setEditing(null); load(); }} />}
      {flagging && <FlagModal expense={flagging} onClose={() => setFlagging(null)} onFlagged={() => { setFlagging(null); load(); }} />}
    </div>
  );
}

async function deleteExpense(expense: Expense, userId: string | null, tripId: string) {
  if (!userId) return;
  if (!confirm(`Delete "${expense.title}"? This cannot be undone.`)) return;
  await supabase.from('expenses').delete().eq('id', expense.id);
  await supabase.from('trip_activity_logs').insert({
    trip_id: tripId, actor_id: userId, action_type: 'expense_deleted',
    description: `Deleted expense "${expense.title}"`,
  });
}

type SettlementRow = {
  id: string; trip_id: string; group_id: string | null; from_user: string; to_user: string;
  amount: number; status: 'pending' | 'settled'; payment_method: string;
  created_at: string; settled_at: string | null; marked_paid_by: string | null;
  confirmed_by: string | null; marked_paid_at: string | null; notes: string;
};

// ========== LEDGER ==========
function Ledger({ expenses, balances, members, currency, trip, optimized }: {
  expenses: Expense[]; balances: ReturnType<typeof computeBalances>; members: MemberRow[]; currency: string; trip: Trip; optimized: ReturnType<typeof optimizeSettlements>;
}) {
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const budget = Number(trip.budget) || 0;
  const pct = budget > 0 ? (total / budget) * 100 : 0;
  const start = trip.start_date ? new Date(trip.start_date) : null;
  const end = trip.end_date ? new Date(trip.end_date) : null;
  const days = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1) : 1;
  const avgPerDay = total / days;
  const dateRange = start && end ? `${start.toLocaleDateString()} – ${end.toLocaleDateString()}` : 'Trip dates TBD';

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2 bg-teal-900 text-stone-50 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wide text-amber-300">Total group spending</div>
          <div className="font-display text-4xl font-bold mt-1">{formatCurrency(total, currency)}</div>
          <div className="text-xs text-stone-300 mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · {dateRange}</div>
          {budget > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-stone-200 mb-1">
                <span>Budget: {formatCurrency(budget, currency)}</span>
                <span className={pct > 100 ? 'text-red-300' : 'text-amber-200'}>{pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct > 100 ? 'bg-red-400' : 'bg-amber-300'}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="text-xs uppercase tracking-wide text-stone-500">Avg / day</div>
          <div className="font-display text-2xl font-bold text-teal-950 mt-1">{formatCurrency(avgPerDay, currency)}</div>
          <div className="text-xs text-stone-500 mt-1">over {days} day{days !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="text-xs uppercase tracking-wide text-stone-500">Members</div>
          <div className="font-display text-2xl font-bold text-teal-950 mt-1">{members.length}</div>
          <div className="text-xs text-stone-500 mt-1">sharing expenses</div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold text-teal-950 mb-3">Individual contributions</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {members.map(m => {
            const b = balances[m.user_id] ?? { paid: 0, owed: 0, net: 0 };
            const contribPct = total > 0 ? (b.paid / total) * 100 : 0;
            return (
              <div key={m.user_id} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-teal-900 text-amber-300 flex items-center justify-center font-bold">
                    {(m.profile.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-teal-950 truncate">{m.profile.full_name}</div>
                    <div className="text-xs text-stone-500">{contribPct.toFixed(0)}% of total</div>
                  </div>
                  <div className={`text-right font-bold ${b.net > 0.01 ? 'text-emerald-700' : b.net < -0.01 ? 'text-red-700' : 'text-stone-500'}`}>
                    {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net, currency)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-stone-50 rounded-lg p-2">
                    <div className="text-stone-500">Paid</div>
                    <div className="font-semibold text-teal-950">{formatCurrency(b.paid, currency)}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-2">
                    <div className="text-stone-500">Share</div>
                    <div className="font-semibold text-teal-950">{formatCurrency(b.owed, currency)}</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-900" style={{ width: `${Math.min(100, contribPct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold text-teal-950 mb-3">Optimized settlements</h3>
        {optimized.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center text-stone-500 text-sm">All balanced. No settlements needed.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {optimized.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">
                  {memberName(s.from, members).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="font-medium text-teal-950">{memberName(s.from, members)}</span>
                  <span className="text-stone-500"> owes </span>
                  <span className="font-medium text-teal-950">{memberName(s.to, members)}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400" />
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                  {memberName(s.to, members).charAt(0).toUpperCase()}
                </div>
                <div className="font-bold text-amber-700 whitespace-nowrap">{formatCurrency(s.amount, currency)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== EXPENSES LIST ==========
function ExpensesList({ expenses, splits, members, currency, disputes, onEdit, onFlag, onDelete, userId, ownerId }: {
  expenses: Expense[]; splits: ExpenseSplit[]; members: MemberRow[]; currency: string;
  disputes: ExpenseDispute[];
  onEdit: (e: Expense) => void; onFlag: (e: Expense) => void; onDelete: (e: Expense) => void;
  userId: string | null; ownerId: string;
}) {
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState<string>('all');
  const [fType, setFType] = useState<'all' | 'personal' | 'group'>('all');
  const [fPayer, setFPayer] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');

  const filtered = expenses.filter(e => {
    if (q && !(e.title.toLowerCase().includes(q.toLowerCase()) || e.notes?.toLowerCase().includes(q.toLowerCase()))) return false;
    if (fCat !== 'all' && e.category !== fCat) return false;
    if (fType !== 'all' && (fType === 'personal' ? e.expense_type !== 'personal' : e.expense_type === 'personal')) return false;
    if (fPayer !== 'all' && e.paid_by !== fPayer) return false;
    if (fStatus !== 'all' && e.status !== fStatus) return false;
    return true;
  });

  const canEdit = (e: Expense) => e.created_by === userId || e.paid_by === userId || userId === ownerId;

  const exportCsv = () => {
    const rows = [['Date', 'Title', 'Category', 'Type', 'Paid by', 'Amount', 'Currency', 'Status']];
    filtered.forEach(e => rows.push([e.expense_date, e.title, e.category, e.expense_type, memberName(e.paid_by, members), String(e.amount), e.currency, e.status]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'expenses.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-3 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm" />
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-teal-900"><Download className="w-4 h-4" />CSV</button>
        </div>
        <div className="flex gap-2 flex-wrap text-sm">
          <div className="inline-flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-stone-500" /></div>
          <select value={fCat} onChange={e => setFCat(e.target.value)} className="px-2 py-1 border border-stone-200 rounded bg-white text-xs capitalize">
            <option value="all">All categories</option>
            {CATEGORY_KEYS.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
          <select value={fType} onChange={e => setFType(e.target.value as 'all' | 'personal' | 'group')} className="px-2 py-1 border border-stone-200 rounded bg-white text-xs">
            <option value="all">All types</option><option value="group">Group</option><option value="personal">Personal</option>
          </select>
          <select value={fPayer} onChange={e => setFPayer(e.target.value)} className="px-2 py-1 border border-stone-200 rounded bg-white text-xs">
            <option value="all">Any payer</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="px-2 py-1 border border-stone-200 rounded bg-white text-xs">
            <option value="all">All statuses</option><option value="normal">Normal</option><option value="flagged">Flagged</option><option value="under_review">Under review</option><option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center text-stone-500 text-sm">
          No expenses match your filters. {expenses.length === 0 && 'Add one to start tracking.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => {
            const meta = CATEGORY_META[(e.category as keyof typeof CATEGORY_META)] ?? CATEGORY_META.other;
            const Icon = meta.icon;
            const mySplits = splits.filter(s => s.expense_id === e.id);
            const flag = disputes.find(d => d.expense_id === e.id && d.status === 'open');
            const isPersonal = e.expense_type === 'personal';
            return (
              <div key={e.id} className={`bg-white rounded-xl border ${e.status === 'flagged' ? 'border-amber-300' : 'border-stone-200'} p-4 hover:shadow-md transition`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-teal-950 truncate">{e.title}</h4>
                          {isPersonal && <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full"><Lock className="w-2.5 h-2.5" />Private</span>}
                          {e.status === 'flagged' && <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full"><Flag className="w-2.5 h-2.5" />Flagged</span>}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          {memberName(e.paid_by, members)} · {new Date(e.expense_date).toLocaleDateString()} · <span className={`inline-flex items-center gap-0.5 ${meta.color.split(' ')[1]}`}>{meta.label}</span>
                          {!isPersonal && mySplits.length > 0 && <> · <span className="inline-flex items-center gap-0.5"><Users className="w-3 h-3" />Split among {mySplits.length}</span></>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-teal-950">{formatCurrency(Number(e.amount), currency)}</div>
                        <div className="text-[10px] text-stone-500 capitalize">{e.split_type} split</div>
                      </div>
                    </div>
                    {e.notes && <p className="text-xs text-stone-600 mt-1 line-clamp-2">{e.notes}</p>}
                    {flag && <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">Flagged: {flag.reason}</div>}
                    {e.receipt_urls && e.receipt_urls.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {e.receipt_urls.slice(0, 4).map((r, i) => (
                          <img key={i} src={r} alt="" className="w-12 h-12 rounded border border-stone-200 object-cover" />
                        ))}
                      </div>
                    )}
                    {!isPersonal && mySplits.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {mySplits.map(s => (
                          <span key={s.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${s.settled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>
                            {s.settled && <Check className="w-2.5 h-2.5" />}
                            {memberName(s.user_id, members)}: {formatCurrency(Number(s.amount), currency)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      {!isPersonal && <button onClick={() => onFlag(e)} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:bg-amber-50 px-2 py-1 rounded transition"><Flag className="w-3 h-3" />Flag</button>}
                      {canEdit(e) && <button onClick={() => onEdit(e)} className="inline-flex items-center gap-1 text-xs text-teal-900 hover:bg-stone-100 px-2 py-1 rounded transition"><Pencil className="w-3 h-3" />Edit</button>}
                      {canEdit(e) && <button onClick={() => onDelete(e)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition"><Trash2 className="w-3 h-3" />Delete</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== SETTLEMENTS ==========
function SettlementsView({ tripId, members, currency, optimized, settlements, userId, onChange }: {
  tripId: string; members: MemberRow[]; currency: string;
  optimized: { from: string; to: string; amount: number }[];
  settlements: SettlementRow[]; userId: string | null; onChange: () => void;
}) {
  const [mode, setMode] = useState<'optimized' | 'pending' | 'history'>('optimized');

  const pending = settlements.filter(s => s.status === 'pending');
  const done = settlements.filter(s => s.status === 'settled');

  const initiate = async (from: string, to: string, amount: number, payment_method: string) => {
    if (!userId) return;
    const { data } = await supabase.from('settlements').insert({
      trip_id: tripId, from_user: from, to_user: to, amount, status: 'pending', payment_method, marked_paid_by: userId, marked_paid_at: new Date().toISOString(),
    }).select().maybeSingle();
    if (data) {
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: userId, action_type: 'settlement_paid',
        description: `${memberName(from, members)} marked ${formatCurrency(amount, currency)} as paid to ${memberName(to, members)} via ${payment_method}`,
        related_entity_type: 'settlement', related_entity_id: data.id,
      });
      await supabase.from('notifications').insert({
        user_id: to, trip_id: tripId, type: 'settlement',
        title: 'Settlement awaiting confirmation',
        body: `${memberName(from, members)} marked ${formatCurrency(amount, currency)} as paid. Please confirm receipt.`,
      });
    }
    onChange();
  };

  const confirm = async (s: SettlementRow) => {
    if (!userId) return;
    await supabase.from('settlements').update({ status: 'settled', settled_at: new Date().toISOString(), confirmed_by: userId }).eq('id', s.id);
    await supabase.from('trip_activity_logs').insert({
      trip_id: tripId, actor_id: userId, action_type: 'settlement_confirmed',
      description: `${memberName(s.to_user, members)} confirmed receipt of ${formatCurrency(Number(s.amount), currency)} from ${memberName(s.from_user, members)}`,
      related_entity_type: 'settlement', related_entity_id: s.id,
    });
    await supabase.from('notifications').insert({
      user_id: s.from_user, trip_id: tripId, type: 'settlement',
      title: 'Settlement confirmed',
      body: `${memberName(s.to_user, members)} confirmed receipt of ${formatCurrency(Number(s.amount), currency)}`,
    });
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit">
        {(['optimized', 'pending', 'history'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} className={`text-xs px-3 py-1.5 rounded capitalize transition ${mode === m ? 'bg-white text-teal-900 shadow' : 'text-stone-600'}`}>
            {m === 'pending' ? `Pending (${pending.length})` : m === 'history' ? `History (${done.length})` : 'Optimized'}
          </button>
        ))}
      </div>

      {mode === 'optimized' && (
        <>
          {optimized.length === 0 ? (
            <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center">
              <Check className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <div className="font-display font-semibold text-teal-950">All settled up</div>
              <p className="text-sm text-stone-500 mt-1">No outstanding balances in the group.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {optimized.map((s, i) => (
                <SettlementInitiator key={i} from={s.from} to={s.to} amount={s.amount} members={members} currency={currency} currentUser={userId} onInitiate={initiate} />
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'pending' && (
        pending.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center text-stone-500 text-sm">No pending settlements.</div>
        ) : (
          <div className="space-y-2">
            {pending.map(s => (
              <PendingSettlement key={s.id} s={s} members={members} currency={currency} userId={userId} onConfirm={confirm} />
            ))}
          </div>
        )
      )}

      {mode === 'history' && (
        done.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center text-stone-500 text-sm">No settlement history yet.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {done.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="font-medium text-teal-950">{memberName(s.from_user, members)}</span>
                  <span className="text-stone-500"> paid </span>
                  <span className="font-medium text-teal-950">{memberName(s.to_user, members)}</span>
                  <span className="text-stone-500"> · {s.payment_method || 'Cash'}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700">{formatCurrency(Number(s.amount), currency)}</div>
                  <div className="text-[10px] text-stone-500">{s.settled_at ? new Date(s.settled_at).toLocaleDateString() : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function SettlementInitiator({ from, to, amount, members, currency, currentUser, onInitiate }: {
  from: string; to: string; amount: number; members: MemberRow[]; currency: string; currentUser: string | null;
  onInitiate: (from: string, to: string, amount: number, payment_method: string) => void;
}) {
  const [method, setMethod] = useState('UPI');
  const isDebtor = from === currentUser;
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">{memberName(from, members).charAt(0).toUpperCase()}</div>
        <div className="text-sm min-w-0">
          <div className="font-medium text-teal-950 truncate">{memberName(from, members)} <ArrowRight className="w-3 h-3 inline text-stone-400" /> {memberName(to, members)}</div>
          <div className="text-xs text-amber-700 font-semibold">{formatCurrency(amount, currency)}</div>
        </div>
      </div>
      {isDebtor ? (
        <>
          <select value={method} onChange={e => setMethod(e.target.value)} className="px-2 py-1.5 border border-stone-300 rounded-lg text-sm bg-white">
            <option>UPI</option><option>Cash</option><option>Bank Transfer</option><option>Other</option>
          </select>
          <button onClick={() => onInitiate(from, to, amount, method)} className="text-sm bg-teal-900 text-stone-50 px-3 py-1.5 rounded-lg hover:bg-teal-800 transition">Settle now</button>
        </>
      ) : (
        <span className="text-xs text-stone-500 italic">Waiting on debtor</span>
      )}
    </div>
  );
}

function PendingSettlement({ s, members, currency, userId, onConfirm }: {
  s: SettlementRow; members: MemberRow[]; currency: string; userId: string | null; onConfirm: (s: SettlementRow) => void;
}) {
  const canConfirm = s.to_user === userId;
  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">{memberName(s.from_user, members).charAt(0).toUpperCase()}</div>
        <div className="text-sm min-w-0">
          <div className="font-medium text-teal-950 truncate">{memberName(s.from_user, members)} <ArrowRight className="w-3 h-3 inline text-stone-400" /> {memberName(s.to_user, members)}</div>
          <div className="text-xs text-stone-500">Marked paid {s.marked_paid_at ? new Date(s.marked_paid_at).toLocaleString() : ''} via {s.payment_method || 'Cash'}</div>
        </div>
      </div>
      <div className="font-bold text-amber-700">{formatCurrency(Number(s.amount), currency)}</div>
      {canConfirm ? (
        <button onClick={() => onConfirm(s)} className="inline-flex items-center gap-1 text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition">
          <Check className="w-4 h-4" />Confirm receipt
        </button>
      ) : (
        <span className="text-xs text-stone-500 italic">Awaiting creditor</span>
      )}
    </div>
  );
}

// ========== ANALYTICS ==========
function Analytics({ expenses, members, balances, currency, budget, start, end }: {
  expenses: Expense[]; members: MemberRow[]; balances: ReturnType<typeof computeBalances>; currency: string;
  budget: number; start: string | null; end: string | null;
}) {
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = CATEGORY_KEYS.map(c => ({
    key: c, label: CATEGORY_META[c].label, color: CATEGORY_META[c].chipColor,
    amount: expenses.filter(e => e.category === c).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const contributions = members.map(m => ({
    name: m.profile.full_name, amount: balances[m.user_id]?.paid ?? 0,
  })).sort((a, b) => b.amount - a.amount);
  const maxContrib = Math.max(1, ...contributions.map(c => c.amount));

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const dayMap = new Map<string, number>();
  expenses.forEach(e => {
    const d = e.expense_date;
    dayMap.set(d, (dayMap.get(d) ?? 0) + Number(e.amount));
  });
  const dayKeys = [...dayMap.keys()].sort();
  const maxDay = Math.max(1, ...dayMap.values());

  // Pie chart
  let cumulative = 0;
  const pieSize = 160, r = 70, cx = pieSize / 2, cy = pieSize / 2;
  const pieSegments = byCategory.map(c => {
    const pct = c.amount / total;
    const start = cumulative * Math.PI * 2;
    const end = (cumulative + pct) * Math.PI * 2;
    cumulative += pct;
    const x1 = cx + r * Math.sin(start), y1 = cy - r * Math.cos(start);
    const x2 = cx + r * Math.sin(end), y2 = cy - r * Math.cos(end);
    const large = pct > 0.5 ? 1 : 0;
    return { key: c.key, color: c.color, pct, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z` };
  });

  const over = budget > 0 && total > budget;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-display font-semibold text-teal-950 mb-3">Spending distribution</h3>
        {byCategory.length === 0 ? (
          <div className="text-sm text-stone-500 italic">No spending yet.</div>
        ) : (
          <div className="flex items-center gap-4">
            <svg viewBox={`0 0 ${pieSize} ${pieSize}`} className="w-40 h-40 flex-shrink-0">
              {pieSegments.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} className={pieSegments[0].color} />
              ) : pieSegments.map(s => <path key={s.key} d={s.path} className={s.color} />)}
            </svg>
            <div className="flex-1 space-y-1.5 text-sm">
              {byCategory.map(c => (
                <div key={c.key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${c.color}`} />
                  <div className="flex-1 capitalize text-stone-700">{c.label}</div>
                  <div className="text-xs font-medium text-teal-950">{((c.amount / total) * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-display font-semibold text-teal-950 mb-3">Contribution analysis</h3>
        <div className="space-y-2">
          {contributions.map(c => (
            <div key={c.name}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-stone-700">{c.name}</span>
                <span className="font-medium text-teal-950">{formatCurrency(c.amount, currency)} · {total > 0 ? ((c.amount / total) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-900 rounded-full transition-all" style={{ width: `${(c.amount / maxContrib) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-display font-semibold text-teal-950 mb-3">Daily spending trend</h3>
        {dayKeys.length === 0 ? (
          <div className="text-sm text-stone-500 italic">No daily data yet.</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {dayKeys.map(d => {
              const v = dayMap.get(d) ?? 0;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full bg-teal-900 rounded-t hover:bg-teal-800 transition" style={{ height: `${(v / maxDay) * 100}%` }} title={`${d}: ${formatCurrency(v, currency)}`} />
                </div>
              );
            })}
          </div>
        )}
        <div className="text-[10px] text-stone-400 mt-2">{startDate ? startDate.toLocaleDateString() : ''} — {endDate ? endDate.toLocaleDateString() : ''}</div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <h3 className="font-display font-semibold text-teal-950 mb-3">Budget vs actual</h3>
        {budget > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <div className="text-xs text-stone-500">Actual</div>
                <div className="font-display text-2xl font-bold text-teal-950">{formatCurrency(total, currency)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-stone-500">Budget</div>
                <div className="font-display text-xl font-semibold text-stone-700">{formatCurrency(budget, currency)}</div>
              </div>
            </div>
            <div className="h-3 bg-stone-100 rounded-full overflow-hidden relative">
              <div className={`h-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} />
            </div>
            <div className={`text-sm mt-2 font-medium ${over ? 'text-red-700' : 'text-emerald-700'}`}>
              {over ? `+${formatCurrency(total - budget, currency)} over budget (${(((total - budget) / budget) * 100).toFixed(0)}% over)` : `${formatCurrency(budget - total, currency)} under budget`}
            </div>
          </>
        ) : (
          <div className="text-sm text-stone-500 italic">Set a trip budget to compare.</div>
        )}
      </div>
    </div>
  );
}

// ========== ALERTS ==========
function AlertsView({ alerts, onChange, userId }: { alerts: TripAlert[]; onChange: () => void; userId: string | null }) {
  const ack = async (id: string) => {
    if (!userId) return;
    await supabase.from('trip_alerts').update({ acknowledged: true, acknowledged_by: userId }).eq('id', id);
    onChange();
  };
  const active = alerts.filter(a => !a.acknowledged);
  const done = alerts.filter(a => a.acknowledged);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-semibold text-teal-950 mb-2">Active alerts ({active.length})</h3>
        {active.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center text-stone-500 text-sm">No active alerts. All good.</div>
        ) : (
          <div className="space-y-2">
            {active.map(a => (
              <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.severity === 'high' ? 'text-red-600' : 'text-amber-700'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-teal-950">{a.message}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5 capitalize">{a.alert_type.replace(/_/g, ' ')} · {a.severity} · {new Date(a.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => ack(a.id)} className="text-xs bg-white border border-stone-200 hover:bg-stone-50 text-teal-900 px-2 py-1 rounded transition">Acknowledge</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {done.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-teal-950 mb-2">Acknowledged</h3>
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {done.slice(0, 20).map(a => (
              <div key={a.id} className="p-3 text-sm text-stone-500 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <div className="flex-1 min-w-0 truncate">{a.message}</div>
                <div className="text-[10px] text-stone-400">{new Date(a.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== ACTIVITY LOG ==========
function ActivityLogView({ logs, profiles }: { logs: TripActivityLog[]; profiles: Record<string, Profile> }) {
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(d).toLocaleDateString();
  };

  const exportCsv = () => {
    const rows = [['Timestamp', 'Actor', 'Action', 'Description']];
    logs.forEach(l => rows.push([l.created_at, profiles[l.actor_id]?.full_name ?? l.actor_id, l.action_type, l.description]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'financial-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-teal-900">
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>
      {logs.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center text-stone-500 text-sm">No financial activity yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
          {logs.map(l => {
            const actor = profiles[l.actor_id];
            return (
              <div key={l.id} className="flex items-start gap-3 p-3 hover:bg-stone-50 transition">
                <div className="w-8 h-8 rounded-full bg-teal-900 text-amber-300 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  {(actor?.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-teal-950"><span className="font-semibold">{actor?.full_name ?? 'Someone'}</span> <span className="text-stone-600">· {l.description}</span></div>
                  <div className="text-[10px] text-stone-400 mt-0.5 capitalize">{l.action_type.replace(/_/g, ' ')} · {timeAgo(l.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
