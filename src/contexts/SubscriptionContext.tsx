// ADDED: Subscription Tier System - FREE/PRO/ENTERPRISE
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Tier = 'free' | 'pro' | 'enterprise';

interface TripSubscription {
  id: string;
  trip_id: string;
  tier: Tier;
  billing_cycle: string;
  price_paid: number;
  currency: string;
  valid_until: string | null;
  activated_at: string;
}

interface SubscriptionContextType {
  getSubscription: (tripId: string) => TripSubscription | null;
  getTier: (tripId: string) => Tier;
  isPro: (tripId: string) => boolean;
  isEnterprise: (tripId: string) => boolean;
  activateTier: (tripId: string, tier: Tier, billingCycle: string) => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subs, setSubs] = useState<Map<string, TripSubscription>>(new Map());
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('trip_subscriptions').select('*');
    const map = new Map<string, TripSubscription>();
    for (const s of (data ?? [])) map.set(s.trip_id, s as TripSubscription);
    setSubs(map);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const getSubscription = (tripId: string) => subs.get(tripId) ?? null;

  const getTier = (tripId: string): Tier => {
    const sub = subs.get(tripId);
    if (!sub) return 'free';
    if (sub.valid_until && new Date(sub.valid_until) < new Date()) return 'free';
    return sub.tier;
  };

  const isPro = (tripId: string) => {
    const t = getTier(tripId);
    return t === 'pro' || t === 'enterprise';
  };

  const isEnterprise = (tripId: string) => getTier(tripId) === 'enterprise';

  const activateTier = async (tripId: string, tier: Tier, billingCycle: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const priceMap: Record<string, Record<string, number>> = {
      pro:        { monthly: 399, per_trip: 1499 },
      enterprise: { monthly: 99999, per_trip: 49999 },
    };
    const price = priceMap[tier]?.[billingCycle] ?? 0;
    const validUntil = billingCycle === 'monthly'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await supabase.from('trip_subscriptions').upsert({
      trip_id: tripId,
      tier,
      billing_cycle: billingCycle,
      price_paid: price,
      currency: 'INR',
      valid_until: validUntil,
      activated_by: user.id,
    }, { onConflict: 'trip_id' });

    await loadAll();
  };

  return (
    <SubscriptionContext.Provider value={{ getSubscription, getTier, isPro, isEnterprise, activateTier, loading }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}

export function useTier(tripId: string) {
  const { getTier, isPro, isEnterprise } = useSubscription();
  return {
    tier: getTier(tripId),
    isPro: isPro(tripId),
    isEnterprise: isEnterprise(tripId),
  };
}
