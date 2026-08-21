import { useState } from 'react';
import { X, Loader2, Flag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Expense } from '../../lib/types';

const REASONS = [
  "I wasn't part of this expense",
  'Amount seems incorrect',
  'Wrong category',
  'Duplicate expense',
  'Receipt required',
  'Other',
];

export function FlagModal({ expense, onClose, onFlagged }: { expense: Expense; onClose: () => void; onFlagged: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const finalReason = reason === 'Other' ? comment.trim() || 'Other' : reason;
    await supabase.from('expense_disputes').insert({
      expense_id: expense.id, raised_by: user.id, reason: finalReason,
    });
    await supabase.from('expenses').update({ status: 'flagged' }).eq('id', expense.id);
    await supabase.from('trip_activity_logs').insert({
      trip_id: expense.trip_id, actor_id: user.id, action_type: 'expense_flagged',
      description: `Flagged expense "${expense.title}" – ${finalReason}`,
      related_entity_type: 'expense', related_entity_id: expense.id,
    });
    if (expense.created_by && expense.created_by !== user.id) {
      await supabase.from('notifications').insert({
        user_id: expense.created_by, trip_id: expense.trip_id, type: 'alert',
        title: 'Expense flagged', body: `"${expense.title}" was flagged: ${finalReason}`,
      });
    }
    setLoading(false);
    onFlagged();
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950 flex items-center gap-2"><Flag className="w-5 h-5 text-amber-600" /> Flag expense</h3>
          <button onClick={onClose} aria-label="Close flag expense dialog" className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="text-sm text-stone-600">Flagging <span className="font-semibold text-teal-950">"{expense.title}"</span></div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
              {REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Comment {reason === 'Other' && <span className="text-red-600">*</span>}</label>
            <textarea required={reason === 'Other'} value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Add context..." className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}Flag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
