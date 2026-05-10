// ADDED: Budget Forecasting & Analytics - PRO Module 2
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Target, Calendar, BarChart2, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip, Expense } from '../../lib/types';

interface BudgetForecast {
  id: string;
  trip_id: string;
  total_budget: number;
  current_spent: number;
  forecasted_total: number;
  variance: number;
  breakdown: Record<string, number>;
  daily_burn_rate: number;
  days_remaining: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
  created_at: string;
}

interface Props {
  tripId: string;
  trip: Trip;
  expenses: Expense[];
}

function generateForecast(trip: Trip, expenses: Expense[]): Omit<BudgetForecast, 'id' | 'trip_id' | 'created_at'> & { generated_by?: string } {
  const now = new Date();
  const startDate = trip.start_date ? new Date(trip.start_date) : now;
  const endDate = trip.end_date ? new Date(trip.end_date) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, totalDays - elapsedDays);

  const currentSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const budget = Number(trip.budget) || 1;

  const dailyBurnRate = elapsedDays > 0 ? currentSpent / elapsedDays : currentSpent / totalDays;
  const forecastedTotal = currentSpent + (dailyBurnRate * daysRemaining);

  // Category breakdown
  const breakdown: Record<string, number> = {};
  for (const e of expenses) {
    const cat = e.category || 'other';
    breakdown[cat] = (breakdown[cat] || 0) + Number(e.amount);
  }

  const variance = forecastedTotal - budget;
  const confidence: 'high' | 'medium' | 'low' =
    elapsedDays >= totalDays * 0.3 ? 'high' : elapsedDays >= totalDays * 0.1 ? 'medium' : 'low';

  return {
    total_budget: budget,
    current_spent: currentSpent,
    forecasted_total: forecastedTotal,
    variance,
    breakdown,
    daily_burn_rate: dailyBurnRate,
    days_remaining: daysRemaining,
    confidence,
    notes: null,
  };
}

export function BudgetForecast({ tripId, trip, expenses }: Props) {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<BudgetForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('budget_forecasts')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setForecast(data as BudgetForecast | null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);
    const f = generateForecast(trip, expenses);
    const { data } = await supabase.from('budget_forecasts').insert({
      trip_id: tripId,
      generated_by: user.id,
      ...f,
    }).select().maybeSingle();
    if (data) setForecast(data as BudgetForecast);
    setGenerating(false);
  };

  const CONFIDENCE_META = {
    high:   { label: 'High Confidence', color: 'text-teal-700 bg-teal-50' },
    medium: { label: 'Medium Confidence', color: 'text-amber-700 bg-amber-50' },
    low:    { label: 'Low Confidence', color: 'text-stone-500 bg-stone-100' },
  };

  if (loading) return <div className="text-center py-8 text-stone-500 text-sm">Loading forecast...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-bold text-teal-950">Budget Forecast</h3>
          <p className="text-stone-500 text-sm mt-0.5">Predicted spend based on current burn rate</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-4 py-2 rounded-full text-sm font-medium hover:bg-teal-800 transition disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {forecast ? 'Refresh' : 'Generate Forecast'}
        </button>
      </div>

      {!forecast ? (
        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 text-stone-300" />
          <div className="font-medium text-stone-600">No forecast yet</div>
          <p className="text-sm text-stone-400 mt-1">Generate a forecast to see projected spending</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONFIDENCE_META[forecast.confidence].color}`}>
              {CONFIDENCE_META[forecast.confidence].label}
            </span>
            <span className="text-xs text-stone-400">
              Generated {new Date(forecast.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Main forecast cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: Target, label: 'Total Budget',
                value: `${trip.currency} ${forecast.total_budget.toLocaleString()}`,
                sub: 'Set budget', color: 'text-teal-700',
              },
              {
                icon: TrendingUp, label: 'Current Spent',
                value: `${trip.currency} ${forecast.current_spent.toLocaleString()}`,
                sub: `${((forecast.current_spent / forecast.total_budget) * 100).toFixed(0)}% of budget`,
                color: 'text-teal-700',
              },
              {
                icon: forecast.variance > 0 ? TrendingUp : TrendingDown,
                label: 'Forecasted Total',
                value: `${trip.currency} ${forecast.forecasted_total.toLocaleString()}`,
                sub: forecast.variance > 0 ? `${trip.currency} ${Math.abs(forecast.variance).toLocaleString()} over` : `${trip.currency} ${Math.abs(forecast.variance).toLocaleString()} under`,
                color: forecast.variance > 0 ? 'text-red-600' : 'text-teal-600',
              },
              {
                icon: Calendar, label: 'Daily Burn Rate',
                value: `${trip.currency} ${forecast.daily_burn_rate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                sub: `${forecast.days_remaining} days remaining`,
                color: 'text-amber-700',
              },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className={`inline-flex items-center gap-1.5 text-xs font-medium mb-2 ${color}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <div className="font-display text-lg font-bold text-teal-950">{value}</div>
                <div className="text-xs text-stone-500 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Budget progress bar */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-teal-950">Budget Utilization</span>
              <span className={forecast.variance > 0 ? 'text-red-600 font-semibold' : 'text-teal-600 font-semibold'}>
                {((forecast.forecasted_total / forecast.total_budget) * 100).toFixed(0)}% projected
              </span>
            </div>
            <div className="relative h-3 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (forecast.current_spent / forecast.total_budget) * 100)}%` }}
              />
              <div
                className={`absolute top-0 h-full opacity-40 rounded-full ${forecast.variance > 0 ? 'bg-red-400' : 'bg-teal-300'}`}
                style={{
                  left: `${Math.min(100, (forecast.current_spent / forecast.total_budget) * 100)}%`,
                  width: `${Math.min(100 - Math.min(100, (forecast.current_spent / forecast.total_budget) * 100), Math.abs(forecast.forecasted_total - forecast.current_spent) / forecast.total_budget * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-stone-400">
              <span>Spent so far</span>
              <span>Forecasted range</span>
            </div>
          </div>

          {/* Category breakdown */}
          {Object.keys(forecast.breakdown).length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-teal-950 text-sm">Spending by Category</h4>
              <div className="space-y-2">
                {Object.entries(forecast.breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => {
                    const pct = forecast.current_spent > 0 ? (amount / forecast.current_spent) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="capitalize font-medium text-stone-700">{cat}</span>
                          <span className="text-stone-500">{trip.currency} {amount.toLocaleString()} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {forecast.variance > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-red-800">Over Budget Warning</div>
                <p className="text-xs text-red-700 mt-0.5">
                  At current burn rate, you'll exceed your budget by {trip.currency} {forecast.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}.
                  Consider reducing daily spend or adjusting the budget.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
