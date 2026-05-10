// ADDED: Trip Wallet System - PRO Module 2
import { useEffect, useState } from 'react';
import { Wallet, Plus, Check, Target, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../lib/types';

interface TripWallet {
  id: string;
  trip_id: string;
  target_amount: number;
  collected: number;
  currency: string;
  status: 'open' | 'locked' | 'closed';
  description: string | null;
  created_by: string;
  created_at: string;
}

interface WalletContribution {
  id: string;
  wallet_id: string;
  trip_id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  note: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  created_at: string;
}

interface Props {
  tripId: string;
  isAdmin: boolean;
  members: { user_id: string; profile: Profile }[];
  currency: string;
}

const PAYMENT_METHODS = ['upi', 'bank_transfer', 'cash', 'card', 'other'];

export function TripWallet({ tripId, isAdmin, members, currency }: Props) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<TripWallet | null>(null);
  const [contributions, setContributions] = useState<WalletContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [showContribute, setShowContribute] = useState(false);

  const [walletForm, setWalletForm] = useState({ target_amount: '', description: '' });
  const [contribForm, setContribForm] = useState({ amount: '', payment_method: 'upi', note: '' });

  const load = async () => {
    setLoading(true);
    const { data: w } = await supabase
      .from('trip_wallets').select('*').eq('trip_id', tripId).maybeSingle();
    setWallet(w as TripWallet | null);
    if (w) {
      const { data: c } = await supabase
        .from('wallet_contributions').select('*').eq('wallet_id', w.id).order('created_at', { ascending: false });
      setContributions((c ?? []) as WalletContribution[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  const createWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { data } = await supabase.from('trip_wallets').insert({
      trip_id: tripId,
      target_amount: parseFloat(walletForm.target_amount) || 0,
      currency,
      description: walletForm.description || null,
      created_by: user.id,
    }).select().maybeSingle();
    if (data) { setWallet(data as TripWallet); setShowCreateWallet(false); }
    load();
  };

  const contribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !wallet) return;
    const amount = parseFloat(contribForm.amount) || 0;
    if (amount <= 0) return;
    await supabase.from('wallet_contributions').insert({
      wallet_id: wallet.id,
      trip_id: tripId,
      user_id: user.id,
      amount,
      payment_method: contribForm.payment_method,
      note: contribForm.note || null,
    });
    setContribForm({ amount: '', payment_method: 'upi', note: '' });
    setShowContribute(false);
    load();
  };

  const confirmContribution = async (contribId: string) => {
    if (!user) return;
    await supabase.from('wallet_contributions').update({
      confirmed: true,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    }).eq('id', contribId);

    // Update wallet collected amount
    const { data: allConfirmed } = await supabase
      .from('wallet_contributions').select('amount').eq('wallet_id', wallet!.id).eq('confirmed', true);
    const total = (allConfirmed ?? []).reduce((s, c) => s + Number(c.amount), 0);
    await supabase.from('trip_wallets').update({ collected: total }).eq('id', wallet!.id);
    load();
  };

  const profileOf = (userId: string) => {
    const m = members.find(m => m.user_id === userId);
    return m?.profile.full_name || 'Member';
  };

  if (loading) return <div className="text-center py-8 text-stone-500 text-sm">Loading wallet...</div>;

  if (!wallet) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-teal-950">Trip Wallet</h3>
            <p className="text-stone-500 text-sm mt-0.5">Collect contributions from all members before the trip</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreateWallet(true)}
              className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
              <Plus className="w-4 h-4" /> Create Wallet
            </button>
          )}
        </div>

        {showCreateWallet && (
          <form onSubmit={createWallet} className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-4">
            <h4 className="font-semibold text-teal-950">Set Up Trip Wallet</h4>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Target Amount ({currency})</label>
              <input required type="number" min="0" value={walletForm.target_amount}
                onChange={e => setWalletForm(p => ({ ...p, target_amount: e.target.value }))}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
              <input value={walletForm.description}
                onChange={e => setWalletForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Collect ₹5000 per person for trip expenses"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition">
                Create Wallet
              </button>
              <button type="button" onClick={() => setShowCreateWallet(false)} className="px-4 py-2 text-stone-500 text-sm">Cancel</button>
            </div>
          </form>
        )}

        {!showCreateWallet && !isAdmin && (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <div className="font-medium text-stone-600">No trip wallet yet</div>
            <p className="text-sm text-stone-400 mt-1">Ask your admin to set one up</p>
          </div>
        )}
      </div>
    );
  }

  const progress = wallet.target_amount > 0 ? Math.min(100, (wallet.collected / wallet.target_amount) * 100) : 0;
  const confirmed = contributions.filter(c => c.confirmed);
  const pending = contributions.filter(c => !c.confirmed);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-teal-950">Trip Wallet</h3>
          <p className="text-stone-500 text-sm mt-0.5">{wallet.description || 'Shared trip fund'}</p>
        </div>
        <button onClick={() => setShowContribute(true)}
          className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition">
          <Plus className="w-4 h-4" /> Contribute
        </button>
      </div>

      {/* Wallet summary */}
      <div className="bg-gradient-to-br from-teal-900 to-teal-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="text-white/70 text-xs uppercase tracking-wide">Collected</div>
            <div className="font-display text-3xl font-bold">{currency} {wallet.collected.toLocaleString()}</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Progress</span>
            <span className="font-medium">{currency} {wallet.target_amount.toLocaleString()} target</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-amber-300 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-white/60">
            <span>{progress.toFixed(0)}% collected</span>
            <span>{currency} {Math.max(0, wallet.target_amount - wallet.collected).toLocaleString()} remaining</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'Contributors', value: new Set(contributions.map(c => c.user_id)).size },
          { icon: Check, label: 'Confirmed', value: confirmed.length },
          { icon: TrendingUp, label: 'Pending', value: pending.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white border border-stone-200 rounded-xl p-3 text-center">
            <Icon className="w-4 h-4 mx-auto mb-1 text-teal-700" />
            <div className="font-display text-xl font-bold text-teal-950">{value}</div>
            <div className="text-xs text-stone-500">{label}</div>
          </div>
        ))}
      </div>

      {showContribute && (
        <form onSubmit={contribute} className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-teal-950">Add Contribution</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Amount ({currency}) *</label>
              <input required type="number" min="1" value={contribForm.amount}
                onChange={e => setContribForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Payment Method</label>
              <select value={contribForm.payment_method} onChange={e => setContribForm(p => ({ ...p, payment_method: e.target.value }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1">Note</label>
              <input value={contribForm.note} onChange={e => setContribForm(p => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Paid via GPay"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition">
              Submit Contribution
            </button>
            <button type="button" onClick={() => setShowContribute(false)} className="px-4 py-2 text-stone-500 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Contributions list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-teal-950 text-sm">All Contributions</h4>
          <span className="text-xs text-stone-500">{contributions.length} total</span>
        </div>
        {contributions.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">No contributions yet. Be the first!</div>
        ) : (
          <div className="space-y-2">
            {contributions.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold">
                  {profileOf(c.user_id).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-teal-950">{profileOf(c.user_id)}</div>
                  <div className="text-xs text-stone-500">
                    {c.payment_method.replace('_', ' ')} {c.note && `· ${c.note}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-teal-900">{currency} {Number(c.amount).toLocaleString()}</div>
                  {c.confirmed ? (
                    <div className="text-xs text-teal-600 flex items-center gap-1 justify-end">
                      <Check className="w-3 h-3" /> Confirmed
                    </div>
                  ) : (
                    isAdmin ? (
                      <button onClick={() => confirmContribution(c.id)}
                        className="text-xs text-amber-700 hover:text-amber-900 font-medium transition">
                        Confirm
                      </button>
                    ) : (
                      <div className="text-xs text-amber-600">Pending</div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
