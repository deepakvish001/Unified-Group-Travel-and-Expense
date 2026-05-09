import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Landing } from './components/Landing';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TripDetail } from './components/TripDetail';
import { supabase } from './lib/supabase';

type View =
  | { name: 'landing' }
  | { name: 'auth'; mode: 'signin' | 'signup' }
  | { name: 'dashboard' }
  | { name: 'trip'; id: string };

function getInviteToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('invite');
}

function clearInviteParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.toString());
}

function Root() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>(() => {
    if (getInviteToken()) return { name: 'auth', mode: 'signup' };
    return { name: 'landing' };
  });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const token = getInviteToken();
    if (!user || !token || accepting) return;
    setAccepting(true);
    (async () => {
      const { data, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
      clearInviteParam();
      if (!error && typeof data === 'string') {
        setView({ name: 'trip', id: data });
      } else {
        setView({ name: 'dashboard' });
      }
      setAccepting(false);
    })();
  }, [user]);

  if (loading || accepting) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="w-6 h-6 animate-spin text-teal-900" /></div>;
  }

  if (user) {
    if (view.name === 'trip') return <TripDetail tripId={view.id} onBack={() => setView({ name: 'dashboard' })} />;
    return <Dashboard onOpenTrip={(id) => setView({ name: 'trip', id })} />;
  }

  if (view.name === 'auth') {
    return <Auth mode={view.mode} onBack={() => setView({ name: 'landing' })} onSwitch={(m) => setView({ name: 'auth', mode: m })} />;
  }
  return <Landing onGetStarted={() => setView({ name: 'auth', mode: 'signup' })} onSignIn={() => setView({ name: 'auth', mode: 'signin' })} />;
}

function App() {
  return <ThemeProvider><AuthProvider><Root /></AuthProvider></ThemeProvider>;
}

export default App;
