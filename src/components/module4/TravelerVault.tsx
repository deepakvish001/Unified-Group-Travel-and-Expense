import { useEffect, useState } from 'react';
import { User, ShieldCheck, Edit3, Save, X, AlertCircle, BadgeCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { TravelerProfile } from '../../lib/types';
import { computeCompleteness, labelOf } from './utils';

const EMPTY: TravelerProfile = {
  user_id: '', full_name: '', date_of_birth: null, gender: '', phone_country_code: '+91', phone_number: '',
  email: '', nationality: '', seat_preference: 'no_preference', food_preference: 'no_preference',
  berth_preference: 'no_preference', special_requirements: '', id_verified: false, id_type: '',
  id_last_four: '', id_expiry: null, created_at: '', updated_at: '',
};

export function TravelerVault() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TravelerProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [idNumber, setIdNumber] = useState('');
  const [idType, setIdType] = useState('Aadhaar');
  const [idExpiry, setIdExpiry] = useState('');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('traveler_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (data) { setProfile(data); setForm(data); }
    else { setProfile(null); setForm({ ...EMPTY, user_id: user.id, email: user.email || '' }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { ...form, user_id: user.id, updated_at: new Date().toISOString() };
    await supabase.from('traveler_profiles').upsert(payload, { onConflict: 'user_id' });
    setSaving(false); setEditing(false); load();
  };

  const verify = async () => {
    if (!user || !idNumber.trim()) return;
    const last4 = idNumber.replace(/\s/g, '').slice(-4);
    await supabase.from('traveler_profiles').upsert({
      user_id: user.id, id_verified: true, id_type: idType, id_last_four: last4,
      id_expiry: idExpiry || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setIdNumber(''); setIdExpiry(''); setVerifyOpen(false); load();
  };

  if (loading) {
    return <div className="animate-pulse bg-white rounded-2xl border border-stone-200 h-64" />;
  }

  const { pct, missing } = computeCompleteness(profile);

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-teal-950">Edit traveler profile</h3>
          <button onClick={() => { setEditing(false); setForm(profile || { ...EMPTY, user_id: user?.id || '' }); }} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Full name (as per ID)"><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input" /></Field>
          <Field label="Date of birth"><input type="date" value={form.date_of_birth ?? ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value || null })} className="input" /></Field>
          <Field label="Gender">
            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="input bg-white">
              <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
          <Field label="Nationality"><input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} placeholder="Indian" className="input" /></Field>
          <Field label="Phone">
            <div className="flex gap-2">
              <input value={form.phone_country_code} onChange={e => setForm({ ...form, phone_country_code: e.target.value })} className="input w-20" />
              <input value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} className="input flex-1" placeholder="9876543210" />
            </div>
          </Field>
          <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
          <Field label="Seat preference">
            <select value={form.seat_preference} onChange={e => setForm({ ...form, seat_preference: e.target.value })} className="input bg-white">
              <option value="no_preference">No preference</option><option value="window">Window</option><option value="aisle">Aisle</option><option value="middle">Middle</option>
            </select>
          </Field>
          <Field label="Food preference">
            <select value={form.food_preference} onChange={e => setForm({ ...form, food_preference: e.target.value })} className="input bg-white">
              <option value="no_preference">No preference</option><option value="veg">Veg</option><option value="non_veg">Non-Veg</option><option value="vegan">Vegan</option><option value="jain">Jain</option>
            </select>
          </Field>
          <Field label="Berth preference (trains)">
            <select value={form.berth_preference} onChange={e => setForm({ ...form, berth_preference: e.target.value })} className="input bg-white">
              <option value="no_preference">No preference</option><option value="upper">Upper</option><option value="middle">Middle</option><option value="lower">Lower</option><option value="side_upper">Side Upper</option><option value="side_lower">Side Lower</option>
            </select>
          </Field>
          <Field label="Special requirements" className="md:col-span-2">
            <textarea value={form.special_requirements} onChange={e => setForm({ ...form, special_requirements: e.target.value })} rows={2} placeholder="Wheelchair access, child seat, etc." className="input" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setEditing(false)} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />Save profile
          </button>
        </div>
        <style>{`.input{width:100%;padding:.5rem .75rem;border:1px solid #d6d3d1;border-radius:.5rem;font-size:.875rem}`}</style>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 md:p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-teal-950 flex items-center gap-2"><User className="w-5 h-5 text-teal-800" /> My traveler vault</h3>
          <p className="text-sm text-stone-600 mt-0.5">Reusable info for faster bookings. We never store full ID numbers.</p>
        </div>
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm bg-stone-100 hover:bg-stone-200 text-teal-900 px-3 py-1.5 rounded-lg font-medium">
          <Edit3 className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-stone-700 font-medium">Profile {pct}% complete</span>
          <span className={pct === 100 ? 'text-teal-700' : 'text-amber-700'}>{pct === 100 ? 'Ready for bookings' : `${missing.length} fields missing`}</span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-teal-700' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
        </div>
        {missing.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map(m => (
              <span key={m} className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5">
                <AlertCircle className="w-3 h-3" /> Add {m.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {(['full_name','date_of_birth','gender','nationality','phone_number','email','seat_preference','food_preference','berth_preference'] as (keyof TravelerProfile)[]).map(k => (
          <div key={k} className="flex justify-between gap-3 border-b border-stone-100 pb-2">
            <span className="text-stone-500">{labelOf(k)}</span>
            <span className="text-teal-950 font-medium text-right truncate">{formatField(k, profile)}</span>
          </div>
        ))}
      </div>

      {profile?.special_requirements && (
        <div className="mt-3 text-sm bg-stone-50 border border-stone-200 rounded-lg p-3">
          <div className="text-stone-500 text-xs mb-1">Special requirements</div>
          <div className="text-teal-950">{profile.special_requirements}</div>
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-stone-200">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-teal-950 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-800" /> ID verification</div>
            <p className="text-xs text-stone-600 mt-1 max-w-md">We only store verification status and last 4 digits — never the full number.</p>
          </div>
          {profile?.id_verified ? (
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-800 rounded-full px-3 py-1.5 text-sm font-medium">
              <BadgeCheck className="w-4 h-4" /> Verified ({profile.id_type} ••••{profile.id_last_four})
            </div>
          ) : (
            <button onClick={() => setVerifyOpen(true)} className="inline-flex items-center gap-1.5 text-sm bg-teal-900 text-stone-50 hover:bg-teal-800 px-3 py-1.5 rounded-lg font-medium">
              Verify now
            </button>
          )}
        </div>
      </div>

      {verifyOpen && (
        <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVerifyOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h4 className="font-display text-lg font-bold text-teal-950 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-teal-800" /> Verify ID</h4>
              <button onClick={() => setVerifyOpen(false)} className="p-1 hover:bg-stone-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5">
                Your ID number is used only to extract the last 4 digits and is not stored.
              </div>
              <Field label="ID type">
                <select value={idType} onChange={e => setIdType(e.target.value)} className="input bg-white">
                  <option>Aadhaar</option><option>Passport</option><option>Driving License</option>
                </select>
              </Field>
              <Field label="ID number (used once, not stored)">
                <input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="XXXX XXXX XXXX" className="input" />
              </Field>
              {idType === 'Passport' && (
                <Field label="Expiry"><input type="date" value={idExpiry} onChange={e => setIdExpiry(e.target.value)} className="input" /></Field>
              )}
            </div>
            <div className="p-5 flex justify-end gap-2 border-t border-stone-200">
              <button onClick={() => setVerifyOpen(false)} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
              <button onClick={verify} disabled={!idNumber.trim()} className="px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">Mark verified</button>
            </div>
          </div>
          <style>{`.input{width:100%;padding:.5rem .75rem;border:1px solid #d6d3d1;border-radius:.5rem;font-size:.875rem}`}</style>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-stone-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function formatField(k: keyof TravelerProfile, p: TravelerProfile | null): string {
  if (!p) return '—';
  const v = (p as Record<string, unknown>)[k];
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'date_of_birth' || k === 'id_expiry') return new Date(String(v)).toLocaleDateString();
  if (k === 'phone_number') return `${p.phone_country_code} ${v}`;
  if (typeof v === 'string') return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return String(v);
}
