import { useState } from 'react';
import { X, Sparkles, Loader2, ChevronDown, Check, RefreshCw, ListPlus, Trash2, Edit3, MapPin, DollarSign, Users, Clock, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip, TripGenerationInput, GeneratedItinerary } from '../../lib/types';

type Props = {
  trip: Trip;
  onClose: () => void;
  onApplied: () => void;
};

const TRIP_TYPES = ['Friends Trip', 'Family Trip', 'College Tour', 'Trekking', 'Corporate', 'Adventure', 'Honeymoon', 'Solo'];
const PREFERENCES = ['Adventure activities', 'Relaxation/Beach', 'Cultural/Heritage', 'Food/Culinary', 'Shopping', 'Nightlife', 'Nature/Wildlife', 'Photography'];
const DIETARY = ['Vegetarian', 'Vegan', 'Halal', 'Gluten-free', 'No restrictions'];
const BUDGET_PRIORITIES = ['Accommodation', 'Food', 'Activities', 'Transport'];

export function AIGeneratorModal({ trip, onClose, onApplied }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'generating' | 'result'>('form');
  const [generated, setGenerated] = useState<GeneratedItinerary | null>(null);
  const [applying, setApplying] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tripDays = trip.start_date && trip.end_date
    ? Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1)
    : 3;

  const [form, setForm] = useState<TripGenerationInput>({
    destination: trip.destination || '',
    memberCount: 4,
    budget: Number(trip.budget) || 20000,
    currency: trip.currency || 'INR',
    duration: tripDays,
    tripType: 'Friends Trip',
    startDate: trip.start_date || new Date().toISOString().split('T')[0],
    preferences: [],
    mustVisit: '',
    avoidActivities: '',
    dietaryRestrictions: [],
    budgetPriority: 'Balanced',
    pace: 'moderate',
  });

  const togglePref = (p: string) =>
    setForm(f => ({ ...f, preferences: f.preferences.includes(p) ? f.preferences.filter(x => x !== p) : [...f.preferences, p] }));
  const toggleDiet = (d: string) =>
    setForm(f => ({ ...f, dietaryRestrictions: (f.dietaryRestrictions ?? []).includes(d) ? (f.dietaryRestrictions ?? []).filter(x => x !== d) : [...(f.dietaryRestrictions ?? []), d] }));

  const generate = async () => {
    if (genCount >= 3) { setError('Maximum 3 generations per trip reached.'); return; }
    setStep('generating');
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant/generate-itinerary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify(form),
        }
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setGenerated(json.data as GeneratedItinerary);
      setGenCount(c => c + 1);

      // Log to ai_activity_log
      if (user) {
        const { data: rec } = await supabase.from('ai_recommendations').insert({
          trip_id: trip.id, requested_by: user.id, recommendation_type: 'itinerary',
          input_context: form as unknown as Record<string, unknown>,
          generated_content: json.data as Record<string, unknown>,
          ai_model: 'groq', status: 'generated', generation_count: genCount + 1,
        }).select().maybeSingle();
        if (rec) {
          await supabase.from('ai_activity_log').insert({
            trip_id: trip.id, recommendation_id: rec.id, performed_by: user.id,
            action: 'ItineraryGenerated',
            summary: `AI generated ${form.duration}-day itinerary for ${form.destination}`,
            details: { destination: form.destination, duration: form.duration, budget: form.budget },
          });
        }
      }
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Please try again.');
      setStep('form');
    }
  };

  const applyToTrip = async () => {
    if (!generated || !user) return;
    setApplying(true);
    try {
      const rows = generated.days.flatMap((day) => {
        const allActivities = [...day.morning, ...day.afternoon, ...day.evening];
        return allActivities.map((act, idx) => ({
          trip_id: trip.id,
          day_number: day.day,
          title: act.title,
          notes: `${act.description}\n\n${act.reason}`,
          location: '',
          category: act.category === 'food' ? 'food' : act.category === 'transport' ? 'transport' : 'activity',
          start_time: act.time,
          estimated_cost: act.estimatedCost,
          position: idx,
          created_by: user.id,
          status: 'planned',
          priority: 'medium',
        }));
      });
      await supabase.from('itinerary_items').insert(rows);
      await supabase.from('ai_activity_log').insert({
        trip_id: trip.id, performed_by: user.id,
        action: 'ItineraryApplied',
        summary: `Applied AI-generated itinerary with ${rows.length} activities`,
        details: { activitiesCount: rows.length, days: generated.duration },
      });
      onApplied();
      onClose();
    } catch (e) {
      setError('Failed to apply itinerary. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const fmt = (n: number) => `${form.currency} ${n.toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-900 to-teal-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-teal-950">Generate Trip with AI</h2>
              <p className="text-xs text-stone-500">{genCount}/3 generations used</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 transition rounded-xl hover:bg-stone-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {step === 'form' && (
            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Destination</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Goa, India" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Members</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <select className="w-full pl-9 pr-8 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white" value={form.memberCount} onChange={e => setForm(f => ({ ...f, memberCount: Number(e.target.value) }))}>
                      {[2,3,4,5,6,8,10,12,15,20].map(n => <option key={n} value={n}>{n} people</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Duration</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <select className="w-full pl-9 pr-8 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}>
                      {[1,2,3,4,5,6,7,8,9,10,12,14].map(n => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Budget ({form.currency})</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input type="number" className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input type="date" className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Trip Type</label>
                <div className="flex flex-wrap gap-2">
                  {TRIP_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, tripType: t }))} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${form.tripType === t ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-500'}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Preferences</label>
                <div className="flex flex-wrap gap-2">
                  {PREFERENCES.map(p => (
                    <button key={p} onClick={() => togglePref(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1 ${form.preferences.includes(p) ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300'}`}>
                      {form.preferences.includes(p) && <Check className="w-3 h-3" />}
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Pace</label>
                  <div className="flex gap-2">
                    {(['relaxed', 'moderate', 'packed'] as const).map(p => (
                      <button key={p} onClick={() => setForm(f => ({ ...f, pace: p }))} className={`flex-1 py-2 rounded-xl text-xs font-medium border transition capitalize ${form.pace === p ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-400'}`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Budget Priority</label>
                  <div className="relative">
                    <select className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white" value={form.budgetPriority} onChange={e => setForm(f => ({ ...f, budgetPriority: e.target.value }))}>
                      <option value="Balanced">Balanced</option>
                      {BUDGET_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Must-Visit Places (optional)</label>
                  <input className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={form.mustVisit} onChange={e => setForm(f => ({ ...f, mustVisit: e.target.value }))} placeholder="e.g. Dudhsagar Falls, Fort Aguada" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Activities to Avoid (optional)</label>
                  <input className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={form.avoidActivities} onChange={e => setForm(f => ({ ...f, avoidActivities: e.target.value }))} placeholder="e.g. crowded beaches" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide mb-1.5">Dietary Restrictions</label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY.map(d => (
                    <button key={d} onClick={() => toggleDiet(d)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1 ${(form.dietaryRestrictions ?? []).includes(d) ? 'bg-teal-100 text-teal-900 border-teal-300' : 'bg-white text-stone-600 border-stone-200 hover:border-teal-300'}`}>
                      {(form.dietaryRestrictions ?? []).includes(d) && <Check className="w-3 h-3" />}
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-teal-900/10 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-teal-900/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                <div className="absolute inset-4 rounded-full bg-teal-900 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
              </div>
              <h3 className="font-display text-2xl font-bold text-teal-950 mb-2">AI is crafting your perfect trip...</h3>
              <p className="text-stone-500 text-sm max-w-sm">Analyzing {form.destination}, optimizing for {form.memberCount} people, balancing {form.currency} {form.budget.toLocaleString()} budget</p>
              <div className="flex items-center gap-1.5 mt-6">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-teal-900 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          )}

          {step === 'result' && generated && (
            <div className="p-6 space-y-6">
              {/* Summary banner */}
              <div className="bg-gradient-to-r from-teal-900 to-teal-800 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-semibold text-amber-200 uppercase tracking-wide">AI-Generated Itinerary</span>
                </div>
                <h3 className="font-display text-xl font-bold mb-1">{generated.destination} · {generated.duration} Days</h3>
                <div className="flex flex-wrap gap-4 text-sm text-stone-200">
                  <span>Estimated: {fmt(generated.estimatedTotal)}</span>
                  <span>Budget: {fmt(generated.totalBudget)}</span>
                  <span className={`font-semibold ${generated.estimatedTotal <= generated.totalBudget ? 'text-green-300' : 'text-red-300'}`}>
                    {generated.estimatedTotal <= generated.totalBudget ? '✓ Within Budget' : `⚠ Over by ${fmt(generated.estimatedTotal - generated.totalBudget)}`}
                  </span>
                </div>
              </div>

              {/* Budget Breakdown */}
              <div className="bg-stone-50 rounded-2xl p-4">
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Budget Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(generated.budgetBreakdown).map(([k, v]) => (
                    <div key={k} className="bg-white rounded-xl p-3 text-center border border-stone-200">
                      <div className="text-xs text-stone-500 capitalize mb-1">{k}</div>
                      <div className="font-semibold text-teal-900 text-sm">{fmt(v)}</div>
                      <div className="text-xs text-stone-400">{Math.round((v / generated.estimatedTotal) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Days */}
              {generated.days.map(day => (
                <div key={day.day} className="border border-stone-200 rounded-2xl overflow-hidden">
                  <div className="bg-teal-900 text-white px-5 py-3 flex items-center justify-between">
                    <span className="font-semibold">Day {day.day} — {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="text-sm text-amber-300">{fmt(day.dayTotal)}</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {(['morning', 'afternoon', 'evening'] as const).map(period => {
                      const acts = day[period];
                      if (!acts || acts.length === 0) return null;
                      return (
                        <div key={period} className="px-5 py-4">
                          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3 capitalize">{period}</div>
                          <div className="space-y-3">
                            {acts.map((act, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="text-xs text-stone-400 w-16 shrink-0 pt-0.5">{act.time}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-medium text-sm text-stone-800">{act.title}</div>
                                      <div className="text-xs text-stone-500 mt-0.5">{act.duration} · {fmt(act.estimatedCost)} total ({fmt(act.costPerPerson)}/person)</div>
                                    </div>
                                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 capitalize">{act.category}</span>
                                  </div>
                                  <div className="text-xs text-stone-400 mt-1 italic">{act.reason}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* AI Insights */}
              {generated.aiInsights?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-900">AI Insights</span>
                  </div>
                  <ul className="space-y-1.5">
                    {generated.aiInsights.map((tip, i) => (
                      <li key={i} className="text-sm text-amber-800 flex gap-2"><span className="text-amber-400 shrink-0">•</span>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hotel Suggestions */}
              {generated.hotelSuggestions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Recommended Hotels</h4>
                  <div className="space-y-2">
                    {generated.hotelSuggestions.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <div>
                          <div className="text-sm font-medium text-stone-800">{h.name}</div>
                          <div className="text-xs text-stone-500">{h.description}</div>
                        </div>
                        <div className="text-sm font-semibold text-teal-900 shrink-0">{fmt(h.pricePerNight)}/night</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-stone-100 flex flex-wrap items-center gap-3">
          {step === 'form' && (
            <>
              <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-800 transition">Cancel</button>
              <button
                onClick={generate}
                disabled={!form.destination || genCount >= 3}
                className="ml-auto flex items-center gap-2 bg-teal-900 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" /> Generate Itinerary
              </button>
            </>
          )}
          {step === 'result' && (
            <>
              <button onClick={() => setStep('form')} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-800 transition border border-stone-200 rounded-full hover:bg-stone-50">
                <Edit3 className="w-3.5 h-3.5" /> Customize
              </button>
              <button onClick={generate} disabled={genCount >= 3} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-800 transition border border-stone-200 rounded-full hover:bg-stone-50 disabled:opacity-40">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
              <button onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-700 transition">
                <Trash2 className="w-3.5 h-3.5" /> Discard
              </button>
              <button
                onClick={applyToTrip}
                disabled={applying}
                className="ml-auto flex items-center gap-2 bg-teal-900 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-teal-800 transition disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                Use This Itinerary
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
