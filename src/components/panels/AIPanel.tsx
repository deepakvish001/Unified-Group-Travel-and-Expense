import { useState } from 'react';
import { Sparkles, Wand2, TrendingDown, Compass, Lightbulb, AlertTriangle, ClipboardList, BarChart2, Zap } from 'lucide-react';
import type { Trip, TripMember, Profile } from '../../lib/types';
import { AIGeneratorModal } from '../module5/AIGeneratorModal';
import { BudgetOptimizer } from '../module5/BudgetOptimizer';
import { ActivityRecommender } from '../module5/ActivityRecommender';
import { TravelInsights } from '../module5/TravelInsights';
import { ItineraryAnalyzer } from '../module5/ItineraryAnalyzer';
import { SmartAlerts } from '../module5/SmartAlerts';
import { AIActivityLog } from '../module5/AIActivityLog';

type Tab = 'overview' | 'generator' | 'budget' | 'activities' | 'insights' | 'analyzer' | 'alerts' | 'log';

type Props = {
  tripId: string;
  trip: Trip;
  members?: (TripMember & { profile: Profile })[];
  onApplied?: () => void;
};

const TABS: { id: Tab; label: string; icon: typeof Sparkles; badge?: string }[] = [
  { id: 'overview',    label: 'Overview',     icon: Sparkles },
  { id: 'generator',   label: 'Generate',     icon: Wand2 },
  { id: 'budget',      label: 'Budget',       icon: TrendingDown },
  { id: 'activities',  label: 'Activities',   icon: Compass },
  { id: 'insights',    label: 'Insights',     icon: Lightbulb },
  { id: 'analyzer',    label: 'Analyzer',     icon: Zap },
  { id: 'alerts',      label: 'Alerts',       icon: AlertTriangle },
  { id: 'log',         label: 'AI Log',       icon: BarChart2 },
];

type FeatureCardProps = {
  icon: typeof Sparkles;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  gradient: string;
};

function FeatureCard({ icon: Icon, title, description, cta, onClick, gradient }: FeatureCardProps) {
  return (
    <button onClick={onClick} className={`text-left p-5 rounded-2xl ${gradient} border border-white/30 hover:shadow-lg hover:-translate-y-0.5 transition-all group`}>
      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-white/70 mb-3 leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-white/20 px-3 py-1 rounded-full">
        {cta} →
      </span>
    </button>
  );
}

