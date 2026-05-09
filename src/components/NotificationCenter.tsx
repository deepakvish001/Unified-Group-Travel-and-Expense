import { useEffect, useRef, useState } from 'react';
import { Bell, Check, X, DollarSign, Plane, Map, CheckSquare, Vote, Info, AlertTriangle, Zap, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Notification, NotificationCategory } from '../lib/types';

const CATEGORY_META: Record<NotificationCategory | 'all', { label: string; icon: typeof Bell; color: string }> = {
  all:       { label: 'All',       icon: Bell,         color: 'text-stone-600' },
  financial: { label: 'Finance',   icon: DollarSign,   color: 'text-green-700' },
  booking:   { label: 'Bookings',  icon: Plane,        color: 'text-blue-700' },
  itinerary: { label: 'Itinerary', icon: Map,          color: 'text-teal-700' },
  task:      { label: 'Tasks',     icon: CheckSquare,  color: 'text-amber-700' },
  poll:      { label: 'Polls',     icon: Vote,         color: 'text-violet-700' },
  general:   { label: 'General',   icon: Info,         color: 'text-stone-600' },
};

const PRIORITY_STYLE: Record<string, string> = {
  critical:  'border-l-4 border-red-500 bg-red-50',
  important: 'border-l-4 border-amber-500 bg-amber-50',
  normal:    '',
};

const PRIORITY_BADGE: Record<string, string> = {
  critical:  'bg-red-100 text-red-700',
  important: 'bg-amber-100 text-amber-700',
  normal:    '',
};

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}

type Tab = NotificationCategory | 'all';

export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [showSettings, setShowSettings] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);
    setItems((data ?? []) as Notification[]);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notifs:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setItems(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setItems(prev => prev.map(i => ({ ...i, read: true })));
  };

  const markOne = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
  };

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const snooze = async (id: string, hours: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await supabase.from('notifications').update({ snoozed_until: until, read: true }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true, snoozed_until: until } : i));
  };

  const TABS: Tab[] = ['all', 'financial', 'booking', 'itinerary', 'task', 'poll', 'general'];
  const visible = items.filter(n => {
    if (n.snoozed_until && new Date(n.snoozed_until) > new Date()) return false;
    if (tab === 'all') return true;
    return (n.category || n.type) === tab;
  });
  const unread = items.filter(i => !i.read && !(i.snoozed_until && new Date(i.snoozed_until) > new Date())).length;
  const tabUnread = (t: Tab) => t === 'all' ? unread : items.filter(i => !i.read && (i.category || i.type) === t).length;

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-stone-500 hover:text-teal-900 transition rounded-xl hover:bg-stone-100"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl border border-stone-200 shadow-2xl overflow-hidden z-50 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-900" />
              <span className="font-display font-bold text-teal-950">Notifications</span>
              {unread > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{unread} new</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-teal-700 hover:text-teal-900 transition px-2 py-1 rounded-lg hover:bg-teal-50 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Read all
                </button>
              )}
              <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition">
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex overflow-x-auto scrollbar-hide border-b border-stone-100">
            {TABS.map(t => {
              const meta = CATEGORY_META[t];
              const Icon = meta.icon;
              const count = tabUnread(t);
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative flex items-center gap-1 px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition capitalize ${tab === t ? 'text-teal-900' : 'text-stone-500 hover:text-teal-800'}`}
                >
                  <Icon className={`w-3 h-3 ${tab === t ? 'text-teal-900' : meta.color}`} />
                  {meta.label}
                  {count > 0 && <span className="text-[9px] bg-red-500 text-white rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center">{count}</span>}
                  {tab === t && <span className="absolute bottom-0 inset-x-1 h-0.5 bg-teal-900 rounded-t" />}
                </button>
              );
            })}
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 text-xs text-stone-600 space-y-1">
              <div className="font-semibold text-stone-700 mb-2">Notification Preferences</div>
              {(['financial','booking','itinerary','task','poll'] as NotificationCategory[]).map(cat => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="capitalize">{CATEGORY_META[cat].label} notifications</span>
                </label>
              ))}
            </div>
          )}

          {/* Items */}
          <div className="max-h-[420px] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-teal-300" />
                </div>
                <p className="text-sm font-medium text-stone-500">All caught up!</p>
                <p className="text-xs text-stone-400 mt-1">No notifications in this category.</p>
              </div>
            ) : (
              visible.map(n => {
                const CatMeta = CATEGORY_META[n.category as NotificationCategory] ?? CATEGORY_META.general;
                const CatIcon = CatMeta.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => markOne(n.id)}
                    className={`group relative flex items-start gap-3 px-4 py-3 border-b border-stone-50 hover:bg-stone-50 transition cursor-pointer ${PRIORITY_STYLE[n.priority] || ''} ${!n.read ? 'bg-blue-50/30' : ''}`}
                  >
                    {/* Category icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!n.read ? 'bg-teal-900' : 'bg-stone-100'}`}>
                      {n.priority === 'critical' ? (
                        <Zap className={`w-3.5 h-3.5 ${!n.read ? 'text-amber-300' : 'text-red-500'}`} />
                      ) : n.priority === 'important' ? (
                        <AlertTriangle className={`w-3.5 h-3.5 ${!n.read ? 'text-amber-300' : 'text-amber-500'}`} />
                      ) : (
                        <CatIcon className={`w-3.5 h-3.5 ${!n.read ? 'text-amber-300' : CatMeta.color}`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-start gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-stone-800 leading-snug">{n.title}</span>
                        {n.priority !== 'normal' && (
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[n.priority]}`}>
                            {n.priority}
                          </span>
                        )}
                      </div>
                      {n.body && <p className="text-xs text-stone-600 leading-relaxed">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-stone-400">{timeAgo(n.created_at)}</span>
                        <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${PRIORITY_STYLE[n.priority] ? 'opacity-0' : ''} bg-stone-100 text-stone-500`}>
                          {CatMeta.label}
                        </span>
                        {/* Snooze quick action */}
                        <button
                          onClick={e => snooze(n.id, 1, e)}
                          className="text-[10px] text-stone-400 hover:text-amber-600 transition ml-1 opacity-0 group-hover:opacity-100"
                        >
                          Snooze 1h
                        </button>
                      </div>
                    </div>

                    {/* Unread dot + dismiss */}
                    <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      <button
                        onClick={e => dismiss(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition p-0.5 text-stone-300 hover:text-stone-600 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {visible.length > 0 && (
            <div className="px-4 py-2.5 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-400">{visible.length} notification{visible.length !== 1 ? 's' : ''}</span>
              <button onClick={markAll} className="text-xs text-teal-700 hover:underline">Clear all read</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
