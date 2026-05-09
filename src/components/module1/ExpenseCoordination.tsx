import { useEffect, useState } from 'react';
import { Plus, Flag, AlertTriangle, MessageCircle, Loader2, Trash2, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { GroupExpense, ExpenseDispute, GroupMember } from '../../lib/types';

type Props = {
  groupId: string;
};

export function ExpenseCoordination({ groupId }: Props) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [disputes, setDisputes] = useState<Record<string, ExpenseDispute>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    expenseType: 'group',
    splitType: 'equal',
    participants: [] as string[],
  });

  const load = async () => {
    try {
      const { data: exp } = await supabase
        .from('expenses')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      setExpenses(exp ?? []);

      const { data: mem } = await supabase.from('group_members').select('*').eq('group_id', groupId);
      setMembers(mem ?? []);

      if (exp && exp.length > 0) {
        const { data: disp } = await supabase
          .from('expense_disputes')
          .select('*')
          .in('expense_id', exp.map(e => e.id));

        const disputeMap: Record<string, ExpenseDispute> = {};
        (disp ?? []).forEach(d => {
          disputeMap[d.expense_id] = d;
        });
        setDisputes(disputeMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [groupId]);

  const shouldFlagExpense = (exp: GroupExpense): boolean => {
    if (exp.amount > 5000) return true;
    const recentDuplicates = expenses.filter(
      e => e.category === exp.category &&
      Math.abs(e.amount - exp.amount) < 100 &&
      e.id !== exp.id
    );
    return recentDuplicates.length > 0;
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.amount) return;

    const status = shouldFlagExpense({ ...formData, id: '', group_id: groupId, paid_by: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as GroupExpense) ? 'flagged' : 'normal';

    const { data: exp, error: err } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
        paid_by: user.id,
        title: formData.title,
        description: '',
        amount: Number(formData.amount),
        category: formData.category,
        currency: 'INR',
        split_type: formData.splitType,
        expense_type: formData.expenseType,
        status,
      })
      .select()
      .maybeSingle();

    if (!err && exp && formData.expenseType === 'group') {
      const share = Number(formData.amount) / (formData.participants.length || 1);
      const participants = formData.participants.length > 0 ? formData.participants : members.map(m => m.user_id);

      await supabase.from('expense_participants').insert(
        participants.map(uid => ({
          expense_id: exp.id,
          user_id: uid,
          split_amount: share,
        }))
      );

      // Log activity
      await supabase.from('activity_logs').insert({
        group_id: groupId,
        actor_id: user.id,
        action_type: 'expense_added',
        description: `${formData.title} - INR ${formData.amount}`,
        related_entity_type: 'expense',
        related_entity_id: exp.id,
      });

      // Notify group (only for group expenses)
      if (formData.expenseType === 'group') {
        participants.forEach(async (uid) => {
          if (uid !== user.id) {
            await supabase.from('activity_logs').insert({
              group_id: groupId,
              actor_id: user.id,
              action_type: 'expense_notification',
              description: `${user.id} added shared expense: ${formData.title}`,
            });
          }
        });
      }
    }

    setFormData({ title: '', amount: '', category: '', expenseType: 'group', splitType: 'equal', participants: [] });
    setShowAddForm(false);
    load();
  };

  const raiseDispute = async (expenseId: string) => {
    if (!user) return;
    await supabase.from('expense_disputes').insert({
      expense_id: expenseId,
      raised_by: user.id,
      reason: 'I was not part of this expense',
      status: 'open',
    });
    await supabase.from('expenses').update({ status: 'disputed' }).eq('id', expenseId);
    load();
  };

  const deleteExpense = async (expenseId: string) => {
    await supabase.from('expenses').delete().eq('id', expenseId);
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const groupExpenses = expenses.filter(e => e.expense_type === 'group');
  const personalExpenses = expenses.filter(e => e.expense_type === 'personal');
  const totalGroupExpense = groupExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950">Expenses</h2>
          <p className="text-stone-600 text-sm">Track shared and personal expenses</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-900 text-white rounded-xl font-medium hover:bg-teal-800 transition"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="text-xs text-stone-500 uppercase font-semibold mb-1">Group Expenses</div>
          <div className="font-display text-2xl font-bold text-teal-900">INR {totalGroupExpense.toLocaleString()}</div>
          <div className="text-sm text-stone-600 mt-1">{groupExpenses.length} shared expenses</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="text-xs text-stone-500 uppercase font-semibold mb-1">Personal Expenses</div>
          <div className="font-display text-2xl font-bold text-amber-700">{personalExpenses.length}</div>
          <div className="text-sm text-stone-600 mt-1">Not shared with group</div>
        </div>
      </div>

      {/* Add Expense Form */}
      {showAddForm && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-display font-bold text-teal-950">Add New Expense</h3>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Expense title"
                required
                className="px-4 py-2 border border-stone-300 rounded-lg"
              />
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Amount"
                required
                className="px-4 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="px-4 py-2 border border-stone-300 rounded-lg bg-white"
              >
                <option value="">Category</option>
                <option value="food">Food</option>
                <option value="transport">Transport</option>
                <option value="lodging">Lodging</option>
                <option value="activity">Activity</option>
              </select>
              <select
                value={formData.expenseType}
                onChange={(e) => setFormData({ ...formData, expenseType: e.target.value })}
                className="px-4 py-2 border border-stone-300 rounded-lg bg-white"
              >
                <option value="group">Group Shared</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-900 text-white rounded-lg hover:bg-teal-800"
              >
                Add Expense
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-teal-950">Group Shared Expenses</h3>
        {groupExpenses.length === 0 ? (
          <p className="text-sm text-stone-500">No group expenses yet</p>
        ) : (
          groupExpenses.map((exp) => (
            <div key={exp.id} className="bg-white border border-stone-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-teal-950">{exp.title}</h4>
                    {exp.status === 'flagged' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-medium">
                        <Flag className="w-3 h-3" /> Flagged
                      </span>
                    )}
                    {exp.status === 'disputed' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-900 px-2 py-0.5 rounded-full font-medium">
                        <AlertTriangle className="w-3 h-3" /> Disputed
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-stone-600">{exp.category}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-teal-950">INR {exp.amount}</div>
                  <div className="text-xs text-stone-500">{exp.split_type} split</div>
                </div>
              </div>

              {disputes[exp.id] && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-red-900 font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" /> Dispute raised
                  </div>
                  <p className="text-xs text-red-800">{disputes[exp.id].reason}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-stone-100">
                {!disputes[exp.id] && exp.expense_type === 'group' && (
                  <button
                    onClick={() => raiseDispute(exp.id)}
                    className="text-xs text-amber-700 hover:underline"
                  >
                    Raise Dispute
                  </button>
                )}
                {exp.paid_by === user?.id && (
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="ml-auto text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
