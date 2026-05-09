import { Plane, Wallet, Map, Sparkles, Users, ArrowRight, Check, Compass, Globe2, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  onGetStarted: () => void;
  onSignIn: () => void;
};

export function Landing({ onGetStarted, onSignIn }: Props) {
  const { theme, toggleTheme } = useTheme();
  const features = [
    { icon: Map, title: 'Trip Planning', desc: 'Build shared itineraries day-by-day with your crew. Drag, drop, and collaborate in real time.' },
    { icon: Wallet, title: 'Expense Splitting', desc: 'Track every expense and settle up with smart algorithms that minimize transactions.' },
    { icon: Plane, title: 'Unified Booking', desc: 'Hotels, transport and activities from one elegant surface. Vote and book together.' },
    { icon: Sparkles, title: 'AI Travel Assistant', desc: 'Personalized itineraries, budget optimization and local tips tailored to your group.' },
    { icon: Users, title: 'Real-Time Collab', desc: 'Group chat, live updates, presence and notifications keep everyone in sync.' },
    { icon: Globe2, title: 'Any Destination', desc: 'From Kyoto to Cusco — plan trips in any currency, any timezone, any group size.' },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-50'}`}>
      <nav className={`fixed top-0 inset-x-0 z-50 backdrop-blur-lg transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/80 border-slate-700/60' : 'bg-stone-50/80 border-stone-200/60'} border-b`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-900 flex items-center justify-center">
              <Compass className="w-5 h-5 text-amber-300" />
            </div>
            <span className="font-display text-xl font-bold text-teal-950">Wayfare</span>
          </div>
          <div className={`hidden md:flex items-center gap-8 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-stone-700'}`}>
            <a href="#features" className="hover:text-teal-400 transition">Features</a>
            <a href="#how" className="hover:text-teal-400 transition">How it works</a>
            <a href="#pricing" className="hover:text-teal-400 transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition ${theme === 'dark' ? 'text-amber-400 hover:bg-slate-700' : 'text-stone-500 hover:bg-stone-100'}`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={onSignIn} className={`text-sm font-medium transition ${theme === 'dark' ? 'text-slate-400 hover:text-slate-100' : 'text-stone-700 hover:text-teal-900'}`}>Sign in</button>
            <button onClick={onGetStarted} className="text-sm font-medium bg-teal-900 text-stone-50 px-4 py-2 rounded-full hover:bg-teal-800 transition">Get started</button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-in">
            <div className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-6 ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-900'}`}>
              <Sparkles className="w-3.5 h-3.5" />
              Built for groups. Powered by AI.
            </div>
            <h1 className={`font-display text-5xl md:text-7xl font-bold leading-[1.05] mb-6 ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>
              Plan, book and split <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}>every trip</span> together.
            </h1>
            <p className={`text-lg mb-8 leading-relaxed max-w-lg ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>
              Wayfare brings itineraries, bookings and expense splitting into one calm workspace — so your group travels like one brain.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={onGetStarted} className="group inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-6 py-3.5 rounded-full font-medium hover:bg-teal-800 transition">
                Start a trip free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </button>
              <button onClick={onSignIn} className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium transition ${theme === 'dark' ? 'border border-slate-600 text-slate-200 hover:bg-slate-700' : 'border border-stone-300 text-stone-800 hover:bg-stone-100'}`}>
                I have an account
              </button>
            </div>
            <div className={`flex items-center gap-6 mt-10 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>
              <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-700'}`}><Check className="w-4 h-4" /> Free forever</div>
              <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-700'}`}><Check className="w-4 h-4" /> No card required</div>
            </div>
          </div>

          <div className="relative animate-fade-in">
            <div className={`absolute -inset-6 rounded-[2.5rem] blur-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-teal-900/20 via-slate-800/20 to-slate-900' : 'bg-gradient-to-br from-amber-200/40 via-teal-200/40 to-stone-100'}`} />
            <div className={`relative rounded-3xl overflow-hidden shadow-2xl border ${theme === 'dark' ? 'border-slate-700' : 'border-stone-200'}`}>
              <img src="https://images.pexels.com/photos/1008155/pexels-photo-1008155.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Travel" className="w-full h-[520px] object-cover" />
              <div className={`absolute bottom-6 left-6 right-6 backdrop-blur rounded-2xl p-4 shadow-xl ${theme === 'dark' ? 'bg-slate-800/95' : 'bg-white/95'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'}`}>KYOTO 2026</div>
                    <div className={`font-display font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>Cherry Blossom Trip</div>
                  </div>
                  <div className="flex -space-x-2">
                    {['https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100', 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=100', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=100'].map((u, i) => (
                      <img key={i} src={u} className={`w-8 h-8 rounded-full border-2 object-cover ${theme === 'dark' ? 'border-slate-700' : 'border-white'}`} alt="" />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`rounded-lg p-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-50'}`}>
                    <div className={`text-[10px] uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'}`}>Budget</div>
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-teal-400' : 'text-teal-900'}`}>$3,240</div>
                  </div>
                  <div className={`rounded-lg p-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-50'}`}>
                    <div className={`text-[10px] uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'}`}>Spent</div>
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>$1,802</div>
                  </div>
                  <div className={`rounded-lg p-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-stone-50'}`}>
                    <div className={`text-[10px] uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-stone-500'}`}>Days</div>
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-teal-400' : 'text-teal-900'}`}>7</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={`py-24 px-6 transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <div className={`text-sm font-semibold uppercase tracking-wide mb-3 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>What's inside</div>
            <h2 className={`font-display text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>Everything your group needs, nothing it doesn't.</h2>
            <p className={`text-lg leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>Five focused tools that replace the dozen apps you juggle today.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className={`group p-7 rounded-2xl border transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-700/30 hover:border-teal-500 hover:shadow-xl' : 'border-stone-200 bg-stone-50/40 hover:border-teal-800 hover:shadow-xl'}`}>
                <div className="w-12 h-12 rounded-xl bg-teal-900 flex items-center justify-center mb-5 group-hover:rotate-3 transition-transform">
                  <f.icon className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className={`font-display text-xl font-bold mb-2 ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>{f.title}</h3>
                <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-24 px-6 bg-teal-950 text-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <div className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">How it works</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">From idea to boarding pass in three steps.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '01', t: 'Create your trip', d: 'Set a destination, dates and budget. Invite your group with one link.' },
              { n: '02', t: 'Plan together', d: 'Build the itinerary, book hotels and add activities — everyone contributes.' },
              { n: '03', t: 'Split and settle', d: 'Expenses split automatically. Settle up in one tap when you get home.' },
            ].map((s) => (
              <div key={s.n} className="border-t border-stone-100/20 pt-6">
                <div className="font-display text-5xl font-bold text-amber-400 mb-4">{s.n}</div>
                <h3 className="font-display text-2xl font-semibold mb-2">{s.t}</h3>
                <p className="text-stone-300 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className={`py-24 px-6 transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-50'}`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className={`font-display text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-slate-100' : 'text-teal-950'}`}>Ready when you are.</h2>
          <p className={`text-lg mb-10 ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>Start planning with your group — no credit card, no hidden fees.</p>
          <button onClick={onGetStarted} className="group inline-flex items-center gap-2 bg-teal-900 text-stone-50 px-8 py-4 rounded-full font-medium hover:bg-teal-800 transition">
            Create your first trip
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
      </section>

      <footer className="border-t border-stone-200 py-10 px-6 bg-stone-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-stone-500">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4" />
            <span className="font-display font-semibold text-teal-950">Wayfare</span>
            <span>© 2026</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-teal-900">Privacy</a>
            <a href="#" className="hover:text-teal-900">Terms</a>
            <a href="#" className="hover:text-teal-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
