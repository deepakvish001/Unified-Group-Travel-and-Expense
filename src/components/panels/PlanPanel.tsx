// ADDED: Plan Panel - PRO/ENTERPRISE features hub with tier gating
import { useState } from 'react';
import { Crown, Lightbulb, Wallet, Navigation, Star, BarChart2 } from 'lucide-react';
import type { Trip, TripMember, Profile, Expense } from '../../lib/types';
import { useTier } from '../../contexts/SubscriptionContext';
import { ProGate, TierBadge } from '../common/ProGate';
import { TierStatus } from '../common/TierStatus';
import { ActivitySuggestions } from '../module1/ActivitySuggestions';
import { TripWallet } from '../module2/TripWallet';
import { BudgetForecast } from '../module3/BudgetForecast';
import { RouteOptimizer } from '../module4/RouteOptimizer';
import { SmartBookingRecommendations } from '../module4/SmartBookingRecommendations';

type SubTab = 'overview' | 'suggestions' | 'wallet' | 'forecast' | 'routes' | 'recommendations';

interface Props {
  tripId: string;
  trip: Trip;
  members: (TripMember & { profile: Profile })[];
  expenses: Expense[];
  currentUserId: string;
}

const TABS: { id: SubTab; label: string; icon: typeof Crown; tier: 'free' | 'pro' }[] = [
  { id: 'overview',         label: 'Plan Overview',         icon: Crown,         tier: 'free' },
  { id: 'suggestions',      label: 'Activity Suggestions',  icon: Lightbulb,     tier: 'pro' },
  { id: 'wallet',           label: 'Trip Wallet',           icon: Wallet,        tier: 'pro' },
  { id: 'forecast',         label: 'Budget Forecast',       icon: BarChart2,     tier: 'pro' },
  { id: 'routes',           label: 'Route Optimizer',       icon: Navigation,    tier: 'pro' },
  { id: 'recommendations',  label: 'Smart Bookings',        icon: Star,          tier: 'pro' },
];

export function PlanPanel({ tripId, trip, members, expenses, currentUserId }: Props) {
  const [tab, setTab] = useState<SubTab>('overview');
  const { isPro } = useTier(tripId);
  const isOwner = currentUserId === trip.owner_id;

  const memberData = members.map(m => ({ user_id: m.user_id, profile: m.profile }));
  const currentMember = members.find(m => m.user_id === currentUserId);
  const isAdmin = isOwner || currentMember?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition whitespace-nowrap
              ${tab === t.id ? 'bg-teal-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-teal-300'}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.tier === 'pro' && !isPro && <TierBadge tier="pro" />}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <TierStatus tripId={tripId} isOwner={isOwner} />

          <div className="grid md:grid-cols-2 gap-3">
            {TABS.filter(t => t.id !== 'overview').map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="text-left p-4 bg-white border border-stone-200 rounded-2xl hover:border-teal-300 hover:shadow-sm transition group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center transition">
                    <t.icon className="w-4 h-4 text-teal-700" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-teal-950 text-sm">{t.label}</span>
                    {!isPro && <TierBadge tier="pro" />}
                  </div>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {t.id === 'suggestions' && 'Members propose activities; admins approve, reject, or mark for discussion.'}
                  {t.id === 'wallet' && 'Collect trip contributions from members before the trip starts.'}
                  {t.id === 'forecast' && 'Predict total spending based on current burn rate and remaining days.'}
                  {t.id === 'routes' && 'Reorder daily activities to minimize travel time and backtracking.'}
                  {t.id === 'recommendations' && 'AI-generated hotel, activity, and restaurant suggestions for your destination.'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Tab */}
      {tab === 'suggestions' && (
        <ProGate tripId={tripId} featureName="Activity Suggestions & Approval Workflow" showLocked>
          <ActivitySuggestions
            tripId={tripId}
            isAdmin={isAdmin}
            members={memberData}
            currency={trip.currency}
          />
        </ProGate>
      )}

      {/* Wallet Tab */}
      {tab === 'wallet' && (
        <ProGate tripId={tripId} featureName="Trip Wallet" showLocked>
          <TripWallet
            tripId={tripId}
            isAdmin={isAdmin}
            members={memberData}
            currency={trip.currency}
          />
        </ProGate>
      )}

      {/* Budget Forecast Tab */}
      {tab === 'forecast' && (
        <ProGate tripId={tripId} featureName="Budget Forecasting" showLocked>
          <BudgetForecast
            tripId={tripId}
            trip={trip}
            expenses={expenses}
          />
        </ProGate>
      )}

      {/* Route Optimizer Tab */}
      {tab === 'routes' && (
        <ProGate tripId={tripId} featureName="Route Optimizer" showLocked>
          <RouteOptimizer
            tripId={tripId}
            isAdmin={isAdmin}
          />
        </ProGate>
      )}

      {/* Smart Booking Recommendations Tab */}
      {tab === 'recommendations' && (
        <ProGate tripId={tripId} featureName="Smart Booking Recommendations" showLocked>
          <SmartBookingRecommendations
            tripId={tripId}
            trip={trip}
          />
        </ProGate>
      )}
    </div>
  );
}
