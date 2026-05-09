import { useEffect, useMemo, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, ExternalLink, Copy, Download, Share2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { BookingType, BookingPriority, TravelerProfile } from '../../lib/types';
import type { PlaceResult } from '../../lib/discovery';
import { BOOKING_TYPE_META, BOOKING_TYPE_KEYS, BOOKING_CATEGORY_MAP } from './constants';
import { computeCompleteness, toCSV, downloadBlob, currencyFmt, memberName, type MemberRow } from './utils';

type Props = {
  tripId: string; currency: string; members: MemberRow[];
  onClose: () => void; onSaved: () => void;
  prefill?: PlaceResult | null;
};

function inferTypeFromPlace(p: PlaceResult): BookingType {
  const t = (p.type || '').toLowerCase() + ' ' + (p.types || []).join(' ').toLowerCase();
  if (/hotel|resort|hostel|stay|lodg/.test(t)) return 'hotel';
  if (/restaurant|cafe|bar|food/.test(t)) return 'activity';
  return 'activity';
}

export function CreateBookingWizard({ tripId, currency, members, onClose, onSaved, prefill }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(prefill ? 2 : 1);
  const [type, setType] = useState<BookingType>(prefill ? inferTypeFromPlace(prefill) : 'train');
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [travelDate, setTravelDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [coordinator, setCoordinator] = useState<string>(user?.id ?? '');
  const [estimated, setEstimated] = useState('');
  const [priority, setPriority] = useState<BookingPriority>('medium');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<Record<string, string | number>>(prefill ? {
    hotel_name: prefill.title, location: prefill.address || '', provider: prefill.title,
    website: prefill.website || '', phone: prefill.phone || '',
  } : {});
  const [participants, setParticipants] = useState<Set<string>>(new Set(members.map(m => m.user_id)));
  const [vaults, setVaults] = useState<Record<string, TravelerProfile>>({});
  const [createLinkedExpense, setCreateLinkedExpense] = useState(false);
  const [externalUrl, setExternalUrl] = useState(prefill?.website ?? '');
  const [saving, setSaving] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const ids = members.map(m => m.user_id);
      if (!ids.length) return;
      const { data } = await supabase.from('traveler_profiles').select('*').in('user_id', ids);
      const map: Record<string, TravelerProfile> = {};
      (data ?? []).forEach(v => { map[v.user_id] = v; });
      setVaults(map);
    };
    load();
  }, [members]);

  const togglePart = (id: string) => {
    const n = new Set(participants);
    if (n.has(id)) n.delete(id); else n.add(id);
    setParticipants(n);
  };

  const typeMeta = BOOKING_TYPE_META[type];

  const canNext = useMemo(() => {
    if (step === 1) return !!type;
    if (step === 2) return !!title.trim() && !!coordinator;
    if (step === 3) return participants.size > 0;
    return true;
  }, [step, type, title, coordinator, participants]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const amt = Number(estimated) || 0;
    const { data: booking, error } = await supabase.from('bookings').insert({
      trip_id: tripId, type, title, currency,
      provider: String(details.provider || ''), location: String(details.from || details.location || details.hotel_name || ''),
      image_url: '', cost: amt, estimated_cost: amt, status: 'pending',
      priority, assigned_coordinator: coordinator,
      booking_deadline: deadline || null, travel_date: travelDate || null,
      details, notes, external_booking_url: externalUrl,
      created_by: user.id, last_edited_by: user.id,
    }).select().maybeSingle();

    if (error || !booking) { setSaving(false); return; }

    const rows = Array.from(participants).map(uid => ({
      booking_id: booking.id, user_id: uid, participation_status: 'included' as const, added_by: user.id,
    }));
    if (rows.length) await supabase.from('booking_participants').insert(rows);

    await supabase.from('booking_activity_logs').insert({
      booking_id: booking.id, trip_id: tripId, action: 'created',
      performed_by: user.id, message: `Created ${typeMeta.label} booking "${title}"`,
    });
    await supabase.from('trip_activity_logs').insert({
      trip_id: tripId, actor_id: user.id, action_type: 'booking_created',
      description: `Created ${typeMeta.label} booking "${title}"`,
      related_entity_type: 'booking', related_entity_id: booking.id,
    });

    if (coordinator && coordinator !== user.id) {
      await supabase.from('notifications').insert({
        user_id: coordinator, trip_id: tripId, type: 'booking',
        title: 'New booking assigned',
        body: `${typeMeta.label} booking "${title}" is assigned to you${deadline ? ` — due ${new Date(deadline).toLocaleString()}` : ''}`,
      });
    }

    if (createLinkedExpense) {
      const { data: exp } = await supabase.from('expenses').insert({
        trip_id: tripId, title, amount: amt, currency, category: BOOKING_CATEGORY_MAP[type] || 'other',
        paid_by: coordinator, expense_type: 'group', split_type: 'equal',
        expense_date: travelDate || new Date().toISOString().slice(0, 10),
        notes: `Auto-linked from booking: ${title}`, status: 'normal', created_by: user.id,
      }).select().maybeSingle();
      if (exp) {
        const splits = Array.from(participants).map(uid => ({
          expense_id: exp.id, user_id: uid, amount: participants.size ? amt / participants.size : 0,
        }));
        if (splits.length) await supabase.from('expense_splits').insert(splits);
        await supabase.from('bookings').update({ linked_expense_id: exp.id }).eq('id', booking.id);
      }
    }

    setBookingId(booking.id);
    setStep(5);
    setSaving(false);
    onSaved();
  };

  const exportCSV = () => {
    const rows = Array.from(participants).map(uid => {
      const v = vaults[uid];
      return {
        Name: v?.full_name || memberName(uid, members),
        DOB: v?.date_of_birth || '',
        Gender: v?.gender || '',
        Phone: v ? `${v.phone_country_code} ${v.phone_number}` : '',
        Email: v?.email || '',
        Nationality: v?.nationality || '',
        Seat: v?.seat_preference || '',
        Food: v?.food_preference || '',
        Berth: v?.berth_preference || '',
        'ID Verified': v?.id_verified ? `Yes (${v.id_type} ••••${v.id_last_four})` : 'No',
        Special: v?.special_requirements || '',
      };
    });
    downloadBlob(toCSV(rows), `${title || 'travelers'}.csv`);
  };

  const copyFormatted = async () => {
    const lines = Array.from(participants).map((uid, i) => {
      const v = vaults[uid];
      const n = v?.full_name || memberName(uid, members);
      return `${i + 1}. ${n}${v?.date_of_birth ? ` | DOB: ${v.date_of_birth}` : ''}${v?.gender ? ` | ${v.gender}` : ''}${v ? ` | ${v.phone_country_code} ${v.phone_number}` : ''}${v?.food_preference && v.food_preference !== 'no_preference' ? ` | Food: ${v.food_preference}` : ''}`;
    }).join('\n');
    const summary = `${typeMeta.label} — ${title}\nTravel: ${travelDate || 'TBD'}\n\n${lines}`;
    await navigator.clipboard.writeText(summary);
  };

  const shareWhatsApp = () => {
    const text = `${typeMeta.label} booking: ${title}\nTravelers: ${participants.size}\nEstimated cost: ${currencyFmt(Number(estimated) || 0, currency)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <h3 className="font-display text-xl font-bold text-teal-950">New booking coordination</h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`h-1.5 w-8 rounded-full transition-all ${step >= s ? 'bg-teal-800' : 'bg-stone-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {step === 1 && (
            <div>
              <div className="text-sm text-stone-600 mb-3">Choose what you're coordinating</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {BOOKING_TYPE_KEYS.map(t => {
                  const M = BOOKING_TYPE_META[t]; const Icon = M.icon; const active = type === t;
                  return (
                    <button key={t} onClick={() => setType(t)} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${active ? 'border-teal-800 bg-teal-50' : 'border-stone-200 hover:border-stone-300'}`}>
                      <Icon className="w-6 h-6 text-teal-900" />
                      <span className="text-xs font-semibold text-teal-950">{M.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Field label="Booking title"><input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${typeMeta.label} to ...`} className="input" /></Field>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Travel date"><input type="date" value={travelDate} onChange={e => setTravelDate(e.target.value)} className="input" /></Field>
                <Field label="Booking deadline"><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="input" /></Field>
                <Field label="Assigned coordinator">
                  <select value={coordinator} onChange={e => setCoordinator(e.target.value)} className="input bg-white">
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
                  </select>
                </Field>
                <Field label={`Estimated cost (${currency})`}><input type="number" step="0.01" value={estimated} onChange={e => setEstimated(e.target.value)} className="input" /></Field>
                <Field label="Priority">
                  <select value={priority} onChange={e => setPriority(e.target.value as BookingPriority)} className="input bg-white">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </Field>
                <Field label="External platform URL (optional)"><input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." className="input" /></Field>
              </div>
              <TypeFields type={type} details={details} setDetails={setDetails} />
              <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" /></Field>
              {deadline && travelDate && new Date(deadline) > new Date(travelDate + 'T23:59') && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Deadline is after travel date.</div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-stone-700 font-medium">{participants.size} of {members.length} travelers selected</div>
                <div className="flex gap-2">
                  <button onClick={() => setParticipants(new Set(members.map(m => m.user_id)))} className="text-xs text-teal-800 hover:underline">Select all</button>
                  <button onClick={() => setParticipants(new Set())} className="text-xs text-stone-500 hover:underline">Clear</button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {members.map(m => {
                  const inc = participants.has(m.user_id);
                  const v = vaults[m.user_id];
                  const { pct, missing } = computeCompleteness(v || null);
                  const ready = pct === 100;
                  return (
                    <label key={m.user_id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${inc ? 'bg-teal-50 border border-teal-200' : 'bg-stone-50 border border-stone-200 hover:bg-stone-100'}`}>
                      <input type="checkbox" checked={inc} onChange={() => togglePart(m.user_id)} className="w-4 h-4 accent-teal-900" />
                      <div className="w-9 h-9 rounded-full bg-amber-300 text-teal-950 flex items-center justify-center font-bold text-sm">{(m.profile.full_name || '?').charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-teal-950 truncate">{m.profile.full_name}</div>
                        <div className={`text-xs flex items-center gap-1 ${ready ? 'text-teal-700' : 'text-amber-700'}`}>
                          {ready ? <><Check className="w-3 h-3" /> Profile complete</> : <><AlertTriangle className="w-3 h-3" /> Missing {missing.slice(0, 2).join(', ')}{missing.length > 2 ? '...' : ''}</>}
                        </div>
                      </div>
                      {inc && Number(estimated) > 0 && participants.size > 0 && (
                        <div className="text-xs text-stone-600">{currencyFmt(Number(estimated) / participants.size, currency)}</div>
                      )}
                    </label>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 mt-4 text-sm text-teal-900 cursor-pointer">
                <input type="checkbox" checked={createLinkedExpense} onChange={e => setCreateLinkedExpense(e.target.checked)} className="w-4 h-4 accent-teal-900" />
                Auto-create linked expense (split equally among participants)
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-950">
                <div className="font-semibold mb-2">Summary</div>
                <Row k="Type" v={typeMeta.label} />
                <Row k="Title" v={title} />
                <Row k="Travel date" v={travelDate || 'TBD'} />
                <Row k="Deadline" v={deadline ? new Date(deadline).toLocaleString() : 'None'} />
                <Row k="Coordinator" v={memberName(coordinator, members)} />
                <Row k="Estimated cost" v={currencyFmt(Number(estimated) || 0, currency)} />
                <Row k="Travelers" v={`${participants.size}`} />
                {createLinkedExpense && <Row k="Linked expense" v="Will be auto-created" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-teal-950 mb-2">Traveler readiness</div>
                <div className="space-y-1">
                  {Array.from(participants).map(uid => {
                    const v = vaults[uid]; const { pct, missing } = computeCompleteness(v || null);
                    const ready = pct === 100;
                    return (
                      <div key={uid} className="flex items-center justify-between text-sm bg-white border border-stone-200 rounded-lg px-3 py-2">
                        <span className="text-teal-950">{memberName(uid, members)}</span>
                        <span className={`text-xs font-medium ${ready ? 'text-teal-700' : 'text-amber-700'}`}>
                          {ready ? 'Complete' : `Missing: ${missing.join(', ')}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-100 text-teal-800 mb-3"><Check className="w-7 h-7" /></div>
                <div className="font-display text-xl font-bold text-teal-950">Booking coordination ready</div>
                <p className="text-sm text-stone-600 mt-1">Export traveler data, open your preferred platform, and complete the reservation.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 text-sm font-medium">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
                <button onClick={copyFormatted} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-teal-900 rounded-lg text-sm font-medium">
                  <Copy className="w-4 h-4" /> Copy details
                </button>
                <button onClick={shareWhatsApp} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-teal-900 rounded-lg text-sm font-medium col-span-2">
                  <Share2 className="w-4 h-4" /> Share on WhatsApp
                </button>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Open booking platform</div>
                <div className="grid grid-cols-2 gap-2">
                  {typeMeta.platforms.map(p => (
                    <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-between gap-2 px-3 py-2.5 border border-stone-200 hover:border-teal-300 hover:bg-teal-50 rounded-lg text-sm text-teal-900">
                      {p.label} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ))}
                  {externalUrl && (
                    <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-between gap-2 px-3 py-2.5 border border-stone-200 hover:border-teal-300 hover:bg-teal-50 rounded-lg text-sm text-teal-900">
                      Custom link <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-stone-50">
          {step > 1 && step < 5 ? (
            <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 text-stone-700 hover:bg-stone-200 px-3 py-2 rounded-lg text-sm"><ArrowLeft className="w-4 h-4" /> Back</button>
          ) : <span />}
          {step < 4 && (
            <button onClick={() => setStep(step + 1)} disabled={!canNext} className="inline-flex items-center gap-1 bg-teal-900 text-stone-50 hover:bg-teal-800 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 4 && (
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 hover:bg-teal-800 px-4 py-2 rounded-lg text-sm disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & prepare <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 5 && (
            <button onClick={onClose} className="inline-flex items-center gap-2 bg-teal-900 text-stone-50 hover:bg-teal-800 px-4 py-2 rounded-lg text-sm">Done</button>
          )}
        </div>
      </div>
      <style>{`.input{width:100%;padding:.5rem .75rem;border:1px solid #d6d3d1;border-radius:.5rem;font-size:.875rem}`}</style>
      <span className="hidden">{bookingId}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between py-0.5 text-sm"><span className="text-stone-600">{k}</span><span className="font-medium text-teal-950">{v}</span></div>;
}

function TypeFields({ type, details, setDetails }: { type: BookingType; details: Record<string, string | number>; setDetails: (d: Record<string, string | number>) => void }) {
  const set = (k: string, v: string | number) => setDetails({ ...details, [k]: v });
  const cls = 'input';
  if (type === 'train' || type === 'bus' || type === 'flight' || type === 'car_rental') {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <Field label={type === 'flight' ? 'From airport' : 'From'}><input value={String(details.from || '')} onChange={e => set('from', e.target.value)} className={cls} /></Field>
        <Field label={type === 'flight' ? 'To airport' : 'To'}><input value={String(details.to || '')} onChange={e => set('to', e.target.value)} className={cls} /></Field>
        <Field label="Departure time"><input type="time" value={String(details.depart_time || '')} onChange={e => set('depart_time', e.target.value)} className={cls} /></Field>
        {type === 'flight' && <Field label="Return date"><input type="date" value={String(details.return_date || '')} onChange={e => set('return_date', e.target.value)} className={cls} /></Field>}
        <Field label="Class / Type">
          <select value={String(details.class || '')} onChange={e => set('class', e.target.value)} className={`${cls} bg-white`}>
            <option value="">Select</option>
            {type === 'train' && <><option>AC 1A</option><option>AC 2A</option><option>AC 3A</option><option>Sleeper</option><option>General</option></>}
            {type === 'flight' && <><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option></>}
            {type === 'bus' && <><option>AC Sleeper</option><option>AC Seater</option><option>Non-AC</option></>}
            {type === 'car_rental' && <><option>Hatchback</option><option>Sedan</option><option>SUV</option></>}
          </select>
        </Field>
      </div>
    );
  }
  if (type === 'hotel') {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Hotel / area"><input value={String(details.hotel_name || '')} onChange={e => set('hotel_name', e.target.value)} className={cls} /></Field>
        <Field label="Location"><input value={String(details.location || '')} onChange={e => set('location', e.target.value)} className={cls} /></Field>
        <Field label="Check-in"><input type="date" value={String(details.check_in || '')} onChange={e => set('check_in', e.target.value)} className={cls} /></Field>
        <Field label="Check-out"><input type="date" value={String(details.check_out || '')} onChange={e => set('check_out', e.target.value)} className={cls} /></Field>
        <Field label="Room type">
          <select value={String(details.room_type || '')} onChange={e => set('room_type', e.target.value)} className={`${cls} bg-white`}>
            <option value="">Select</option><option>Single</option><option>Double</option><option>Suite</option>
          </select>
        </Field>
        <Field label="Number of rooms"><input type="number" min="1" value={String(details.num_rooms || '')} onChange={e => set('num_rooms', e.target.value)} className={cls} /></Field>
      </div>
    );
  }
  if (type === 'activity' || type === 'event_ticket') {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Activity / event name"><input value={String(details.activity_name || '')} onChange={e => set('activity_name', e.target.value)} className={cls} /></Field>
        <Field label="Location"><input value={String(details.location || '')} onChange={e => set('location', e.target.value)} className={cls} /></Field>
        <Field label="Time"><input type="time" value={String(details.activity_time || '')} onChange={e => set('activity_time', e.target.value)} className={cls} /></Field>
        <Field label="Duration (minutes)"><input type="number" value={String(details.duration || '')} onChange={e => set('duration', e.target.value)} className={cls} /></Field>
        <Field label="Type">
          <select value={String(details.activity_type || '')} onChange={e => set('activity_type', e.target.value)} className={`${cls} bg-white`}>
            <option value="">Select</option><option>Adventure</option><option>Sightseeing</option><option>Cultural</option><option>Entertainment</option>
          </select>
        </Field>
      </div>
    );
  }
  return null;
}
