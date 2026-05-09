import { useState } from 'react';
import { X, Users, DollarSign, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  onClose: () => void;
  onCreated: (groupId: string) => void;
};

export function GroupCreationFlow({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [expectedMembers, setExpectedMembers] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerPerson = expectedMembers && totalCost ? (Number(totalCost) / Number(expectedMembers)).toFixed(2) : '0';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name || !totalCost || !expectedMembers) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create group
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert({
          name,
          description,
          created_by: user.id,
          total_estimated_cost: Number(totalCost),
          expected_members: Number(expectedMembers),
          currency,
          status: 'planning',
        })
        .select()
        .maybeSingle();

      if (groupErr || !group) throw new Error(groupErr?.message || 'Failed to create group');

      // Add creator as admin member
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'admin',
      });

      // Log activity
      await supabase.from('activity_logs').insert({
        group_id: group.id,
        actor_id: user.id,
        action_type: 'group_created',
        description: `${name} group created with budget ${currency} ${totalCost}`,
      });

      onCreated(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-stone-200 bg-gradient-to-r from-teal-900 to-teal-800">
          <h2 className="font-display text-2xl font-bold text-white">Create Travel Group</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8">
            <div className={`flex flex-col items-center ${step >= 1 ? 'text-teal-900' : 'text-stone-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 1 ? 'bg-teal-900 text-white' : 'bg-stone-200'}`}>1</div>
              <span className="text-xs font-medium">Group Info</span>
            </div>
            <div className={`flex-1 h-1 mx-3 ${step >= 2 ? 'bg-teal-900' : 'bg-stone-200'}`} />
            <div className={`flex flex-col items-center ${step >= 2 ? 'text-teal-900' : 'text-stone-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 2 ? 'bg-teal-900 text-white' : 'bg-stone-200'}`}>2</div>
              <span className="text-xs font-medium">Budget</span>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-semibold text-teal-950 mb-2">Group Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Goa Bachelorette"
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-teal-950 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about this trip..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-semibold text-teal-950 mb-2">Total Estimated Cost *</label>
                  <div className="flex gap-2">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="px-3 py-2.5 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                    <input
                      type="number"
                      required
                      value={totalCost}
                      onChange={(e) => setTotalCost(e.target.value)}
                      placeholder="e.g., 60000"
                      className="flex-1 px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-teal-950 mb-2">Expected Number of Members *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={expectedMembers}
                    onChange={(e) => setExpectedMembers(e.target.value)}
                    placeholder="e.g., 6"
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
                  />
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-teal-50 to-stone-50 border border-teal-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-teal-900">Per-person commitment:</span>
                    <span className="font-display font-bold text-lg text-teal-900">
                      {currency} {costPerPerson}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Each member will contribute approximately this amount (before final settlements).
                  </p>
                </div>
              </div>
            )}

            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

            <div className="flex justify-between gap-3 pt-4 border-t border-stone-200">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 border border-stone-300 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-900 text-white rounded-xl font-medium hover:bg-teal-800 transition"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {step === 2 && (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-900 text-white rounded-xl font-medium hover:bg-teal-800 disabled:opacity-60 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Create Group
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
