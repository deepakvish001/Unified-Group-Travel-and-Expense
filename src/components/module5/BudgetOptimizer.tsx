import { useEffect, useState } from 'react';
import { TrendingDown, AlertTriangle, CheckCircle, ChevronRight, Loader2, RefreshCw, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip, BudgetOptimization } from '../../lib/types';

type Props = { trip: Trip };

type SpendData = { category: string; actual: number; estimated: number };

const CATEGORY_ALTERNATIVES: Record<string, { label: string; current: string; suggestion: string; savingPct: number }> = {
  hotel: { label: 'Accommodation', current: 'Hotel/Resort', suggestion: 'Hostel or budget guesthouse', savingPct: 0.4 },
  transport: { label: 'Transport', current: 'Private cab', suggestion: 'Shared taxi or public transit', savingPct: 0.35 },
  food: { label: 'Food', current: 'All restaurant meals', suggestion: 'Mix street food + restaurants', savingPct: 0.2 },
  activities: { label: 'Activities', current: 'Premium activities', suggestion: 'Free/low-cost alternatives', savingPct: 0.3 },
  shopping: { label: 'Shopping', current: 'Tourist shops', suggestion: 'Local markets instead', savingPct: 0.25 },
};

export function BudgetOptimizer({ trip }: Props) {
  const { user } = useAuth();
  const [optimizations, setOptimizations] = useState<BudgetOptimization[]>([]);
  const [spending, setSpending] = useState<SpendData[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const budget = Number(trip.budget) || 0;

  const load = async () => {
    setLoading(true);
    const [{ data: opts }, { data: exps }] = await Promise.all([
      supabase.from('budget_optimizations').select('*').eq('trip_id', trip.id).order('savings', { ascending: false }),
      supabase.from('expenses').select('amount,category').eq('trip_id', trip.id),
    ]);
    setOptimizations((opts ?? []) as BudgetOptimization[]);
    const expList = exps ?? [];
    const total = expList.reduce((s, e) => s + Number(e.amount), 0);
    setTotalSpent(total);
    const byCategory: Record<string, number> = {};
    for (const e of expList) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    }
    setSpending(Object.entries(byCategory).map(([category, actual]) => ({ category, actual, estimated: 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [trip.id]);

  const generateOptimizations = async () => {
    if (!user) return;
    setGenerating(true);
    const newOpts: Omit<BudgetOptimization, 'id' | 'created_at' | 'applied_at'>[] = [];
    for (const spend of spending) {
      const alt = CATEGORY_ALTERNATIVES[spend.category];
      if (!alt) continue;
      const savings = Math.round(spend.actual * alt.savingPct);
      if (savings > 500) {
        newOpts.push({
          trip_id: trip.id,
          recommendation_id: null,
          optimization_type: spend.category as BudgetOptimization['optimization_type'],
          category: spend.category,
          current_option_name: `${alt.current} (${trip.currency} ${spend.actual.toLocaleString()})`,
          current_option_cost: spend.actual,
          suggested_option_name: alt.suggestion,
          suggested_option_cost: spend.actual - savings,
          savings,
          reason: `${alt.label} typically accounts for a large share of trip costs. Switching saves ~${alt.savingPct * 100}%.`,
          status: 'suggested',
        });
      }
    }
    if (newOpts.length > 0) {
      await supabase.from('budget_optimizations').upsert(newOpts);
      await supabase.from('ai_activity_log').insert({
        trip_id: trip.id, performed_by: user.id,
        action: 'BudgetOptimized',
        summary: `Found ${newOpts.length} cost-saving opportunities, potential savings: ${trip.currency} ${newOpts.reduce((s, o) => s + o.savings, 0).toLocaleString()}`,
        details: { opportunitiesCount: newOpts.length },
      });
    }
    setGenerating(false);
    load();
  };

  const applyOpt = async (opt: BudgetOptimization) => {
    setApplying(opt.id);
    await supabase.from('budget_optimizations').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', opt.id);
    setApplying(null);
    load();
  };

  const dismissOpt = async (id: string) => {
    await supabase.from('budget_optimizations').update({ status: 'dismissed' }).eq('id', id);
    load();
  };

  const suggested = optimizations.filter(o => o.status === 'suggested');
  const applied = optimizations.filter(o => o.status === 'applied');
  const totalSavings = suggested.reduce((s, o) => s + Number(o.savings), 0);
  const pct = budget > 0 ? (totalSpent / budget) * 100 : 0;
  const statusColor = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-teal-700';
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-600';

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-700" /></div>;

  return (
    <div className="space-y-6">
      {/* Budget status */}
      <div className={`rounded-2xl border p-5 ${pct >= 100 ? 'bg-red-50 border-red-200' : pct >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200'}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Budget Status</div>
            <div className={`font-display text-2xl font-bold ${statusColor}`}>
              {pct >= 100 ? `Over by ${trip.currency} ${(totalSpent - budget).toLocaleString()}` : pct >= 80 ? 'Approaching limit' : 'On track'}
            </div>
          </div>
          {pct >= 80 ? <AlertTriangle className={`w-6 h-6 shrink-0 ${pct >= 100 ? 'text-red-500' : 'text-amber-500'}`} /> : <CheckCircle className="w-6 h-6 shrink-0 text-teal-600" />}
        </div>
        <div className="flex justify-between text-sm text-stone-600 mb-2">
          <span>{trip.currency} {totalSpent.toLocaleString()} spent</span>
          <span>{trip.currency} {budget.toLocaleString()} budget</span>
        </div>
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-2 text-xs text-stone-500">
          {budget - totalSpent > 0 ? `${trip.currency} ${(budget - totalSpent).toLocaleString()} remaining` : `${trip.currency} ${(totalSpent - budget).toLocaleString()} over budget`}
        </div>
      </div>

      {/* Spending by category */}
      {spending.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Spending by Category</div>
          <div className="space-y-3">
            {spending.sort((a, b) => b.actual - a.actual).map(s => (
              <div key={s.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-stone-700">{s.category}</span>
                  <span className="font-medium text-stone-800">{trip.currency} {s.actual.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 rounded-full" style={{ width: `${totalSpent > 0 ? (s.actual / totalSpent) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Suggestions */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-teal-700" />
            <span className="font-semibold text-stone-800">Optimization Suggestions</span>
            {suggested.length > 0 && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{suggested.length}</span>}
          </div>
          <button onClick={generateOptimizations} disabled={generating || spending.length === 0} className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 transition disabled:opacity-50">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Analyze
          </button>
        </div>

        {suggested.length === 0 && (
          <div className="p-10 text-center text-stone-400 text-sm">
            {spending.length === 0 ? 'Add expenses to see optimization suggestions.' : 'Click Analyze to find cost-saving opportunities.'}
          </div>
        )}

        {totalSavings > 0 && (
          <div className="px-5 py-3 bg-green-50 border-b border-green-100 text-sm text-green-700 font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Potential total savings: {trip.currency} {totalSavings.toLocaleString()}
          </div>
        )}

        <div className="divide-y divide-stone-100">
          {suggested.map(opt => (
            <div key={opt.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 capitalize">{opt.optimization_type}</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Save {trip.currency} {Number(opt.savings).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-stone-700 mb-0.5 line-through text-stone-400">{opt.current_option_name}</div>
                  <div className="text-sm font-medium text-stone-800 flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5 text-teal-600" />{opt.suggested_option_name}</div>
                  <div className="text-xs text-stone-500 mt-1">{opt.reason}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => dismissOpt(opt.id)} className="text-xs text-stone-400 hover:text-stone-600 transition px-2 py-1">Dismiss</button>
                  <button onClick={() => applyOpt(opt)} disabled={applying === opt.id} className="text-xs bg-teal-900 text-white px-3 py-1.5 rounded-lg hover:bg-teal-800 transition disabled:opacity-50 flex items-center gap-1">
                    {applying === opt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {applied.length > 0 && (
          <div className="px-5 py-3 border-t border-stone-100 bg-stone-50">
            <div className="text-xs text-stone-500 font-medium mb-2">Applied ({applied.length})</div>
            <div className="space-y-1">
              {applied.map(opt => (
                <div key={opt.id} className="flex items-center gap-2 text-sm text-stone-600">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span>{opt.suggested_option_name}</span>
                  <span className="text-green-600 text-xs ml-auto">-{trip.currency} {Number(opt.savings).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
