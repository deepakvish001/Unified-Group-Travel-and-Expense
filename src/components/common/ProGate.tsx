// ADDED: ProGate - Tier-gating wrapper component
import { useState, ReactNode } from 'react';
import { Lock, Crown, Building2 } from 'lucide-react';
import { useTier } from '../../contexts/SubscriptionContext';
import { UpgradeModal } from './UpgradeModal';

interface Props {
  tripId: string;
  requiredTier?: 'pro' | 'enterprise';
  featureName: string;
  children: ReactNode;
  /** If true, renders a locked card instead of hiding the children */
  showLocked?: boolean;
}

export function ProGate({ tripId, requiredTier = 'pro', featureName, children, showLocked = false }: Props) {
  const { tier } = useTier(tripId);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const hasAccess = requiredTier === 'pro'
    ? tier === 'pro' || tier === 'enterprise'
    : tier === 'enterprise';

  if (hasAccess) return <>{children}</>;

  if (!showLocked) return null;

  return (
    <>
      <div
        className="relative rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition group"
        onClick={() => setShowUpgrade(true)}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-stone-200 group-hover:bg-teal-100 flex items-center justify-center transition">
            {requiredTier === 'enterprise'
              ? <Building2 className="w-6 h-6 text-stone-400 group-hover:text-teal-600" />
              : <Crown className="w-6 h-6 text-stone-400 group-hover:text-teal-600" />
            }
          </div>
          <div>
            <div className="font-semibold text-stone-700 text-sm">{featureName}</div>
            <div className="text-xs text-stone-500 mt-0.5">
              Requires {requiredTier === 'enterprise' ? 'Enterprise' : 'PRO'} plan
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-100 px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" /> Unlock feature
          </span>
        </div>
      </div>
      {showUpgrade && (
        <UpgradeModal
          tripId={tripId}
          requiredTier={requiredTier}
          featureName={featureName}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  );
}

/** Inline lock badge for buttons / menu items */
export function TierBadge({ tier }: { tier: 'pro' | 'enterprise' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full
      ${tier === 'enterprise' ? 'bg-slate-800 text-amber-300' : 'bg-teal-800 text-amber-300'}`}>
      {tier === 'enterprise' ? <Building2 className="w-2.5 h-2.5" /> : <Crown className="w-2.5 h-2.5" />}
      {tier}
    </span>
  );
}
