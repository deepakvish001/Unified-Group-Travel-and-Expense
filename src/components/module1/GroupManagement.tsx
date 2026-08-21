import { useEffect, useState } from 'react';
import { Users, LogOut, Trash2, Link2, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Group, GroupMember, GroupInvite, Settlement } from '../../lib/types';

type Props = {
  groupId: string;
  onBack: () => void;
};

const RESPONSIBILITIES = [
  { id: 'booking_coordinator', label: 'Booking Coordinator' },
  { id: 'event_manager', label: 'Event Manager' },
  { id: 'food_planner', label: 'Food Planner' },
  { id: 'navigator', label: 'Navigator' },
  { id: 'emergency_coordinator', label: 'Emergency Coordinator' },
];

export function GroupManagement({ groupId, onBack }: Props) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = members.some(m => m.user_id === user?.id && m.role === 'admin');
  const canLeave = !settlements.some(s => (s.from_user === user?.id || s.to_user === user?.id) && s.status === 'pending');

  const load = async () => {
    try {
      const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
      setGroup(g);

      const { data: m } = await supabase.from('group_members').select('*').eq('group_id', groupId);
      setMembers(m ?? []);

      const { data: inv } = await supabase.from('group_invites').select('*').eq('group_id', groupId);
      setInvites(inv ?? []);

      const { data: sett } = await supabase.from('settlements').select('*').eq('group_id', groupId).eq('status', 'pending');
      setSettlements(sett ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [groupId]);

  const generateInvite = async () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const token = crypto.randomUUID();
    const { error: err } = await supabase.from('group_invites').insert({
      group_id: groupId,
      invite_code: code,
      invite_link_token: token,
      created_by: user?.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    load();
  };

  const revokeInvite = async (id: string) => {
    await supabase.from('group_invites').delete().eq('id', id);
    load();
  };

  const updateRole = async (memberId: string, role: string) => {
    await supabase.from('group_members').update({ role }).eq('id', memberId);
    load();
  };

  const updateResponsibility = async (memberId: string, resp: string | null) => {
    await supabase.from('group_members').update({ responsibility: resp }).eq('id', memberId);
    load();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from('group_members').delete().eq('id', memberId);
    load();
  };

  const leaveGroup = async () => {
    if (!canLeave) {
      setError('You have pending settlements. Resolve them before leaving.');
      return;
    }
    const member = members.find(m => m.user_id === user?.id);
    if (!member) return;
    await supabase.from('group_members').delete().eq('id', member.id);
    onBack();
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-teal-900" />
      </div>
    );
  }

  if (!group) {
    return <div className="text-center py-10 text-stone-500">Group not found</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-teal-950">{group.name}</h1>
            <p className="text-stone-600 mt-1">{group.description || 'No description'}</p>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-stone-200 text-teal-950 rounded-xl hover:bg-stone-300 transition">
            Back
          </button>
        </div>

        {/* Budget Summary */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="text-xs text-stone-500 uppercase font-semibold mb-1">Total Budget</div>
            <div className="font-display text-2xl font-bold text-teal-900">
              {group.currency} {group.total_estimated_cost.toLocaleString()}
            </div>
            <div className="text-sm text-stone-600 mt-2">{group.expected_members} members</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="text-xs text-stone-500 uppercase font-semibold mb-1">Per Member</div>
            <div className="font-display text-2xl font-bold text-amber-700">
              {group.currency} {group.cost_per_person.toFixed(0)}
            </div>
            <div className="text-sm text-stone-600 mt-2">Estimated commitment</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="text-xs text-stone-500 uppercase font-semibold mb-1">Members</div>
            <div className="font-display text-2xl font-bold text-teal-900">{members.length}</div>
            <div className="text-sm text-stone-600 mt-2">{group.expected_members - members.length} slots left</div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

        {/* Members */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold text-teal-950 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Members
          </h2>
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-teal-950 text-sm">{m.user_id}</div>
                  {isAdmin && m.user_id !== user?.id ? (
                    <select
                      value={m.role}
                      onChange={(e) => updateRole(m.id, e.target.value)}
                      className="mt-0.5 text-xs text-stone-600 bg-white border border-stone-200 rounded px-1.5 py-0.5"
                    >
                      <option value="member">member</option>
                      <option value="finance_manager">finance_manager</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <div className="text-xs text-stone-500 mt-0.5">Role: {m.role}</div>
                  )}
                </div>
                {isAdmin && m.user_id !== user?.id ? (
                  <select
                    value={m.responsibility ?? ''}
                    onChange={(e) => updateResponsibility(m.id, e.target.value || null)}
                    className="text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-full px-2 py-1 font-medium"
                  >
                    <option value="">No responsibility</option>
                    {RESPONSIBILITIES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  m.responsibility && (
                    <div className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded-full font-medium">
                      {RESPONSIBILITIES.find(r => r.id === m.responsibility)?.label}
                    </div>
                  )
                )}
                {isAdmin && m.user_id !== user?.id && (
                  <button
                    onClick={() => removeMember(m.id)}
                    className="p-2 text-stone-400 hover:text-red-600 transition"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Invites */}
        {isAdmin && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-teal-950 flex items-center gap-2">
                <Link2 className="w-5 h-5" /> Invite Links
              </h2>
              <button
                onClick={generateInvite}
                className="px-3 py-1.5 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition"
              >
                Generate Link
              </button>
            </div>
            {invites.length === 0 ? (
              <p className="text-sm text-stone-500">No invite links yet</p>
            ) : (
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 p-3 bg-stone-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-stone-600 font-mono truncate">{inv.invite_code}</div>
                      <div className="text-xs text-stone-400 mt-1">{inv.current_joins} / {inv.max_joins} joins</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(inv.invite_code, inv.id)}
                      className="p-1.5 text-stone-400 hover:text-teal-900 transition"
                    >
                      {copied === inv.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settlements Status */}
        {settlements.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="font-display font-bold text-amber-900 mb-3">Pending Settlements</h2>
            <p className="text-sm text-amber-800 mb-3">{settlements.length} settlement(s) pending</p>
            {!canLeave && (
              <p className="text-xs text-amber-700">You cannot leave until all settlements are resolved.</p>
            )}
          </div>
        )}

        {/* Leave Group */}
        {user?.id !== group.created_by && (
          <div className="flex gap-3">
            <button
              onClick={leaveGroup}
              disabled={!canLeave}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 text-white rounded-xl font-medium hover:bg-red-800 disabled:opacity-50 transition"
            >
              <LogOut className="w-4 h-4" /> Leave Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
