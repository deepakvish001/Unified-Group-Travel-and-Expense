import { useEffect, useState } from 'react';
import { Plus, Hotel, Plane, Ticket, Star, MapPin, Trash2, Check, ThumbsUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Booking, BookingVote } from '../../lib/types';

type BookingType = 'hotel' | 'transport' | 'activity';

const CATALOG: Record<BookingType, { title: string; provider: string; location: string; cost: number; image: string; rating: number }[]> = {
  hotel: [
    { title: 'Hoshinoya Ryokan', provider: 'Hoshinoya', location: 'Kyoto, Japan', cost: 480, rating: 4.9, image: 'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'The Thief', provider: 'Design Hotels', location: 'Oslo, Norway', cost: 320, rating: 4.7, image: 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Casa Bonay', provider: 'Boutique', location: 'Barcelona, Spain', cost: 210, rating: 4.8, image: 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Riad El Fenn', provider: 'Riad Collection', location: 'Marrakech, Morocco', cost: 260, rating: 4.9, image: 'https://images.pexels.com/photos/210604/pexels-photo-210604.jpeg?auto=compress&cs=tinysrgb&w=800' },
  ],
  transport: [
    { title: 'Shinkansen Bullet Train', provider: 'JR Rail', location: 'Tokyo → Kyoto', cost: 140, rating: 4.9, image: 'https://images.pexels.com/photos/5214413/pexels-photo-5214413.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Economy Flight', provider: 'Lufthansa', location: 'JFK → BCN', cost: 540, rating: 4.5, image: 'https://images.pexels.com/photos/46148/aircraft-jet-landing-cloud-46148.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Rental SUV', provider: 'Hertz', location: '7 days', cost: 380, rating: 4.4, image: 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Private Transfer', provider: 'BlackLane', location: 'Airport pickup', cost: 95, rating: 4.8, image: 'https://images.pexels.com/photos/385998/pexels-photo-385998.jpeg?auto=compress&cs=tinysrgb&w=800' },
  ],
  activity: [
    { title: 'Fushimi Inari Guided Tour', provider: 'GetYourGuide', location: 'Kyoto', cost: 45, rating: 4.8, image: 'https://images.pexels.com/photos/161251/senso-ji-temple-japan-kyoto-landmark-161251.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Sushi Making Class', provider: 'Airbnb Experiences', location: 'Tokyo', cost: 110, rating: 4.9, image: 'https://images.pexels.com/photos/884596/pexels-photo-884596.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Tapas Food Crawl', provider: 'Devour Tours', location: 'Barcelona', cost: 85, rating: 4.9, image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { title: 'Atlas Mountain Trek', provider: 'Local Guide', location: 'Morocco', cost: 70, rating: 4.7, image: 'https://images.pexels.com/photos/414519/pexels-photo-414519.jpeg?auto=compress&cs=tinysrgb&w=800' },
  ],
};

const TYPE_META: Record<BookingType, { icon: typeof Hotel; label: string }> = {
  hotel: { icon: Hotel, label: 'Hotels' },
  transport: { icon: Plane, label: 'Transport' },
  activity: { icon: Ticket, label: 'Activities' },
};

export function BookingsPanel({ tripId, currency }: { tripId: string; currency: string }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [votes, setVotes] = useState<BookingVote[]>([]);
  const [type, setType] = useState<BookingType>('hotel');

  const load = async () => {
    const { data } = await supabase.from('bookings').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    setBookings(data ?? []);
    const ids = (data ?? []).map(b => b.id);
    if (ids.length) {
      const { data: v } = await supabase.from('booking_votes').select('*').in('booking_id', ids);
      setVotes(v ?? []);
    } else setVotes([]);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`bookings:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `trip_id=eq.${tripId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_votes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const voteBooking = async (bookingId: string) => {
    if (!user) return;
    const existing = votes.find(v => v.booking_id === bookingId && v.user_id === user.id);
    if (existing) await supabase.from('booking_votes').delete().eq('id', existing.id);
    else await supabase.from('booking_votes').insert({ booking_id: bookingId, user_id: user.id, value: 1 });
  };
  const bookingVotes = (id: string) => {
    const list = votes.filter(v => v.booking_id === id);
    return { count: list.length, mine: list.some(v => v.user_id === user?.id) };
  };

  const book = async (opt: typeof CATALOG[BookingType][number]) => {
    if (!user) return;
    await supabase.from('bookings').insert({
      trip_id: tripId, type, title: opt.title, provider: opt.provider, location: opt.location,
      image_url: opt.image, cost: opt.cost, currency, created_by: user.id, status: 'proposed',
    });
  };

  const confirm = async (id: string) => {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
  };

  const remove = async (id: string) => {
    await supabase.from('bookings').delete().eq('id', id);
  };

  const booked = bookings.filter(b => b.type === type);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-teal-950">Bookings</h2>
        <p className="text-stone-600 text-sm">Reserve hotels, transport and activities for your group.</p>
      </div>

      <div className="flex gap-2 border-b border-stone-200">
        {(Object.keys(TYPE_META) as BookingType[]).map((k) => {
          const M = TYPE_META[k];
          const Icon = M.icon;
          return (
            <button key={k} onClick={() => setType(k)} className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${type === k ? 'border-teal-900 text-teal-900' : 'border-transparent text-stone-500 hover:text-teal-900'}`}>
              <Icon className="w-4 h-4" /> {M.label}
            </button>
          );
        })}
      </div>

      {booked.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-3">Booked</div>
          <div className="grid md:grid-cols-2 gap-4">
            {booked.map((b) => {
              const vs = bookingVotes(b.id);
              const isConfirmed = b.status === 'confirmed';
              return (
              <div key={b.id} className={`group bg-white rounded-2xl border overflow-hidden flex ${isConfirmed ? 'border-teal-800/30' : 'border-amber-300/60'}`}>
                <img src={b.image_url} alt="" className="w-32 object-cover" />
                <div className="p-4 flex-1 min-w-0">
                  <div className={`flex items-center gap-2 text-xs font-medium mb-1 ${isConfirmed ? 'text-teal-800' : 'text-amber-700'}`}>
                    {isConfirmed ? <><Check className="w-3 h-3" /> Confirmed</> : 'Proposed'}
                  </div>
                  <h4 className="font-semibold text-teal-950 truncate">{b.title}</h4>
                  <div className="text-xs text-stone-500 mb-2">{b.provider}</div>
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="text-stone-600 inline-flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" />{b.location}</span>
                    <span className="font-semibold text-teal-900 flex-shrink-0">{b.currency} {Number(b.cost).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => voteBooking(b.id)} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition ${vs.mine ? 'bg-teal-900 text-amber-300' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                      <ThumbsUp className="w-3 h-3" /> {vs.count}
                    </button>
                    {!isConfirmed && <button onClick={() => confirm(b.id)} className="text-xs text-teal-900 font-medium hover:underline">Confirm</button>}
                  </div>
                </div>
                <button onClick={() => remove(b.id)} className="p-3 text-stone-400 hover:text-red-600 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );})}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Browse {TYPE_META[type].label.toLowerCase()}</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATALOG[type].map((opt, i) => (
            <div key={i} className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <div className="relative h-40 overflow-hidden">
                <img src={opt.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-2 right-2 bg-white/95 rounded-full px-2 py-0.5 text-xs font-semibold text-teal-900 inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />{opt.rating}
                </div>
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-teal-950 truncate">{opt.title}</h4>
                <div className="text-xs text-stone-500">{opt.provider}</div>
                <div className="text-xs text-stone-500 flex items-center gap-1 mt-1 mb-3"><MapPin className="w-3 h-3" />{opt.location}</div>
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg font-bold text-teal-950">{currency} {opt.cost}</div>
                  <button onClick={() => book(opt)} className="inline-flex items-center gap-1 text-xs font-medium bg-teal-900 text-stone-50 px-3 py-1.5 rounded-full hover:bg-teal-800">
                    <Plus className="w-3 h-3" />Book
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
