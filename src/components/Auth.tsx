import { useState } from 'react';
import { Compass, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  mode: 'signin' | 'signup';
  onBack: () => void;
  onSwitch: (m: 'signin' | 'signup') => void;
};

export function Auth({ mode, onBack, onSwitch }: Props) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src="https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/80 via-teal-900/40 to-transparent" />
        <div className="relative p-12 flex flex-col justify-between text-stone-50">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm hover:text-amber-300 transition w-fit">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <Compass className="w-6 h-6 text-amber-300" />
              <span className="font-display text-2xl font-bold">Wayfare</span>
            </div>
            <p className="font-display text-3xl font-semibold leading-tight max-w-md">
              "We planned a 14-day Europe trip in an afternoon. Splitting expenses took one minute."
            </p>
            <div className="mt-6 text-sm text-stone-200">— Priya & friends, Barcelona 2025</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">
          <button onClick={onBack} className="lg:hidden inline-flex items-center gap-2 text-sm text-stone-600 mb-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="font-display text-4xl font-bold text-teal-950 mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Start planning'}
          </h1>
          <p className="text-stone-600 mb-8">
            {mode === 'signin' ? 'Sign in to continue your journey.' : 'Create an account to plan with your group.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800 focus:border-transparent"
                  placeholder="Alex Chen"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800 focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-900 text-stone-50 py-3 rounded-xl font-medium hover:bg-teal-800 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-sm text-stone-600 text-center">
            {mode === 'signin' ? (
              <>No account? <button onClick={() => onSwitch('signup')} className="text-teal-900 font-medium hover:underline">Sign up</button></>
            ) : (
              <>Already have one? <button onClick={() => onSwitch('signin')} className="text-teal-900 font-medium hover:underline">Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
