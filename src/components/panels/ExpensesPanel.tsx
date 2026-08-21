import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowRight, X, Loader2, Download, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Expense, ExpenseSplit, TripMember, Profile } from '../../lib/types';

type MemberRow = TripMember & { profile: Profile };
type SplitType = 'equal' | 'custom' | 'percentage';

export function ExpensesPanel({ tripId, currency, members }: { tripId: string; currency: string; members: MemberRow[] }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: exps } = await supabase.from('expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false });
    setExpenses(exps ?? []);
    const ids = (exps ?? []).map(e => e.id);
    if (ids.length) {
      const { data: sp } = await supabase.from('expense_splits').select('*').in('expense_id', ids);
      setSplits(sp ?? []);
    } else setSplits([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`expenses:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balances = computeBalances(expenses, splits, members);
  const settlements = settleBalances(balances);

  const categoryTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const catMax = Math.max(1, ...Object.values(categoryTotals));

  const remove = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
  };

  const toggleSettle = async (splitId: string, settled: boolean) => {
    await supabase.from('expense_splits').update({ settled: !settled, settled_at: !settled ? new Date().toISOString() : null }).eq('id', splitId);
  };

  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.profile.full_name || 'Member';

  const exportCsv = () => {
    const rows = [['Date', 'Title', 'Category', 'Paid by', 'Amount', 'Currency', 'Split']];
    expenses.forEach(e => {
      rows.push([e.expense_date, e.title, e.category, memberName(e.paid_by), String(e.amount), e.currency, e.split_type]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `expenses-${tripId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Expenses</h2>
          <p className="text-stone-600 text-sm">Track and split expenses with your group.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 bg-white border border-stone-300 text-teal-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-stone-50 transition">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
            <Plus className="w-4 h-4" /> Add expense
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-teal-900 rounded-2xl p-5 text-stone-50">
          <div className="text-xs uppercase tracking-wide text-amber-300 font-medium">Total spent</div>
          <div className="font-display text-3xl font-bold mt-1">{currency} {total.toLocaleString()}</div>
          <div className="text-xs text-stone-300 mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-stone-200">
          <div className="text-xs uppercase tracking-wide text-stone-500 font-medium mb-3">Who owes whom</div>
          {settlements.length === 0 ? (
            <div className="text-sm text-stone-500 italic">All settled up.</div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-teal-950">{memberName(s.from)}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                    <span className="font-medium text-teal-950">{memberName(s.to)}</span>
                  </div>
                  <span className="font-semibold text-amber-700">{currency} {s.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {Object.keys(categoryTotals).length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="text-xs uppercase tracking-wide text-stone-500 font-medium mb-3">By category</div>
          <div className="space-y-2">
            {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-20 text-xs text-stone-600 capitalize">{cat}</div>
                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-900 rounded-full transition-all" style={{ width: `${(amt / catMax) * 100}%` }} />
                </div>
                <div className="w-24 text-right text-xs font-medium text-teal-950">{currency} {amt.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-teal-900" /></div>
      ) : expenses.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-10 text-center text-stone-500 text-sm">
          No expenses yet. Add one to start tracking.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          {expenses.map((e, i) => {
            const mySplits = splits.filter(s => s.expense_id === e.id);
            return (
              <div key={e.id} className={`${i > 0 ? 'border-t border-stone-100' : ''}`}>
                <div className="flex items-center gap-4 p-4 hover:bg-stone-50 transition group">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-display font-bold text-sm">
                    {e.category.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-teal-950 truncate">{e.title}</div>
                    <div className="text-xs text-stone-500">
                      Paid by {memberName(e.paid_by)} · {new Date(e.expense_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-teal-950">{e.currency} {Number(e.amount).toFixed(2)}</div>
                    <div className="text-xs text-stone-500 capitalize">{e.split_type} split</div>
                  </div>
                  <button onClick={() => remove(e.id)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 transition p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {mySplits.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {mySplits.map(s => (
                      <button key={s.id} onClick={() => toggleSettle(s.id, s.settled)} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition ${s.settled ? 'bg-teal-100 text-teal-900' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                        {s.settled && <Check className="w-3 h-3" />}
                        {memberName(s.user_id)}: {e.currency} {Number(s.amount).toFixed(2)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddExpenseModal tripId={tripId} currency={currency} members={members} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} defaultPayer={user?.id ?? null} />}
    </div>
  );
}

function computeBalances(expenses: Expense[], splits: ExpenseSplit[], members: MemberRow[]) {
  const bal: Record<string, number> = {};
  members.forEach(m => { bal[m.user_id] = 0; });
  expenses.forEach((e) => {
    if (e.paid_by) bal[e.paid_by] = (bal[e.paid_by] ?? 0) + Number(e.amount);
  });
  splits.forEach((s) => {
    if (!s.settled) bal[s.user_id] = (bal[s.user_id] ?? 0) - Number(s.amount);
  });
  return bal;
}

function settleBalances(bal: Record<string, number>): { from: string; to: string; amount: number }[] {
  const creditors = Object.entries(bal).filter(([, v]) => v > 0.01).map(([k, v]) => ({ id: k, v }));
  const debtors = Object.entries(bal).filter(([, v]) => v < -0.01).map(([k, v]) => ({ id: k, v: -v }));
  const res: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    res.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v < 0.01) i++;
    if (creditors[j].v < 0.01) j++;
  }
  return res;
}

function AddExpenseModal({ tripId, currency, members, onClose, onAdded, defaultPayer }: {
  tripId: string; currency: string; members: MemberRow[]; onClose: () => void; onAdded: () => void; defaultPayer: string | null;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [payer, setPayer] = useState<string>(defaultPayer ?? members[0]?.user_id ?? '');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [included, setIncluded] = useState<Set<string>>(new Set(members.map(m => m.user_id)));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => {
    const n = new Set(included);
    n.has(id) ? n.delete(id) : n.add(id);
    setIncluded(n);
  };

  const amt = Number(amount) || 0;
  const ids = Array.from(included);
  const computedSplits = (() => {
    if (splitType === 'equal') {
      const share = ids.length ? amt / ids.length : 0;
      return ids.map(id => ({ user_id: id, amount: share }));
    }
    if (splitType === 'percentage') {
      return ids.map(id => ({ user_id: id, amount: amt * (Number(customAmounts[id] || 0) / 100) }));
    }
    return ids.map(id => ({ user_id: id, amount: Number(customAmounts[id] || 0) }));
  })();
  const splitTotal = computedSplits.reduce((s, r) => s + r.amount, 0);
  const splitDelta = amt - splitTotal;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amt || included.size === 0) return;
    if (splitType !== 'equal' && Math.abs(splitDelta) > 0.01) return;
    setLoading(true);
    const { data, error } = await supabase.from('expenses').insert({
      trip_id: tripId, title, category, amount: amt, currency,
      paid_by: payer, split_type: splitType, expense_date: new Date().toISOString().slice(0, 10),
    }).select().maybeSingle();
    if (error || !data) { setLoading(false); return; }
    const rows = computedSplits.map(s => ({ expense_id: data.id, user_id: s.user_id, amount: s.amount }));
    await supabase.from('expense_splits').insert(rows);
    setLoading(false);
    onAdded();
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950">Add expense</h3>
          <button onClick={onClose} aria-label="Close add expense dialog" className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">What was it for?</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Ramen-ya" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Amount ({currency})</label>
              <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
                {['food','transport','lodging','activity','shopping','other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Paid by</label>
            <select value={payer} onChange={(e) => setPayer(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Split method</label>
            <div className="grid grid-cols-3 gap-1 bg-stone-100 rounded-lg p-1">
              {(['equal', 'percentage', 'custom'] as SplitType[]).map(t => (
                <button key={t} type="button" onClick={() => setSplitType(t)} className={`text-xs px-2 py-1.5 rounded capitalize transition ${splitType === t ? 'bg-white text-teal-900 shadow' : 'text-stone-600'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {members.map((m) => (
                <label key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                  <input type="checkbox" checked={included.has(m.user_id)} onChange={() => toggle(m.user_id)} className="w-4 h-4 accent-teal-900" />
                  <span className="flex-1 text-sm text-teal-950">{m.profile.full_name}</span>
                  {splitType !== 'equal' && included.has(m.user_id) && (
                    <input
                      type="number" step="0.01"
                      value={customAmounts[m.user_id] ?? ''}
                      onChange={(e) => setCustomAmounts({ ...customAmounts, [m.user_id]: e.target.value })}
                      placeholder={splitType === 'percentage' ? '%' : currency}
                      className="w-24 px-2 py-1 border border-stone-300 rounded text-sm"
                    />
                  )}
                  {splitType === 'equal' && included.has(m.user_id) && ids.length > 0 && (
                    <span className="text-xs text-stone-500 w-24 text-right">{currency} {(amt / ids.length).toFixed(2)}</span>
                  )}
                </label>
              ))}
            </div>
            {splitType !== 'equal' && (
              <div className={`text-xs mt-1 ${Math.abs(splitDelta) < 0.01 ? 'text-teal-700' : 'text-red-600'}`}>
                {splitType === 'percentage' ? 'Total must equal 100%. ' : 'Total must equal amount. '}
                Remaining: {currency} {splitDelta.toFixed(2)}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}Add expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
