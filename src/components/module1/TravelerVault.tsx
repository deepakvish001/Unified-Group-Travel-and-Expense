import { useEffect, useState } from 'react';
import { Users, Download, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { TravelerVault, UserProfile } from '../../lib/types';

type Props = {
  groupId: string;
};

export function TravelerVault({ groupId }: Props) {
  const { user } = useAuth();
  const [travelers, setTravelers] = useState<TravelerVault[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data: t } = await supabase.from('traveler_vault').select('*').eq('group_id', groupId);
      setTravelers(t ?? []);

      if (user) {
        const { data: up } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
        setUserProfile(up);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [groupId, user?.id]);

  const saveTravelerInfo = async () => {
    if (!user || !userProfile) return;
    await supabase.from('traveler_vault').upsert({
      group_id: groupId,
      user_id: user.id,
      full_name: userProfile.full_name,
      phone_number: userProfile.phone_number,
      food_preference: userProfile.food_preference,
      seat_preference: userProfile.preferred_seat_type,
    }, { onConflict: 'group_id,user_id' });
    load();
  };

  const toggleSelect = (uid: string) => {
    const newSelected = new Set(selected);
    newSelected.has(uid) ? newSelected.delete(uid) : newSelected.add(uid);
    setSelected(newSelected);
  };

  const exportTravelerInfo = () => {
    const selectedTravelers = travelers.filter(t => selected.has(t.user_id));
    const data = {
      group_id: groupId,
      export_date: new Date().toISOString(),
      travelers: selectedTravelers.map(t => ({
        name: t.full_name,
        phone: t.phone_number,
        food: t.food_preference,
        seat: t.seat_preference,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelers-${groupId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-teal-950 flex items-center gap-2">
            <Users className="w-6 h-6" /> Shared Traveler Vault
          </h2>
          <p className="text-stone-600 text-sm">Prepare traveler information for external bookings</p>
        </div>
      </div>

      {/* Your Info */}
      {userProfile && (
        <div className="bg-gradient-to-br from-teal-50 to-stone-50 border border-teal-200 rounded-2xl p-6">
          <h3 className="font-semibold text-teal-950 mb-3">Your Traveler Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-stone-600 uppercase font-semibold">Name</div>
              <div className="font-medium text-teal-950">{userProfile.full_name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-stone-600 uppercase font-semibold">Phone</div>
              <div className="font-medium text-teal-950">{userProfile.phone_number || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-stone-600 uppercase font-semibold">Food Preference</div>
              <div className="font-medium text-teal-950">{userProfile.food_preference || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-stone-600 uppercase font-semibold">Seat Type</div>
              <div className="font-medium text-teal-950">{userProfile.preferred_seat_type || '—'}</div>
            </div>
          </div>
          <button
            onClick={saveTravelerInfo}
            className="mt-4 px-4 py-2 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition"
          >
            Save to Vault
          </button>
        </div>
      )}

      {/* Saved Travelers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-teal-950">Group Travelers ({travelers.length})</h3>
          {selected.size > 0 && (
            <button
              onClick={exportTravelerInfo}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition"
            >
              <Download className="w-4 h-4" /> Export ({selected.size})
            </button>
          )}
        </div>

        {travelers.length === 0 ? (
          <p className="text-sm text-stone-500">No travelers saved yet</p>
        ) : (
          <div className="space-y-2">
            {travelers.map(traveler => (
              <div
                key={traveler.id}
                className={`bg-white border rounded-xl p-4 flex items-start gap-4 cursor-pointer transition ${
                  selected.has(traveler.user_id) ? 'border-teal-800 bg-teal-50' : 'border-stone-200 hover:border-teal-300'
                }`}
                onClick={() => toggleSelect(traveler.user_id)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(traveler.user_id)}
                  onChange={() => toggleSelect(traveler.user_id)}
                  className="w-5 h-5 accent-teal-900 mt-1"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-teal-950">{traveler.full_name}</h4>
                  <div className="grid md:grid-cols-3 gap-4 mt-2 text-sm text-stone-600">
                    <div>
                      <span className="text-xs text-stone-500 uppercase font-semibold block mb-0.5">Phone</span>
                      {traveler.phone_number}
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 uppercase font-semibold block mb-0.5">Food</span>
                      {traveler.food_preference || '—'}
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 uppercase font-semibold block mb-0.5">Seat</span>
                      {traveler.seat_preference || '—'}
                    </div>
                  </div>
                </div>
                {selected.has(traveler.user_id) && (
                  <CheckCircle className="w-5 h-5 text-teal-900 flex-shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          <strong>Workflow:</strong> Select travelers above, export their information, then redirect to your external booking platform (hotels, flights, trains, etc.) with the compiled data. This platform does not handle booking directly.
        </p>
      </div>
    </div>
  );
}
