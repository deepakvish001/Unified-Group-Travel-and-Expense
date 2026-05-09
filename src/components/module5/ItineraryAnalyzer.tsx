import { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip } from '../../lib/types';

type Props = { trip: Trip };

type Issue = {
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedDay: number | null;
  suggestion: string;
  actionLabel: string;
};

type Analysis = {
  issues: Issue[];
  overallScore: number;
  summary: string;
};

export function ItineraryAnalyzer({ trip }: Props) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: items } = await supabase
        .from('itinerary_items')
        .select('day_number,title,start_time,duration_minutes,estimated_cost,category')
        .eq('trip_id', trip.id)
        .order('day_number')
        .order('position');

      if (!items || items.length === 0) {
        setError('No itinerary items found. Add activities first.');
        setLoading(false);
        return;
      }

      const tripDays = trip.start_date && trip.end_date
        ? Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1)
        : 3;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant/analyze-itinerary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            destination: trip.destination,
            duration: tripDays,
            activities: items,
            budget: Number(trip.budget),
            currency: trip.currency,
          }),
        }
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAnalysis(json.data as Analysis);

      await supabase.from('ai_activity_log').insert({
        trip_id: trip.id, performed_by: user.id,
        action: 'AnalysisCompleted',
        summary: `Itinerary analysis: ${json.data.issues?.length ?? 0} issues found, score ${json.data.overallScore}/10`,
        details: { issueCount: json.data.issues?.length ?? 0, score: json.data.overallScore },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) => s >= 8 ? 'text-green-700' : s >= 6 ? 'text-amber-700' : 'text-red-700';
  const scoreBg = (s: number) => s >= 8 ? 'bg-green-100' : s >= 6 ? 'bg-amber-100' : 'bg-red-100';

  const severityIcon = (s: string) => {
    if (s === 'high') return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    if (s === 'medium') return <Info className="w-4 h-4 text-amber-500 shrink-0" />;
    return <CheckCircle className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  const severityBorder = (s: string) => s === 'high' ? 'border-red-200 bg-red-50' : s === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50';

  return (
    <div className="space-y-5">
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-stone-800 mb-1">Itinerary Analyzer</h3>
            <p className="text-sm text-stone-500">AI checks your schedule for overloading, route efficiency, budget balance, and activity variety.</p>
          </div>
          <button onClick={analyze} disabled={loading} className="shrink-0 flex items-center gap-2 bg-teal-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-800 transition disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {loading && (
        <div className="flex flex-col items-center py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-700 mb-3" />
          <p className="text-sm text-stone-500">AI is reviewing your itinerary...</p>
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-4">
          {/* Score + Summary */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${scoreBg(analysis.overallScore)}`}>
              <span className={`font-display text-2xl font-bold ${scoreColor(analysis.overallScore)}`}>{analysis.overallScore}</span>
            </div>
            <div>
              <div className="text-xs text-stone-500 font-medium mb-1">Itinerary Score</div>
              <p className="text-sm text-stone-700">{analysis.summary}</p>
              {analysis.issues.length === 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-green-700 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> No issues found — great job!
                </div>
              )}
            </div>
          </div>

          {/* Issues */}
          {analysis.issues.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                {analysis.issues.length} Issue{analysis.issues.length !== 1 ? 's' : ''} Found
              </div>
              {analysis.issues.map((issue, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${severityBorder(issue.severity)}`}>
                  <div className="flex items-start gap-3">
                    {severityIcon(issue.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-stone-800">{issue.title}</span>
                        {issue.affectedDay && <span className="text-xs bg-white/60 border border-stone-300 text-stone-600 px-2 py-0.5 rounded-full">Day {issue.affectedDay}</span>}
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${issue.severity === 'high' ? 'bg-red-200 text-red-800' : issue.severity === 'medium' ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>{issue.severity}</span>
                      </div>
                      <p className="text-sm text-stone-600 mb-2">{issue.description}</p>
                      <div className="flex items-start gap-1.5 bg-white/60 rounded-xl p-2.5">
                        <Zap className="w-3.5 h-3.5 text-teal-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-stone-700">{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
