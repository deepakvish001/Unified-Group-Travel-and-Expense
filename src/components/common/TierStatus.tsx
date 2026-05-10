// ADDED: Tier Status Banner - shows current plan and upgrade CTA
import { useState } from 'react';
import { Crown, Building2, Zap, Check } from 'lucide-react';
import { useTier } from '../../contexts/SubscriptionContext';
import { UpgradeModal } from './UpgradeModal';

interface Props {
  tripId: string;
  isOwner: boolean;
}

const FREE_FEATURES = [
  'Create trip rooms & shared itinerary',
  'Activity management & group voting',
  'Basic expense tracking & splitting',
  'Manual booking management',
  'Basic AI recommendations',
  'Standard notifications',
];

const PRO_LOCKED = [
  'Multiple admins & permissions',
  'Activity suggestions & approvals',
  'Weighted expense splits',
  'Trip wallet system',
  'Budget forecasting',
  'Route optimization',
  'Smart booking recommendations',
  'AI conflict resolution',
];

export function TierStatus({ tripId, isOwner }: Props) {
  const { tier } = useTier(tripId);
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (tier === 'enterprise') {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-teal-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <Building2 className="w-6 h-6 text-amber-300" />
          <div>
            <div className="font-bold text-lg">Enterprise Plan</div>
            <div className="text-white/60 text-xs">All features unlocked</div>
          </div>
        </div>
        <div className="text-xs text-white/70">Full access to all collaboration, financial, booking, and AI features.</div>
      </div>
    );
  }

  if (tier === 'pro') {
    return (
      <div className="bg-gradient-to-br from-teal-900 to-teal-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <Crown className="w-6 h-6 text-amber-300" />
          <div>
            <div className="font-bold text-lg">PRO Plan Active</div>
            <div className="text-white/60 text-xs">All PRO features unlocked</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {PRO_LOCKED.slice(0, 4).map(f => (
            <div key={f} className="flex items-center gap-1.5 text-xs text-white/80">
              <Check className="w-3 h-3 text-amber-300 flex-shrink-0" /> {f}
            </div>
          ))}
        </div>
        {isOwner && (
          <button onClick={() => setShowUpgrade(true)}
            className="mt-4 w-full py-2 rounded-xl border border-white/30 text-xs font-medium text-white hover:bg-white/10 transition">
            Upgrade to Enterprise
          </button>
        )}
        {showUpgrade && (
          <UpgradeModal tripId={tripId} requiredTier="enterprise" featureName="Enterprise Features" onClose={() => setShowUpgrade(false)} />
        )}
      </div>
    );
  }

  // Free tier
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="p-4 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-200 flex items-center justify-center">
              <Zap className="w-4 h-4 text-stone-500" />
            </div>
            <div>
              <div className="font-semibold text-stone-800 text-sm">Free Plan</div>
              <div className="text-xs text-stone-500">Core features included</div>
            </div>
          </div>
          {isOwner && (
            <button onClick={() => setShowUpgrade(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-900 px-3 py-1.5 rounded-full hover:bg-teal-800 transition">
              <Crown className="w-3 h-3" /> Upgrade
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">Included Free</div>
          <div className="space-y-1">
            {FREE_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-stone-600">
                <Check className="w-3 h-3 text-teal-600 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">PRO — Unlock More</div>
          <div className="space-y-1">
            {PRO_LOCKED.slice(0, 5).map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-stone-400">
                <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
        {isOwner && (
          <button onClick={() => setShowUpgrade(true)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-900 to-teal-700 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition">
            Upgrade to PRO — from ₹399/month
          </button>
        )}
      </div>
      {showUpgrade && (
        <UpgradeModal tripId={tripId} requiredTier="pro" featureName="PRO Features" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
