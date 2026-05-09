import { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, ListFilter, BarChart2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AIActivityLogEntry } from '../../lib/types';

type Props = { tripId: string };

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  ItineraryGenerated: { label: 'Itinerary Generated', icon: '🗓️', color: 'text-teal-700' },
  ItineraryApplied:   { label: 'Itinerary Applied',   icon: '✅', color: 'text-green-700' },
  BudgetOptimized:    { label: 'Budget Optimized',     icon: '💡', color: 'text-amber-700' },
  ActivityRecommended:{ label: 'Activity Recommended', icon: '🎯', color: 'text-blue-700' },
  InsightProvided:    { label: 'Insight Provided',     icon: '🌦️', color: 'text-slate-700' },
  AnalysisCompleted:  { label: 'Analysis Completed',   icon: '📊', color: 'text-violet-700' },
  DecisionAnalyzed:   { label: 'Decision Analyzed',    icon: '🤝', color: 'text-rose-700' },
};

const FILTER_OPTIONS = ['All', ...Object.keys(ACTION_META)];

function relTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function AIActivityLog({ tripId }: Props) {
  const [logs, setLogs] = useState<AIActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_activity_log')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs((data ?? []) as AIActivityLogEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  const filtered = filter === 'All' ? logs : logs.filter(l => l.action === filter);

  // Stats
  const stats: Record<string, number> = {};
  for (const l of logs) stats[l.action] = (stats[l.action] || 0) + 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">AI Activity Log</h3>
          <p className="text-xs text-stone-500">{logs.length} total AI actions for this trip</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 text-stone-400 hover:text-stone-700 transition rounded-xl hover:bg-stone-100">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats grid */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats).slice(0, 4).map(([action, count]) => {
            const meta = ACTION_META[action];
            return (
              <div key={action} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="text-lg mb-1">{meta?.icon ?? '🤖'}</div>
                <div className="text-xl font-bold text-stone-800">{count}</div>
                <div className="text-xs text-stone-500">{meta?.label ?? action}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {logs.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <ListFilter className="w-3.5 h-3.5 text-stone-400" />
          {FILTER_OPTIONS.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${filter === f ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-400'}`}>
              {f === 'All' ? f : (ACTION_META[f]?.label ?? f)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-teal-700" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-900 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>
          <p className="text-sm text-stone-500">No AI actions yet. Use Generate, Budget Optimizer, or Insights to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const meta = ACTION_META[log.action];
            return (
              <div key={log.id} className="bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 transition">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-lg shrink-0">
                    {meta?.icon ?? '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs font-semibold ${meta?.color ?? 'text-stone-700'}`}>{meta?.label ?? log.action}</span>
                      <span className="text-xs text-stone-400 shrink-0">{relTime(log.created_at)}</span>
                    </div>
                    <p className="text-sm text-stone-700">{log.summary}</p>
                    {Object.keys(log.details).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {Object.entries(log.details).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      {logs.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-teal-700" />
            <span className="text-sm font-semibold text-teal-900">AI Assistance Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-stone-600">Total AI Actions: <span className="font-semibold text-teal-900">{logs.length}</span></div>
            <div className="text-stone-600">Itineraries: <span className="font-semibold text-teal-900">{stats['ItineraryGenerated'] ?? 0}</span></div>
            <div className="text-stone-600">Budget Tips: <span className="font-semibold text-teal-900">{stats['BudgetOptimized'] ?? 0}</span></div>
            <div className="text-stone-600">Activities Added: <span className="font-semibold text-teal-900">{stats['ActivityRecommended'] ?? 0}</span></div>
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-teal-200">
            <span className="text-xs text-stone-500">Was AI helpful?</span>
            <button className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-green-700 transition">
              <ThumbsUp className="w-3.5 h-3.5" /> Yes
            </button>
            <button className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-red-600 transition">
              <ThumbsDown className="w-3.5 h-3.5" /> No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
