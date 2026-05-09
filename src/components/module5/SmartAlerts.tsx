import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Check, X, TrendingUp, Users, CreditCard, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip } from '../../lib/types';

type Props = { trip: Trip };

type Alert = {
  id: string;
  type: 'budget_warning' | 'overspend' | 'high_expense' | 'duplicate' | 'imbalance' | 'daily_rate' | 'booking_deadline';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  suggestion?: string;
  acknowledged: boolean;
  created_at: string;
};

export function SmartAlerts({ trip }: Props) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trip_alerts')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false });
    setAlerts((data ?? []) as unknown as Alert[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [trip.id]);

  const scanForAlerts = async () => {
    if (!user) return;
    setScanning(true);
    const budget = Number(trip.budget) || 0;
    const newAlerts: Omit<Alert, 'id' | 'acknowledged' | 'created_at'>[] = [];

    const { data: exps } = await supabase.from('expenses').select('*').eq('trip_id', trip.id);
    const expenses = exps ?? [];
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);

    // Budget warnings
    if (budget > 0) {
      const pct = totalSpent / budget;
      if (pct >= 1) {
        newAlerts.push({
          type: 'overspend',
          severity: 'high',
          title: 'Over Budget',
          message: `Total spent ${trip.currency} ${totalSpent.toLocaleString()} exceeds budget of ${trip.currency} ${budget.toLocaleString()} by ${trip.currency} ${(totalSpent - budget).toLocaleString()}.`,
          suggestion: 'Review and cut planned activities or accommodation to get back on track.',
        });
      } else if (pct >= 0.8) {
        newAlerts.push({
          type: 'budget_warning',
          severity: 'medium',
          title: 'Approaching Budget Limit',
          message: `Used ${Math.round(pct * 100)}% of budget. Only ${trip.currency} ${(budget - totalSpent).toLocaleString()} remaining.`,
          suggestion: 'Limit discretionary spending for the rest of the trip.',
        });
      }
    }

    // High single expense
    if (budget > 0) {
      for (const exp of expenses) {
        if (Number(exp.amount) > budget * 0.3) {
          newAlerts.push({
            type: 'high_expense',
            severity: 'medium',
            title: 'High-Value Expense Detected',
            message: `${exp.title}: ${trip.currency} ${Number(exp.amount).toLocaleString()} is ${Math.round((Number(exp.amount) / budget) * 100)}% of total budget.`,
            suggestion: 'Verify this expense is correct and approved by the group.',
          });
          break;
        }
      }
    }

    // Spending imbalance
    const byPayer: Record<string, number> = {};
    for (const e of expenses) {
      if (e.paid_by) byPayer[e.paid_by] = (byPayer[e.paid_by] || 0) + Number(e.amount);
    }
    const payerEntries = Object.entries(byPayer);
    if (payerEntries.length >= 2) {
      const total = Object.values(byPayer).reduce((s, v) => s + v, 0);
      const maxPayer = payerEntries.sort((a, b) => b[1] - a[1])[0];
      if (maxPayer && maxPayer[1] / total > 0.6) {
        newAlerts.push({
          type: 'imbalance',
          severity: 'low',
          title: 'Spending Imbalance',
          message: `One member has paid ${Math.round((maxPayer[1] / total) * 100)}% of all expenses. Consider distributing payments more evenly.`,
          suggestion: 'Ask other members to pay for upcoming expenses to rebalance.',
        });
      }
    }

    // Check booking deadlines
    const { data: bookings } = await supabase
      .from('bookings')
      .select('title,booking_deadline,status')
      .eq('trip_id', trip.id)
      .not('booking_deadline', 'is', null)
      .neq('status', 'confirmed');

    for (const bk of bookings ?? []) {
      if (!bk.booking_deadline) continue;
      const daysLeft = Math.ceil((new Date(bk.booking_deadline).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 2 && daysLeft >= 0) {
        newAlerts.push({
          type: 'booking_deadline',
          severity: daysLeft === 0 ? 'high' : 'medium',
          title: 'Booking Deadline Soon',
          message: `"${bk.title}" deadline is ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}. Status: ${bk.status}.`,
          suggestion: 'Confirm or complete this booking before the deadline.',
        });
      }
    }

    if (newAlerts.length > 0) {
      await supabase.from('trip_alerts').insert(
        newAlerts.map(a => ({
          trip_id: trip.id,
          alert_type: a.type,
          severity: a.severity,
          message: `${a.title}: ${a.message}${a.suggestion ? ` Tip: ${a.suggestion}` : ''}`,
          acknowledged: false,
        }))
      );
    }
    setScanning(false);
    load();
  };

  const acknowledge = async (id: string) => {
    await supabase.from('trip_alerts').update({ acknowledged: true, acknowledged_by: user?.id }).eq('id', id);
    load();
  };

  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const acknowledged = alerts.filter(a => a.acknowledged);

  const severityColor = (s: string) =>
    s === 'high' ? 'border-red-200 bg-red-50' : s === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50';
  const severityIcon = (s: string) =>
    s === 'high' ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /> :
    s === 'medium' ? <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" /> :
    <Users className="w-4 h-4 text-blue-500 shrink-0" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-stone-700" />
          <h3 className="font-semibold text-stone-800">Smart Alerts</h3>
          {unacknowledged.length > 0 && (
            <span className="text-xs font-bold bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center">{unacknowledged.length}</span>
          )}
        </div>
        <button onClick={scanForAlerts} disabled={scanning} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900 transition border border-teal-200 rounded-xl px-3 py-1.5 hover:bg-teal-50 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} /> Scan Now
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-stone-400 text-sm">Checking alerts...</div>
      ) : unacknowledged.length === 0 && acknowledged.length === 0 ? (
        <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-stone-700">No alerts</p>
          <p className="text-xs text-stone-500 mt-1">Click "Scan Now" to check for budget and booking issues.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unacknowledged.map(alert => (
            <div key={alert.id} className={`rounded-2xl border p-4 ${severityColor(alert.severity)}`}>
              <div className="flex items-start gap-3">
                {severityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-stone-700">{(alert as unknown as { message: string }).message}</p>
                    <button onClick={() => acknowledge(alert.id)} className="shrink-0 p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-white/60 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {acknowledged.length > 0 && (
            <div className="bg-stone-50 rounded-2xl p-4">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Acknowledged ({acknowledged.length})
              </div>
              <div className="space-y-1.5">
                {acknowledged.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-stone-400">
                    <Check className="w-3 h-3 text-green-500 shrink-0" />
                    <span className="truncate">{(a as unknown as { message: string }).message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