export function AIPanel({ tripId, trip, onApplied }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [showGenerator, setShowGenerator] = useState(false);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-teal-950 rounded-3xl p-8 text-white">
        <div className="absolute -right-12 -top-12 w-56 h-56 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-teal-400/10 rounded-full blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-amber-300/20 text-amber-200 px-3 py-1 rounded-full text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> AI Recommendation & Assistance
            </div>
            <h2 className="font-display text-3xl font-bold mb-2">Your AI Travel Co-pilot</h2>
            <p className="text-stone-300 max-w-lg text-sm leading-relaxed">
              Generate itineraries, optimize your budget, discover activities, get local insights, and keep your trip on track — all powered by AI.
            </p>
          </div>
          <button
            onClick={() => setShowGenerator(true)}
            className="shrink-0 flex items-center gap-2 bg-amber-400 text-teal-950 px-6 py-3 rounded-full font-semibold text-sm hover:bg-amber-300 transition shadow-lg"
          >
            <Wand2 className="w-4 h-4" /> Generate Trip with AI
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-hide border-b border-stone-100">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition ${
                tab === t.id ? 'text-teal-900' : 'text-stone-500 hover:text-teal-800'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {tab === t.id && <span className="absolute bottom-0 inset-x-2 h-0.5 bg-teal-900 rounded-t" />}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                <FeatureCard
                  icon={Wand2}
                  title="AI Trip Generator"
                  description="Create a full day-by-day itinerary with activities, costs, hotels, and transport tailored to your group."
                  cta="Generate itinerary"
                  onClick={() => setShowGenerator(true)}
                  gradient="bg-gradient-to-br from-teal-700 to-teal-900"
                />
                <FeatureCard
                  icon={TrendingDown}
                  title="Budget Optimizer"
                  description="Find cost-saving opportunities, track spending by category, and get actionable suggestions."
                  cta="Optimize budget"
                  onClick={() => setTab('budget')}
                  gradient="bg-gradient-to-br from-green-700 to-green-900"
                />
                <FeatureCard
                  icon={Compass}
                  title="Activity Recommender"
                  description="AI-powered activity suggestions for any day and time slot, filtered by budget and preference."
                  cta="Get suggestions"
                  onClick={() => setTab('activities')}
                  gradient="bg-gradient-to-br from-blue-700 to-blue-900"
                />
                <FeatureCard
                  icon={Lightbulb}
                  title="Travel Insights"
                  description="Local tips, seasonal advice, cultural etiquette, safety info, and best-timing guides."
                  cta="View insights"
                  onClick={() => setTab('insights')}
                  gradient="bg-gradient-to-br from-amber-600 to-amber-800"
                />
                <FeatureCard
                  icon={Zap}
                  title="Itinerary Analyzer"
                  description="AI reviews your schedule for overloading, route inefficiency, and activity variety."
                  cta="Analyze itinerary"
                  onClick={() => setTab('analyzer')}
                  gradient="bg-gradient-to-br from-violet-700 to-violet-900"
                />
                <FeatureCard
                  icon={AlertTriangle}
                  title="Smart Alerts"
                  description="Budget warnings, booking deadlines, spending imbalance, and high-expense detection."
                  cta="View alerts"
                  onClick={() => setTab('alerts')}
                  gradient="bg-gradient-to-br from-rose-600 to-rose-900"
                />
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="w-4 h-4 text-stone-500" />
                  <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">How This Works</span>
                </div>
                <div className="grid md:grid-cols-3 gap-4 text-sm text-stone-600">
                  <div className="flex gap-3">
                    <span className="font-display text-xl font-bold text-teal-900 shrink-0">1</span>
                    <div><strong className="text-stone-800 block">Generate</strong> Use AI to create a complete trip plan based on your preferences and budget.</div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-display text-xl font-bold text-teal-900 shrink-0">2</span>
                    <div><strong className="text-stone-800 block">Optimize</strong> Review AI suggestions, apply budget savings, and add recommended activities.</div>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-display text-xl font-bold text-teal-900 shrink-0">3</span>
                    <div><strong className="text-stone-800 block">Monitor</strong> Get alerts, insights, and itinerary analysis throughout your planning.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'generator' && (
            <div className="space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-teal-900 mb-1">Generate a Complete Trip Itinerary</h3>
                  <p className="text-sm text-teal-700">Tell us your preferences and our AI will build a detailed day-by-day plan with estimated costs, hotel options, and local tips.</p>
                </div>
                <button onClick={() => setShowGenerator(true)} className="shrink-0 flex items-center gap-2 bg-teal-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-800 transition">
                  <Wand2 className="w-4 h-4" /> Open Generator
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                {[
                  { title: 'Smart Prompting', desc: 'Inputs your group size, budget, trip type, and preferences for a tailored plan.' },
                  { title: 'Structured Output', desc: 'Returns day-wise activities with times, costs, and reasons for each choice.' },
                  { title: 'One-Click Import', desc: 'Accepted itineraries auto-populate your Day-by-Day planner with all details.' },
                ].map((f, i) => (
                  <div key={i} className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                    <div className="w-7 h-7 rounded-lg bg-teal-900 text-amber-300 flex items-center justify-center font-bold text-xs mb-2">{i+1}</div>
                    <h4 className="font-semibold text-stone-800 mb-1">{f.title}</h4>
                    <p className="text-xs text-stone-500">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'budget' && <BudgetOptimizer trip={trip} />}
          {tab === 'activities' && <ActivityRecommender trip={trip} onActivityAdded={() => onApplied?.()} />}
          {tab === 'insights' && <TravelInsights trip={trip} />}
          {tab === 'analyzer' && <ItineraryAnalyzer trip={trip} />}
          {tab === 'alerts' && <SmartAlerts trip={trip} />}
          {tab === 'log' && <AIActivityLog tripId={tripId} />}
        </div>
      </div>

      {showGenerator && (
        <AIGeneratorModal
          trip={trip}
          onClose={() => setShowGenerator(false)}
          onApplied={() => { setShowGenerator(false); onApplied?.(); }}
        />
      )}
    </div>
  );
}
