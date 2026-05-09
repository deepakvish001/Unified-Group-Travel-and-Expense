import { useEffect, useState } from 'react';
import { Cloud, Calendar, DollarSign, Shield, BookOpen, Clock, TrendingUp, Users, Sparkles, Loader2, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip, TravelInsight } from '../../lib/types';

type Props = { trip: Trip };

const INSIGHT_META: Record<string, { icon: typeof Cloud; color: string; bg: string; border: string }> = {
  weather:      { icon: Cloud,      color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  seasonal:     { icon: Calendar,   color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  local_events: { icon: Calendar,   color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  cost_saving:  { icon: DollarSign, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  safety:       { icon: Shield,     color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  cultural:     { icon: BookOpen,   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  timing:       { icon: Clock,      color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  budget_trend: { icon: TrendingUp, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  group_tips:   { icon: Users,      color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

export function TravelInsights({ trip }: Props) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<TravelInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('travel_insights')
      .select('*')
      .eq('trip_id', trip.id)
      .gt('expires_at', new Date().toISOString())
      .order('relevance', { ascending: false })
      .order('created_at', { ascending: false });
    setInsights((data ?? []) as TravelInsight[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [trip.id]);

  const generate = async () => {
    if (!user || !trip.destination) return;
    setGenerating(true);
    try {
      const month = trip.start_date
        ? new Date(trip.start_date).toLocaleString('en-US', { month: 'long' })
        : new Date().toLocaleString('en-US', { month: 'long' });
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant/travel-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ destination: trip.destination, month, groupSize: 5, budget: Number(trip.budget), currency: trip.currency }),
        }
      );
      const json = await res.json();
      if (!json.error && Array.isArray(json.data)) {
        const rows = json.data.map((ins: Partial<TravelInsight>) => ({
          trip_id: trip.id,
          insight_type: ins.insight_type ?? 'group_tips',
          title: ins.title ?? '',
          content: ins.content ?? '',
          relevance: ins.relevance ?? 'medium',
          actionable: ins.actionable ?? false,
          action_label: ins.action_label ?? null,
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        }));
        await supabase.from('travel_insights').insert(rows);
        await supabase.from('ai_activity_log').insert({
          trip_id: trip.id, performed_by: user.id,
          action: 'InsightProvided',
          summary: `AI generated ${rows.length} travel insights for ${trip.destination}`,
          details: { insightsCount: rows.length, destination: trip.destination },
        });
        load();
      }
    } catch (e) {
      console.error('insights error', e);
    } finally {
      setGenerating(false);
    }
  };

  const types = ['all', ...Array.from(new Set(insights.map(i => i.insight_type)))];
  const filtered = filter === 'all' ? insights : insights.filter(i => i.insight_type === filter);
  const high = insights.filter(i => i.relevance === 'high');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Travel Insights</h3>
          <p className="text-xs text-stone-500">AI-powered tips for {trip.destination || 'your trip'}</p>
        </div>
        <button onClick={generate} disabled={generating || !trip.destination} className="inline-flex items-center gap-2 bg-teal-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-800 transition disabled:opacity-50">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {insights.length > 0 ? 'Refresh' : 'Generate Insights'}
        </button>
      </div>

      {/* High relevance banner */}
      {high.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">High Priority Tips</span>
          </div>
          <ul className="space-y-1">
            {high.map(ins => (
              <li key={ins.id} className="text-sm text-amber-800 flex gap-2"><span className="shrink-0">•</span>{ins.title}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter tabs */}
      {insights.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1 rounded-full text-xs font-medium border transition capitalize ${filter === t ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-400'}`}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-teal-700" /></div>}

      {!loading && insights.length === 0 && (
        <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-900 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>
          <h3 className="font-semibold text-stone-700 mb-1">No insights yet</h3>
          <p className="text-sm text-stone-500 max-w-xs mx-auto">Get AI-powered tips about weather, local customs, cost-saving, and more for {trip.destination || 'your destination'}.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map(ins => {
          const meta = INSIGHT_META[ins.insight_type] ?? INSIGHT_META.group_tips;
          const Icon = meta.icon;
          return (
            <div key={ins.id} className={`rounded-2xl border p-4 ${meta.bg} ${meta.border}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} border ${meta.border}`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-sm font-semibold ${meta.color}`}>{ins.title}</h4>
                    {ins.relevance === 'high' && <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded">High</span>}
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed">{ins.content}</p>
                  {ins.actionable && ins.action_label && (
                    <button className={`mt-2 text-xs font-medium ${meta.color} hover:underline`}>{ins.action_label}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length > 0 && (
        <button onClick={generate} disabled={generating} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-stone-300 rounded-2xl text-sm text-stone-500 hover:border-teal-400 hover:text-teal-700 transition">
          <RefreshCw className="w-4 h-4" /> Refresh Insights
        </button>
      )}
    </div>
  );
}
