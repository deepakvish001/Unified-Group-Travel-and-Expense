import { useEffect, useState } from 'react';
import { Plus, Compass, LogOut, Calendar, MapPin, Users, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import type { Trip } from '../lib/types';
import { NewTripModal } from './NewTripModal';
import { NotificationCenter } from './NotificationCenter';

type Props = {
  onOpenTrip: (id: string) => void;
};

const COVER_OPTIONS = [
  'https://images.pexels.com/photos/2356059/pexels-photo-2356059.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3581369/pexels-photo-3581369.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=800',
];

export function Dashboard({ onOpenTrip }: Props) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    setTrips(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upcoming = trips.filter(t => t.status !== 'completed');
  const past = trips.filter(t => t.status === 'completed');

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-50'} transition-colors duration-300`}>
      <nav className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-40 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-900 flex items-center justify-center">
              <Compass className="w-5 h-5 text-amber-300" />
            </div>
            <span className="font-display text-xl font-bold text-teal-950">Wayfare</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition ${theme === 'dark' ? 'text-amber-400 hover:bg-slate-700' : 'text-stone-500 hover:bg-stone-100'}`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <div className={`text-right hidden sm:block ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>
              <div className="text-sm font-medium">{profile?.full_name || 'Traveler'}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'}`}>{profile?.email}</div>
            </div>
            <div className={`w-9 h-9 rounded-full ${theme === 'dark' ? 'bg-slate-700' : 'bg-teal-900'} text-amber-300 flex items-center justify-center font-semibold text-sm`}>
              {(profile?.full_name || '?').charAt(0).toUpperCase()}
            </div>
            <button onClick={signOut} className={`p-2 transition ${theme === 'dark' ? 'text-slate-400 hover:text-amber-400' : 'text-stone-500 hover:text-teal-900'}`} title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <div className={`text-sm font-medium uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>Your Trips</div>
            <h1 className={`font-display text-4xl md:text-5xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>Where to next?</h1>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-5 py-3 rounded-full font-medium hover:bg-teal-800 transition"
          >
            <Plus className="w-4 h-4" /> New trip
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => (
              <div key={i} className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-200'} rounded-2xl overflow-hidden border animate-pulse`}>
                <div className={`h-44 ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-200'}`} />
                <div className="p-5 space-y-3">
                  <div className={`h-5 rounded w-2/3 ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-200'}`} />
                  <div className={`h-4 rounded w-1/2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-100'}`} />
                  <div className={`h-3 rounded w-full ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-100'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState onCreate={() => setShowNew(true)} />
        ) : (
          <div className="space-y-12">
            <TripSection title="Upcoming & Active" trips={upcoming} onOpen={onOpenTrip} />
            {past.length > 0 && <TripSection title="Past Trips" trips={past} onOpen={onOpenTrip} />}
          </div>
        )}
      </main>

      {showNew && (
        <NewTripModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); load(); onOpenTrip(id); }}
          covers={COVER_OPTIONS}
        />
      )}
    </div>
  );
}

function TripSection({ title, trips, onOpen }: { title: string; trips: Trip[]; onOpen: (id: string) => void }) {
  const { theme } = useTheme();
  if (trips.length === 0) return null;
  return (
    <section>
      <h2 className={`font-display text-2xl font-semibold mb-5 ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {trips.map((t) => <TripCard key={t.id} trip={t} onOpen={() => onOpen(t.id)} />)}
      </div>
    </section>
  );
}

function TripCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const { theme } = useTheme();
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  return (
    <button
      onClick={onOpen}
      className={`group text-left rounded-2xl overflow-hidden border hover:shadow-xl hover:-translate-y-0.5 transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-200'}`}
    >
      <div className="relative h-44 overflow-hidden">
        <img src={trip.cover_url || 'https://images.pexels.com/photos/2356059/pexels-photo-2356059.jpeg?auto=compress&cs=tinysrgb&w=800'} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur text-[10px] font-semibold uppercase tracking-wide text-teal-900 px-2.5 py-1 rounded-full">
            {trip.status}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className={`font-display text-xl font-bold mb-1 truncate ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>{trip.name}</h3>
        <div className={`flex items-center gap-1.5 text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>
          <MapPin className="w-3.5 h-3.5" /> {trip.destination || 'Destination TBD'}
        </div>
        <div className={`flex items-center justify-between text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'}`}>
          <div className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {fmt(trip.start_date)} – {fmt(trip.end_date)}</div>
          <div className={`inline-flex items-center gap-1 font-medium ${theme === 'dark' ? 'text-amber-400' : 'text-teal-900'}`}>{trip.currency} {Number(trip.budget).toLocaleString()}</div>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { theme } = useTheme();
  return (
    <div className={`border border-dashed rounded-3xl p-16 text-center ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-stone-300'}`}>
      <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-900 flex items-center justify-center mb-6">
        <Users className="w-7 h-7 text-amber-300" />
      </div>
      <h3 className={`font-display text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>No trips yet</h3>
      <p className={`mb-6 max-w-md mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>Create your first trip, invite your group and start planning together.</p>
      <button onClick={onCreate} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-5 py-3 rounded-full font-medium hover:bg-teal-800 transition">
        <Plus className="w-4 h-4" /> Create a trip
      </button>
    </div>
  );
}
