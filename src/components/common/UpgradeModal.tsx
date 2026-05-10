// ADDED: Upgrade Modal - Tier upgrade flow for PRO/ENTERPRISE
import { useState } from 'react';
import { X, Sparkles, Crown, Building2, Check, Zap } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface Props {
  tripId: string;
  requiredTier: 'pro' | 'enterprise';
  featureName: string;
  onClose: () => void;
  onUpgraded?: () => void;
}

const PRO_FEATURES = [
  'Multiple admins & advanced permissions',
  'Suggestion mode for members',
  'Activity approval workflow',
  'Collaborative itinerary rearrangement',
  'Smart scheduling optimization',
  'AI conflict resolution',
  'Unequal / weighted expense splits',
  'Activity-based & room-based splits',
  'Smart debt simplification',
  'Trip wallet system',
  'Budget forecasting & analytics',
  'AI-powered booking recommendations',
  'Route optimization',
  'Priority notifications',
  'Advanced trip templates',
];

const ENTERPRISE_FEATURES = [
  'Everything in PRO',
  'Departmental trip management',
  'Hierarchical approval systems',
  'Organizational dashboards',
  'Bulk participant management',
  'Approval workflows',
  'Reimbursement management',
  'Department budgets',
  'Financial compliance tools',
  'Fraud detection system',
  'RBAC (Role-Based Access Control)',
  'SSO integration',
  'Enterprise audit logs',
  'Compliance systems',
  'Secure API management',
];

export function UpgradeModal({ tripId, requiredTier, featureName, onClose, onUpgraded }: Props) {
  const { activateTier } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'per_trip'>('per_trip');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const plans = requiredTier === 'pro'
    ? { monthly: { price: 399, label: '₹399/month' }, per_trip: { price: 1499, label: '₹1,499/trip' } }
    : { monthly: { price: 99999, label: 'Custom/month' }, per_trip: { price: 49999, label: 'Custom/trip' } };

  const features = requiredTier === 'pro' ? PRO_FEATURES : ENTERPRISE_FEATURES;

  const handleUpgrade = async () => {
    setLoading(true);
    await activateTier(tripId, requiredTier, selectedPlan);
    setLoading(false);
    setSuccess(true);
    setTimeout(() => { onUpgraded?.(); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-teal-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className={`p-6 ${requiredTier === 'enterprise' ? 'bg-gradient-to-br from-slate-900 to-teal-900' : 'bg-gradient-to-br from-teal-900 to-teal-700'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                {requiredTier === 'enterprise' ? <Building2 className="w-6 h-6 text-amber-300" /> : <Crown className="w-6 h-6 text-amber-300" />}
              </div>
              <div>
                <div className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-0.5">Upgrade Required</div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {requiredTier === 'enterprise' ? 'Enterprise' : 'PRO'} Plan
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/80 text-sm mt-3 leading-relaxed">
            <span className="font-semibold text-amber-300">"{featureName}"</span> requires the {requiredTier === 'enterprise' ? 'Enterprise' : 'PRO'} plan. Unlock this and {features.length - 1} more powerful features.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {requiredTier === 'pro' && (
            <div className="grid grid-cols-2 gap-3">
              {(['per_trip', 'monthly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setSelectedPlan(cycle)}
                  className={`p-4 rounded-2xl border-2 text-left transition ${
                    selectedPlan === cycle
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-stone-200 hover:border-teal-300'
                  }`}
                >
                  <div className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    {cycle === 'per_trip' ? 'Per Trip' : 'Monthly'}
                  </div>
                  <div className="font-display text-xl font-bold text-teal-950">
                    {plans[cycle].label}
                  </div>
                  {cycle === 'per_trip' && (
                    <div className="text-[10px] text-teal-700 font-medium mt-1">Best for one-time trips</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="bg-stone-50 rounded-2xl p-4">
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> What you unlock
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {features.slice(0, 8).map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-stone-700">
                  <Check className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
              {features.length > 8 && (
                <div className="text-xs text-stone-500 pt-1">+ {features.length - 8} more features</div>
              )}
            </div>
          </div>

          {success ? (
            <div className="flex items-center justify-center gap-2 py-4 text-teal-700 font-semibold">
              <Check className="w-5 h-5" /> Plan activated successfully!
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition
                ${requiredTier === 'enterprise'
                  ? 'bg-gradient-to-r from-slate-800 to-teal-800 hover:from-slate-700 hover:to-teal-700'
                  : 'bg-gradient-to-r from-teal-800 to-teal-600 hover:from-teal-700 hover:to-teal-500'
                } disabled:opacity-60`}
            >
              {loading ? (
                <span className="flex items-center gap-2"><Zap className="w-4 h-4 animate-pulse" /> Activating...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Upgrade to {requiredTier === 'enterprise' ? 'Enterprise' : 'PRO'}
                  {requiredTier === 'pro' && ` — ${plans[selectedPlan].label}`}
                </>
              )}
            </button>
          )}

          <p className="text-center text-xs text-stone-400">
            Demo mode: No real payment processed. For production, integrate with Razorpay or Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
