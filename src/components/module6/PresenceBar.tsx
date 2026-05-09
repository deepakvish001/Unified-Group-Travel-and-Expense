import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserPresence, Profile } from '../../lib/types';

type Props = { tripId: string; currentView: string };

const STATUS_DOT: Record<string, string> = {
  online:      'bg-green-500',
  active:      'bg-teal-400',
  away:        'bg-stone-400',
  dnd:         'bg-red-500',
  in_activity: 'bg-blue-500',
};

const STATUS_LABEL: Record<string, string> = {
  online:      'Online',
  active:      'Active',
  away:        'Away',
  dnd:         'Do not disturb',
  in_activity: 'In activity',
};

export function PresenceBar({ tripId, currentView }: Props) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<(UserPresence & { profile?: Profile })[]>([]);

  const load = async () => {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('user_presence')
      .select('*')
      .eq('trip_id', tripId)
      .gte('last_seen', cutoff);
    if (!data) return;
    const ids = data.map(p => p.user_id);
    let profileMap: Record<string, Profile> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
      profileMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]));
    }
    setPresence(data.map(p => ({ ...p, profile: profileMap[p.user_id] })) as (UserPresence & { profile?: Profile })[]);
  };

  // Upsert own presence
  useEffect(() => {
    if (!user) return;
    const upsert = async () => {
      await supabase.from('user_presence').upsert({
        trip_id: tripId,
        user_id: user.id,
        status: 'online',
        current_view: currentView,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id,user_id' });
    };
    upsert();
    const iv = setInterval(upsert, 30000);
    return () => clearInterval(iv);
  }, [tripId, user?.id, currentView]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`presence:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence', filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const others = presence.filter(p => p.user_id !== user?.id);
  if (others.length === 0) return null;

  const typing = others.filter(p => p.is_typing);

  return (
    <div className="flex items-center gap-3 py-2 px-4 bg-teal-50 border-b border-teal-100 text-xs text-teal-700">
      {/* Avatars */}
      <div className="flex -space-x-1.5">
        {others.slice(0, 5).map(p => (
          <div
            key={p.user_id}
            title={`${p.profile?.full_name ?? 'Member'} — ${STATUS_LABEL[p.status] ?? p.status}`}
            className="relative w-6 h-6 rounded-full bg-teal-900 text-amber-300 flex items-center justify-center text-[10px] font-bold border-2 border-white"
          >
            {(p.profile?.full_name ?? '?').charAt(0).toUpperCase()}
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${STATUS_DOT[p.status] ?? 'bg-stone-400'}`} />
          </div>
        ))}
      </div>

      {typing.length > 0 ? (
        <span className="italic text-teal-600">
          {typing.map(p => p.profile?.full_name?.split(' ')[0] ?? 'Someone').join(', ')} {typing.length === 1 ? 'is' : 'are'} typing…
        </span>
      ) : (
        <span>
          {others.length === 1
            ? `${others[0].profile?.full_name ?? 'A member'} is here`
            : `${others.length} members viewing this trip`}
        </span>
      )}

      {/* Online indicator dots */}
      <div className="ml-auto flex items-center gap-1.5">
        {(Object.entries(STATUS_DOT) as [string, string][]).map(([status, cls]) => {
          const count = others.filter(p => p.status === status).length;
          if (count === 0) return null;
          return (
            <span key={status} className="flex items-center gap-1" title={STATUS_LABEL[status]}>
              <span className={`w-2 h-2 rounded-full ${cls}`} />
              <span>{count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
