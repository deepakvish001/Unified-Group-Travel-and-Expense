import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Pin, Reply, Smile, AtSign, X, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Message, Profile, MessageReaction } from '../../lib/types';

type EnrichedMessage = Message & { profile?: Profile; reactions?: MessageReaction[]; replyMsg?: Message & { profile?: Profile } };

const EMOJIS = ['👍', '❤️', '😂', '🙌', '🔥', '😮', '😢', '👀'];

function timeLabel(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(ts: string): string {
  const d = new Date(ts); d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function ChatPanel({ tripId }: { tripId: string }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<EnrichedMessage[]>([]);
  const [text, setText] = useState('');
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<EnrichedMessage | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [pinned, setPinned] = useState<EnrichedMessage[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildMessages = useCallback((raw: Message[], profMap: Record<string, Profile>, rxMap: Record<string, MessageReaction[]>, rawAll?: Message[]): EnrichedMessage[] => {
    return raw.map(m => ({
      ...m,
      profile: profMap[m.user_id],
      reactions: rxMap[m.id] ?? [],
      replyMsg: m.reply_to ? rawAll?.find(r => r.id === m.reply_to) : undefined,
    }));
  }, []);

  const load = async () => {
    const { data } = await supabase.from('messages').select('*').eq('trip_id', tripId).order('created_at');
    const raw = (data ?? []) as Message[];
    const ids = [...new Set(raw.map(m => m.user_id))];
    let profMap: Record<string, Profile> = {};
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('*').in('id', ids);
      profMap = Object.fromEntries((p ?? []).map(x => [x.id, x]));
      setProfiles(profMap);
    }
    const msgIds = raw.map(m => m.id);
    let rxMap: Record<string, MessageReaction[]> = {};
    if (msgIds.length) {
      const { data: rx } = await supabase.from('message_reactions').select('*').in('message_id', msgIds);
      for (const r of rx ?? []) {
        if (!rxMap[r.message_id]) rxMap[r.message_id] = [];
        rxMap[r.message_id].push(r as MessageReaction);
      }
      setReactions(rxMap);
    }
    const enriched = buildMessages(raw, profMap, rxMap, raw);
    setMessages(enriched);
    setPinned(enriched.filter(m => m.is_pinned));
  };

  useEffect(() => { load(); }, [tripId]);

  // Real-time new messages
  useEffect(() => {
    const ch = supabase.channel(`chat:${tripId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` }, async (payload) => {
        const nm = payload.new as Message;
        let prof = profiles[nm.user_id];
        if (!prof) {
          const { data } = await supabase.from('profiles').select('*').eq('id', nm.user_id).maybeSingle();
          if (data) { prof = data; setProfiles(prev => ({ ...prev, [data.id]: data })); }
        }
        setMessages(prev => {
          const all = prev.map(m => ({ ...m } as Message));
          return [...prev, { ...nm, profile: prof, reactions: [], replyMsg: nm.reply_to ? all.find(m => m.id === nm.reply_to) : undefined }];
        });
      })
      // Reaction changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        load();
      })
      // Presence / typing via broadcast
      .on('broadcast', { event: 'typing' }, (payload) => {
        const uid = payload.payload?.user_id as string | undefined;
        if (!uid || uid === user?.id) return;
        setTypingUsers(prev => [...new Set([...prev, uid])]);
        setTimeout(() => setTypingUsers(prev => prev.filter(u => u !== uid)), 3000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const broadcastTyping = async () => {
    const ch = supabase.channel(`chat:${tripId}`);
    await ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: user?.id } });
  };

  const handleInput = (val: string) => {
    setText(val);
    broadcastTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const content = text.trim();
    const replyId = replyTo?.id ?? null;
    setText('');
    setReplyTo(null);
    // Extract mentions
    const mentionNames = [...content.matchAll(/@(\w+)/g)].map(m => m[1].toLowerCase());
    const mentionIds = Object.values(profiles)
      .filter(p => mentionNames.some(n => p.full_name.toLowerCase().startsWith(n)))
      .map(p => p.id);
    await supabase.from('messages').insert({
      trip_id: tripId, user_id: user.id, content,
      reply_to: replyId, mentions: mentionIds,
    });
    // Notify mentioned users
    for (const mid of mentionIds) {
      if (mid !== user.id) {
        await supabase.from('notifications').insert({
          user_id: mid, trip_id: tripId, type: 'general',
          category: 'general', priority: 'important',
          title: `${profile?.full_name ?? 'Someone'} mentioned you`,
          body: content.slice(0, 100),
          read: false,
        });
      }
    }
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions[msgId]?.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: msgId, user_id: user.id, emoji });
    }
    setEmojiPickerFor(null);
  };

  const togglePin = async (msg: EnrichedMessage) => {
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    load();
  };

  // Group messages by date
  const groups: { label: string; messages: EnrichedMessage[] }[] = [];
  for (const m of messages) {
    const label = dateLabel(m.created_at);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, messages: [m] });
    else last.messages.push(m);
  }

  const typingNames = typingUsers.map(uid => profiles[uid]?.full_name?.split(' ')[0] ?? 'Someone');

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-stone-200 flex flex-col" style={{ height: '75vh' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-teal-950 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-700" /> Group Chat
          </h2>
          <p className="text-xs text-stone-400">{messages.length} messages</p>
        </div>
        {pinned.length > 0 && (
          <button onClick={() => setShowPinned(!showPinned)} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full hover:bg-amber-100 transition">
            <Pin className="w-3 h-3" /> {pinned.length} pinned
          </button>
        )}
      </div>

      {/* Pinned messages */}
      {showPinned && pinned.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 space-y-2">
          <div className="text-xs font-semibold text-amber-800 flex items-center gap-1">
            <Pin className="w-3 h-3" /> Pinned Messages
          </div>
          {pinned.map(m => (
            <div key={m.id} className="bg-white rounded-xl px-3 py-2 text-sm text-stone-700 border border-amber-200">
              <span className="font-semibold text-teal-900">{m.profile?.full_name ?? 'Member'}: </span>
              {m.content}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-teal-300" />
            </div>
            <p className="text-sm font-medium text-stone-500">Say hi to your group!</p>
            <p className="text-xs text-stone-400 mt-1">Use @name to mention someone</p>
          </div>
        )}

        {groups.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-stone-100 flex-1" />
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-2">{group.label}</span>
              <div className="h-px bg-stone-100 flex-1" />
            </div>
            {group.messages.map((m, idx) => {
              const isMe = m.user_id === user?.id;
              const prevMsg = group.messages[idx - 1];
              const sameAuthor = prevMsg?.user_id === m.user_id && (new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 60000;
              const p = isMe ? profile : m.profile ?? profiles[m.user_id];
              // Group reactions
              const rxGroups: Record<string, { emoji: string; count: number; mine: boolean }> = {};
              for (const r of m.reactions ?? []) {
                if (!rxGroups[r.emoji]) rxGroups[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
                rxGroups[r.emoji].count++;
                if (r.user_id === user?.id) rxGroups[r.emoji].mine = true;
              }

              return (
                <div key={m.id} className={`flex gap-2 group ${isMe ? 'justify-end' : 'justify-start'} ${sameAuthor ? 'mt-0.5' : 'mt-4'} animate-slide-in`}>
                  {/* Avatar */}
                  {!isMe && !sameAuthor ? (
                    <div className="w-8 h-8 rounded-full bg-teal-900 text-amber-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-auto">
                      {(p?.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  ) : !isMe ? <div className="w-8 flex-shrink-0" /> : null}

                  <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Author + time */}
                    {!isMe && !sameAuthor && (
                      <div className="flex items-baseline gap-2 mb-1 ml-1">
                        <span className="text-xs font-semibold text-teal-800">{p?.full_name ?? 'Member'}</span>
                        <span className="text-[10px] text-stone-400">{timeLabel(m.created_at)}</span>
                      </div>
                    )}

                    {/* Reply preview */}
                    {m.replyMsg && (
                      <div className={`mb-1 px-3 py-1.5 rounded-xl text-xs border-l-2 border-teal-400 bg-teal-50 text-stone-500 max-w-full`}>
                        <span className="font-semibold text-teal-700">{profiles[m.replyMsg.user_id]?.full_name ?? 'Member'}: </span>
                        {m.replyMsg.content.slice(0, 60)}{m.replyMsg.content.length > 60 ? '…' : ''}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className="relative">
                      <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-teal-900 text-stone-50 rounded-br-sm' : 'bg-stone-100 text-teal-950 rounded-bl-sm'}`}>
                        {/* Mentions highlighted */}
                        <span className="whitespace-pre-wrap">
                          {m.content.split(/(@\w+)/).map((part, i) =>
                            part.startsWith('@')
                              ? <span key={i} className={`font-semibold ${isMe ? 'text-amber-300' : 'text-teal-700'}`}>{part}</span>
                              : part
                          )}
                        </span>
                        {isMe && (
                          <span className="text-[10px] text-stone-300 ml-2 inline-block">{timeLabel(m.created_at)}</span>
                        )}
                      </div>

                      {/* Action row */}
                      <div className={`absolute top-0 ${isMe ? 'right-full mr-1' : 'left-full ml-1'} flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button onClick={() => setEmojiPickerFor(emojiPickerFor === m.id ? null : m.id)} className="p-1 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-600">
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setReplyTo(m)} className="p-1 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-600">
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => togglePin(m)} className="p-1 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-600">
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Emoji picker */}
                      {emojiPickerFor === m.id && (
                        <div className={`absolute z-10 top-full mt-1 flex gap-1 bg-white border border-stone-200 rounded-xl shadow-lg p-2 ${isMe ? 'right-0' : 'left-0'}`}>
                          {EMOJIS.map(em => (
                            <button key={em} onClick={() => toggleReaction(m.id, em)} className="text-base hover:scale-125 transition-transform">{em}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    {Object.keys(rxGroups).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.values(rxGroups).map(rx => (
                          <button
                            key={rx.emoji}
                            onClick={() => toggleReaction(m.id, rx.emoji)}
                            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition ${rx.mine ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                          >
                            {rx.emoji} <span className="font-medium">{rx.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="flex items-center gap-2 pl-10 animate-fade-in">
            <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
              <span className="text-xs text-stone-500 italic">{typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing</span>
              <div className="flex gap-0.5">
                {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-teal-50 border-t border-teal-100 flex items-center gap-3">
          <Reply className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-teal-700">{replyTo.profile?.full_name ?? 'Member'}: </span>
            <span className="text-xs text-stone-600 truncate">{replyTo.content}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={send} className="p-3 border-t border-stone-100 flex items-end gap-2">
        <div className="flex-1 relative">
          <input
            value={text}
            onChange={e => handleInput(e.target.value)}
            placeholder="Type a message… use @name to mention"
            className="w-full px-4 py-2.5 pr-10 bg-stone-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-800 focus:bg-white transition"
          />
          <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          className="w-11 h-11 rounded-full bg-teal-900 text-stone-50 flex items-center justify-center hover:bg-teal-800 disabled:opacity-40 transition shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
