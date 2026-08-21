import { useState, useEffect } from 'react';
import { User, Heart, Plane, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile } from '../../lib/types';

export function UserProfileSetup() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) setProfile(data);
    })();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setSaved(false);

    const payload = {
      id: user.id,
      full_name: profile.full_name || '',
      email: profile.email || user.email || '',
      phone_number: profile.phone_number || '',
      date_of_birth: profile.date_of_birth || null,
      gender: profile.gender || '',
      profile_picture_url: profile.profile_picture_url || '',
      emergency_contact_name: profile.emergency_contact_name || '',
      emergency_contact_number: profile.emergency_contact_number || '',
      preferred_seat_type: profile.preferred_seat_type || '',
      food_preference: profile.food_preference || '',
      travel_style_preferences: profile.travel_style_preferences || '',
      id_verification_status: profile.id_verification_status || 'unverified',
      masked_id: profile.masked_id || '',
    };

    await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-stone-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-teal-950 mb-2">Complete Your Profile</h1>
          <p className="text-stone-600">Add your travel preferences and emergency contact info.</p>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-stone-200 shadow-lg p-8 space-y-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-teal-950 flex items-center gap-2">
              <User className="w-5 h-5" /> Basic Information
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Full Name"
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
              />
              <input
                type="email"
                value={profile.email || ''}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="Email"
                disabled
                className="px-4 py-2.5 border border-stone-300 rounded-xl bg-stone-50 text-stone-500"
              />
              <input
                type="tel"
                value={profile.phone_number || ''}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                placeholder="Phone Number"
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
              />
              <input
                type="date"
                value={profile.date_of_birth || ''}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
              />
              <select
                value={profile.gender || ''}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                className="px-4 py-2.5 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-teal-950 flex items-center gap-2">
              <Heart className="w-5 h-5" /> Emergency Contact
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                value={profile.emergency_contact_name || ''}
                onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                placeholder="Emergency Contact Name"
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
              />
              <input
                type="tel"
                value={profile.emergency_contact_number || ''}
                onChange={(e) => setProfile({ ...profile, emergency_contact_number: e.target.value })}
                placeholder="Emergency Contact Number"
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
              />
            </div>
          </div>

          {/* Travel Preferences */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-teal-950 flex items-center gap-2">
              <Plane className="w-5 h-5" /> Travel Preferences
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <select
                value={profile.preferred_seat_type || ''}
                onChange={(e) => setProfile({ ...profile, preferred_seat_type: e.target.value })}
                className="px-4 py-2.5 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800"
              >
                <option value="">Preferred Seat Type</option>
                <option value="window">Window</option>
                <option value="aisle">Aisle</option>
                <option value="middle">Middle</option>
              </select>
              <select
                value={profile.food_preference || ''}
                onChange={(e) => setProfile({ ...profile, food_preference: e.target.value })}
                className="px-4 py-2.5 border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-800"
              >
                <option value="">Food Preference</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="non-vegetarian">Non-Vegetarian</option>
              </select>
              <textarea
                value={profile.travel_style_preferences || ''}
                onChange={(e) => setProfile({ ...profile, travel_style_preferences: e.target.value })}
                placeholder="Travel Style (e.g., budget-friendly, luxury, adventure)"
                rows={2}
                className="md:col-span-2 px-4 py-2.5 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-800"
              />
            </div>
          </div>

          {saved && <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg p-3">Profile saved successfully!</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-900 text-white rounded-xl font-medium hover:bg-teal-800 disabled:opacity-60 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
