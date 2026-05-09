import { useEffect, useState } from 'react';
import { X, UserPlus, Loader2, Crown, Trash2, Link2, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Trip, TripMember, Profile, TripInvite } from '../../lib/types';

type MemberRow = TripMember & { profile: Profile };

export function MembersPanel({ tripId, trip, members, onClose, onChange }: {
  tripId: string; trip: Trip; members: MemberRow[]; onClose: () => void; onChange: () => void;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const isOwner = user?.id === trip.owner_id;

  const loadInvites = async () => {
    const { data } = await supabase.from('trip_invites').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
    setInvites(data ?? []);
  };

  useEffect(() => { loadInvites(); }, [tripId]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setLoading(true);
    const { data: prof } = await supabase.from('profiles').select('*').eq('email', email.trim()).maybeSingle();
    if (!prof) { setMsg('No user found with that email. Share an invite link instead.'); setLoading(false); return; }
    if (members.some(m => m.user_id === prof.id)) { setMsg('Already a member.'); setLoading(false); return; }
    const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: prof.id, role: 'member' });
    if (error) setMsg(error.message);
    else {
      await supabase.from('notifications').insert({ user_id: prof.id, trip_id: tripId, type: 'invite', title: 'You joined a trip', body: `You were added to ${trip.name}` });
      setMsg('Added!'); setEmail(''); onChange();
    }
    setLoading(false);
  };

  const createLink = async () => {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, '');
    const { data } = await supabase.from('trip_invites').insert({ trip_id: tripId, token, created_by: user.id }).select().maybeSingle();
    if (data) loadInvites();
  };

  const revokeLink = async (id: string) => {
    await supabase.from('trip_invites').delete().eq('id', id);
    loadInvites();
  };

  const inviteUrl = (token: string) => `${window.location.origin}/?invite=${token}`;

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1800);
  };

  const remove = async (id: string) => {
    await supabase.from('trip_members').delete().eq('id', id);
    onChange();
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950">Members</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 group">
                <div className="w-9 h-9 rounded-full bg-teal-900 text-amber-300 flex items-center justify-center text-sm font-bold">
                  {(m.profile.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-teal-950 text-sm flex items-center gap-1.5">
                    {m.profile.full_name || m.profile.email}
                    {m.user_id === trip.owner_id && <Crown className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <div className="text-xs text-stone-500">{m.profile.email}</div>
                </div>
                {isOwner && m.user_id !== trip.owner_id && (
                  <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 p-1 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <>
              <form onSubmit={invite} className="border-t border-stone-200 pt-4">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Invite by email</label>
                <div className="flex gap-2">
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="friend@example.com"
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-800"
                  />
                  <button disabled={loading} className="inline-flex items-center gap-1 px-3 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Invite
                  </button>
                </div>
                {msg && <div className="mt-2 text-xs text-stone-600">{msg}</div>}
              </form>

              <div className="border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-stone-700">Shareable links</label>
                  <button onClick={createLink} className="inline-flex items-center gap-1 text-xs font-medium text-teal-900 hover:underline">
                    <Link2 className="w-3.5 h-3.5" /> New link
                  </button>
                </div>
                {invites.length === 0 ? (
                  <p className="text-xs text-stone-500">No active invite links. Create one to share.</p>
                ) : (
                  <div className="space-y-2">
                    {invites.map(inv => (
                      <div key={inv.id} className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg p-2">
                        <div className="flex-1 min-w-0 text-xs text-stone-600 truncate">{inviteUrl(inv.token)}</div>
                        <button onClick={() => copy(inv.token)} className="p-1.5 text-teal-900 hover:bg-white rounded transition">
                          {copied === inv.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => revokeLink(inv.id)} className="p-1.5 text-stone-400 hover:text-red-600 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-stone-500 mt-2">Links expire in 30 days. Anyone who signs in with the link will join this trip.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
