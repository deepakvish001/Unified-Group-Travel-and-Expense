import { useState } from 'react';
import { X, Loader2, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { ExpenseCategory, ExpenseType, Expense } from '../../lib/types';
import { CATEGORY_KEYS, CATEGORY_META } from './constants';
import { formatCurrency, type MemberRow } from './utils';

type SplitType = 'equal' | 'custom' | 'percentage';

export function AddExpenseModal({ tripId, currency, members, onClose, onSaved, editing }: {
  tripId: string; currency: string; members: MemberRow[]; onClose: () => void; onSaved: () => void; editing?: Expense | null;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState<ExpenseCategory>((editing?.category as ExpenseCategory) ?? 'food');
  const [payer, setPayer] = useState<string>(editing?.paid_by ?? user?.id ?? members[0]?.user_id ?? '');
  const [expenseType, setExpenseType] = useState<ExpenseType>(editing?.expense_type ?? 'group');
  const [splitType, setSplitType] = useState<SplitType>(editing?.split_type ?? 'equal');
  const [date, setDate] = useState(editing?.expense_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptUrls, setReceiptUrls] = useState<string[]>(editing?.receipt_urls ?? []);
  const [included, setIncluded] = useState<Set<string>>(new Set(members.map(m => m.user_id)));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) => {
    const n = new Set(included);
    if (n.has(id)) n.delete(id); else n.add(id);
    setIncluded(n);
  };

  const amt = Number(amount) || 0;
  const ids = Array.from(included);
  const computed = (() => {
    if (expenseType === 'personal') return [{ user_id: user?.id ?? '', amount: amt }];
    if (splitType === 'equal') {
      const share = ids.length ? amt / ids.length : 0;
      return ids.map(id => ({ user_id: id, amount: share }));
    }
    if (splitType === 'percentage') {
      return ids.map(id => ({ user_id: id, amount: amt * (Number(customAmounts[id] || 0) / 100) }));
    }
    return ids.map(id => ({ user_id: id, amount: Number(customAmounts[id] || 0) }));
  })();
  const splitTotal = computed.reduce((s, r) => s + r.amount, 0);
  const splitDelta = amt - splitTotal;
  const splitOk = expenseType === 'personal' || splitType === 'equal' || Math.abs(splitDelta) < 0.01;

  const addReceipt = () => {
    const url = receiptUrl.trim();
    if (!url) return;
    setReceiptUrls([...receiptUrls, url]);
    setReceiptUrl('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!amt) { setErr('Amount required'); return; }
    if (expenseType === 'group' && included.size === 0) { setErr('Select at least one participant'); return; }
    if (!splitOk) { setErr('Split total must equal expense amount'); return; }
    setLoading(true); setErr(null);

    try {
      let expenseId = editing?.id;
      if (editing) {
        await supabase.from('expenses').update({
          title, amount: amt, category, paid_by: payer, expense_type: expenseType, split_type: splitType,
          expense_date: date, notes, receipt_urls: receiptUrls,
          last_edited_by: user.id,
        }).eq('id', editing.id);
        await supabase.from('expense_splits').delete().eq('expense_id', editing.id);
      } else {
        const { data, error } = await supabase.from('expenses').insert({
          trip_id: tripId, title, amount: amt, currency, category,
          paid_by: payer, expense_type: expenseType, split_type: splitType,
          expense_date: date, notes, receipt_urls: receiptUrls,
          status: 'normal', created_by: user.id,
        }).select().maybeSingle();
        if (error || !data) throw error || new Error('failed');
        expenseId = data.id;
      }
      if (expenseType === 'group' && expenseId) {
        const rows = computed.filter(r => r.user_id).map(r => ({
          expense_id: expenseId, user_id: r.user_id, amount: r.amount,
        }));
        if (rows.length) await supabase.from('expense_splits').insert(rows);
      }

      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id,
        action_type: editing ? 'expense_updated' : 'expense_added',
        description: `${editing ? 'Updated' : 'Added'} ${expenseType === 'personal' ? 'personal' : 'shared'} ${category} expense "${title}" (${formatCurrency(amt, currency)})`,
        related_entity_type: 'expense', related_entity_id: expenseId,
      });

      if (!editing && expenseType === 'group') {
        await runSmartAlerts(tripId, { title, amount: amt, category, paid_by: payer });
        const otherIds = Array.from(included).filter(id => id !== user.id);
        if (otherIds.length) {
          const share = splitType === 'equal' ? amt / ids.length : 0;
          const notifRows = otherIds.map(uid => ({
            user_id: uid, trip_id: tripId, type: 'expense',
            title: 'New shared expense',
            body: `${memberNameOf(payer, members)} added ${formatCurrency(amt, currency)} "${title}"${share ? ` – your share: ${formatCurrency(share, currency)}` : ''}`,
          }));
          await supabase.from('notifications').insert(notifRows);
        }
      }

      setLoading(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message || 'Failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950">{editing ? 'Edit expense' : 'Add expense'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-lg">
            <button type="button" onClick={() => setExpenseType('group')} className={`text-sm py-2 rounded-md font-medium transition ${expenseType === 'group' ? 'bg-white text-teal-900 shadow' : 'text-stone-600'}`}>Group shared</button>
            <button type="button" onClick={() => setExpenseType('personal')} className={`text-sm py-2 rounded-md font-medium transition ${expenseType === 'personal' ? 'bg-white text-teal-900 shadow' : 'text-stone-600'}`}>Personal (private)</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Title</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Dinner at Ramen-ya" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Amount ({currency})</label>
              <input required type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORY_KEYS.map(c => {
                const meta = CATEGORY_META[c];
                const Icon = meta.icon;
                const active = category === c;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)} className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition ${active ? 'border-teal-800 bg-teal-50' : 'border-stone-200 hover:border-stone-300'}`}>
                    <Icon className="w-4 h-4 text-teal-900" />
                    <span className="text-[10px] font-medium text-teal-950">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Paid by</label>
            <select value={payer} onChange={e => setPayer(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
            </select>
          </div>

          {expenseType === 'group' && (
            <>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Split method</label>
                <div className="grid grid-cols-3 gap-1 bg-stone-100 rounded-lg p-1">
                  {(['equal', 'percentage', 'custom'] as SplitType[]).map(t => (
                    <button key={t} type="button" onClick={() => setSplitType(t)} className={`text-xs py-1.5 rounded capitalize transition ${splitType === t ? 'bg-white text-teal-900 shadow' : 'text-stone-600'}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Participants</label>
                <div className="space-y-1 max-h-44 overflow-y-auto border border-stone-200 rounded-lg p-2">
                  {members.map(m => {
                    const inc = included.has(m.user_id);
                    return (
                      <label key={m.user_id} className="flex items-center gap-3 p-1.5 rounded hover:bg-stone-50 cursor-pointer">
                        <input type="checkbox" checked={inc} onChange={() => toggle(m.user_id)} className="w-4 h-4 accent-teal-900" />
                        <span className={`flex-1 text-sm ${inc ? 'text-teal-950' : 'text-stone-400 line-through'}`}>{m.profile.full_name}</span>
                        {inc && splitType !== 'equal' && (
                          <input type="number" step="0.01" value={customAmounts[m.user_id] ?? ''}
                            onChange={e => setCustomAmounts({ ...customAmounts, [m.user_id]: e.target.value })}
                            placeholder={splitType === 'percentage' ? '%' : currency}
                            className="w-24 px-2 py-1 border border-stone-300 rounded text-sm" />
                        )}
                        {inc && splitType === 'equal' && ids.length > 0 && (
                          <span className="text-xs text-stone-500 w-24 text-right">{formatCurrency(amt / ids.length, currency)}</span>
                        )}
                        {!inc && <span className="text-[10px] text-stone-400">Not involved</span>}
                      </label>
                    );
                  })}
                </div>
                {splitType !== 'equal' && (
                  <div className={`text-xs mt-1 ${splitOk ? 'text-teal-700' : 'text-red-600'}`}>
                    {splitType === 'percentage' ? 'Total must equal 100%. ' : 'Total must equal amount. '}
                    Remaining: {formatCurrency(splitDelta, currency)}
                  </div>
                )}
              </div>

              {amt > 0 && included.size > 0 && splitOk && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-900">
                  <div className="font-semibold mb-1">Preview</div>
                  <div>{memberNameOf(payer, members)} paid {formatCurrency(amt, currency)}.</div>
                  <div className="mt-1 space-y-0.5">
                    {computed.filter(c => c.user_id !== payer).map(c => (
                      <div key={c.user_id}>{memberNameOf(c.user_id, members)} owes {formatCurrency(c.amount, currency)}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Receipts (image URLs)</label>
            <div className="flex gap-2">
              <input value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm" />
              <button type="button" onClick={addReceipt} className="inline-flex items-center gap-1 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-teal-900">
                <Upload className="w-4 h-4" /> Add
              </button>
            </div>
            {receiptUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {receiptUrls.map((r, i) => (
                  <div key={i} className="relative group">
                    <img src={r} alt="" className="w-16 h-16 rounded-lg object-cover border border-stone-200" onError={(e) => { (e.target as HTMLImageElement).src = '';(e.target as HTMLImageElement).style.background = '#f5f5f4'; }} />
                    <button type="button" onClick={() => setReceiptUrls(receiptUrls.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {receiptUrls.length === 0 && <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-1"><ImageIcon className="w-3 h-3" /> No receipts attached</div>}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional description" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          </div>

          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function memberNameOf(id: string | null, members: MemberRow[]): string {
  if (!id) return 'Unknown';
  return members.find(m => m.user_id === id)?.profile.full_name || 'Member';
}

async function runSmartAlerts(tripId: string, e: { title: string; amount: number; category: string; paid_by: string }) {
  const { data: trip } = await supabase.from('trips').select('budget, currency').eq('id', tripId).maybeSingle();
  const budget = Number(trip?.budget ?? 0);
  if (budget > 0 && e.amount > budget * 0.3) {
    await supabase.from('trip_alerts').insert({
      trip_id: tripId, alert_type: 'high_value', severity: 'high',
      message: `High-value expense: ${e.title} is ${((e.amount / budget) * 100).toFixed(0)}% of trip budget`,
    });
  }
  const { data: recent } = await supabase.from('expenses').select('title,amount,category,expense_date')
    .eq('trip_id', tripId).eq('category', e.category)
    .gte('expense_date', new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10));
  const dup = (recent ?? []).find(r => r.title !== e.title && Math.abs(Number(r.amount) - e.amount) < 0.01);
  if (dup) {
    await supabase.from('trip_alerts').insert({
      trip_id: tripId, alert_type: 'duplicate', severity: 'medium',
      message: `Possible duplicate of "${dup.title}" (${e.category})`,
    });
  }
}
