import { useEffect, useState } from 'react';
import { X, Clock, Calendar, Wallet, User, Paperclip, ExternalLink, Trash2, Link2, MessageSquare, Upload, ArrowLeftRight, AlertTriangle, Loader2, Edit3, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Booking, BookingStatus, BookingActivityLog, BookingParticipant } from '../../lib/types';
import { BOOKING_TYPE_META, STATUS_META, BOOKING_STATUS_KEYS, PRIORITY_META, BOOKING_CATEGORY_MAP } from './constants';
import { currencyFmt, formatDate, formatDateTime, memberName, timeAgo, type MemberRow } from './utils';

type Props = { booking: Booking; members: MemberRow[]; onClose: () => void; onChanged: () => void };

export function BookingDetail({ booking, members, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [b, setB] = useState<Booking>(booking);
  const [participants, setParticipants] = useState<BookingParticipant[]>([]);
  const [logs, setLogs] = useState<BookingActivityLog[]>([]);
  const [updateMsg, setUpdateMsg] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCoordinator = user?.id === b.assigned_coordinator;
  const typeMeta = BOOKING_TYPE_META[b.type];
  const TypeIcon = typeMeta.icon;

  const load = async () => {
    const [p, l, fresh] = await Promise.all([
      supabase.from('booking_participants').select('*').eq('booking_id', b.id),
      supabase.from('booking_activity_logs').select('*').eq('booking_id', b.id).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').eq('id', b.id).maybeSingle(),
    ]);
    setParticipants(p.data ?? []);
    setLogs(l.data ?? []);
    if (fresh.data) setB(fresh.data);
  };
  useEffect(() => { load(); }, [b.id]);

  const log = async (action: string, message: string) => {
    if (!user) return;
    await supabase.from('booking_activity_logs').insert({ booking_id: b.id, trip_id: b.trip_id, action, performed_by: user.id, message });
    await supabase.from('trip_activity_logs').insert({
      trip_id: b.trip_id, actor_id: user.id, action_type: `booking_${action}`, description: message,
      related_entity_type: 'booking', related_entity_id: b.id,
    });
  };

  const changeStatus = async (s: BookingStatus) => {
    if (!user) return;
    await supabase.from('bookings').update({ status: s, updated_at: new Date().toISOString(), last_edited_by: user.id }).eq('id', b.id);
    await log('status_changed', `Status changed to "${STATUS_META[s].label}"`);
    const recipients = participants.map(p => p.user_id).filter(id => id !== user.id);
    if (recipients.length) {
      await supabase.from('notifications').insert(recipients.map(uid => ({
        user_id: uid, trip_id: b.trip_id, type: 'booking',
        title: `Booking ${STATUS_META[s].label.toLowerCase()}`, body: `"${b.title}" is now ${STATUS_META[s].label.toLowerCase()}`,
      })));
    }
    load(); onChanged();
  };

  const addUpdate = async () => {
    if (!updateMsg.trim() || !user) return;
    await log('update', updateMsg.trim());
    setUpdateMsg(''); load();
  };

  const addAttachment = async () => {
    const url = attachUrl.trim();
    if (!url || !user) return;
    const next = [...(b.attachments || []), url];
    await supabase.from('bookings').update({ attachments: next, updated_at: new Date().toISOString(), last_edited_by: user.id }).eq('id', b.id);
    await log('document_uploaded', 'Uploaded booking confirmation');
    setAttachUrl(''); load(); onChanged();
  };

  const removeAttachment = async (url: string) => {
    if (!user) return;
    const next = (b.attachments || []).filter(a => a !== url);
    await supabase.from('bookings').update({ attachments: next, last_edited_by: user.id }).eq('id', b.id);
    load(); onChanged();
  };

  const toggleParticipant = async (uid: string) => {
    if (!user) return;
    const existing = participants.find(p => p.user_id === uid);
    if (existing) {
      await supabase.from('booking_participants').delete().eq('id', existing.id);
      await log('participant_removed', `Removed ${memberName(uid, members)}`);
      await supabase.from('notifications').insert({ user_id: uid, trip_id: b.trip_id, type: 'booking', title: 'Removed from booking', body: `You were removed from "${b.title}"` });
    } else {
      await supabase.from('booking_participants').insert({ booking_id: b.id, user_id: uid, participation_status: 'included', added_by: user.id });
      await log('participant_added', `Added ${memberName(uid, members)}`);
      await supabase.from('notifications').insert({ user_id: uid, trip_id: b.trip_id, type: 'booking', title: 'Added to booking', body: `You were added to "${b.title}"` });
    }
    load(); onChanged();
  };

  const reassign = async (uid: string) => {
    if (!user) return;
    await supabase.from('bookings').update({ assigned_coordinator: uid, last_edited_by: user.id }).eq('id', b.id);
    await log('reassigned', `Reassigned coordinator to ${memberName(uid, members)}`);
    await supabase.from('notifications').insert({ user_id: uid, trip_id: b.trip_id, type: 'booking', title: 'Booking reassigned', body: `"${b.title}" is now assigned to you` });
    load(); onChanged();
  };

  const linkExpense = async () => {
    if (!user || b.linked_expense_id) return;
    const participantIds = participants.map(p => p.user_id);
    const amt = Number(b.actual_cost) || Number(b.estimated_cost) || Number(b.cost) || 0;
    const { data: exp } = await supabase.from('expenses').insert({
      trip_id: b.trip_id, title: b.title, amount: amt, currency: b.currency,
      category: BOOKING_CATEGORY_MAP[b.type] || 'other', paid_by: b.assigned_coordinator,
      expense_type: 'group', split_type: 'equal',
      expense_date: b.travel_date || new Date().toISOString().slice(0, 10),
      notes: `Linked from booking: ${b.title}`, status: 'normal', created_by: user.id,
    }).select().maybeSingle();
    if (exp && participantIds.length) {
      await supabase.from('expense_splits').insert(participantIds.map(uid => ({
        expense_id: exp.id, user_id: uid, amount: amt / participantIds.length,
      })));
      await supabase.from('bookings').update({ linked_expense_id: exp.id }).eq('id', b.id);
      await log('expense_linked', `Linked to expense (${currencyFmt(amt, b.currency)})`);
    }
    load(); onChanged();
  };

  const remove = async () => {
    if (!confirm('Delete this booking?')) return;
    await supabase.from('bookings').delete().eq('id', b.id);
    onChanged(); onClose();
  };

  const saveEdit = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('bookings').update({
      title: b.title, travel_date: b.travel_date, booking_deadline: b.booking_deadline,
      estimated_cost: Number(b.estimated_cost) || 0, actual_cost: Number(b.actual_cost) || 0,
      booking_reference: b.booking_reference, external_booking_url: b.external_booking_url, notes: b.notes,
      priority: b.priority, last_edited_by: user.id, updated_at: new Date().toISOString(),
    }).eq('id', b.id);
    await log('updated', `Updated booking details`);
    setSaving(false); setEditing(false); load(); onChanged();
  };

  const overdue = b.booking_deadline && new Date(b.booking_deadline) < new Date() && b.status !== 'confirmed' && b.status !== 'cancelled';

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-start md:items-center justify-center p-0 md:p-4 animate-fade-in">
      <div className="bg-stone-50 w-full max-w-3xl md:rounded-2xl shadow-2xl max-h-screen md:max-h-[92vh] flex flex-col">
        <div className={`p-5 flex items-start justify-between gap-3 border-b ${STATUS_META[b.status].color.replace('border', 'border-b')}`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0"><TypeIcon className="w-6 h-6 text-teal-900" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_META[b.status].color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[b.status].dot}`} />{STATUS_META[b.status].label}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${PRIORITY_META[b.priority].color}`}>{PRIORITY_META[b.priority].label}</span>
                {overdue && <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</span>}
              </div>
              {editing ? (
                <input value={b.title} onChange={e => setB({ ...b, title: e.target.value })} className="mt-1 font-display text-xl font-bold text-teal-950 bg-transparent border-b border-stone-300 focus:outline-none focus:border-teal-800" />
              ) : (
                <h3 className="font-display text-xl md:text-2xl font-bold text-teal-950 mt-1 truncate">{b.title}</h3>
              )}
              <div className="text-xs text-stone-600">{typeMeta.label}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!editing && <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-white rounded-lg" title="Edit"><Edit3 className="w-4 h-4 text-stone-600" /></button>}
            {editing && <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1 bg-teal-900 text-stone-50 hover:bg-teal-800 px-2.5 py-1 rounded-lg text-xs">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save</button>}
            <button onClick={remove} className="p-1.5 hover:bg-white rounded-lg" title="Delete"><Trash2 className="w-4 h-4 text-red-600" /></button>
            <button onClick={onClose} className="p-1.5 hover:bg-white rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <InfoCard icon={Calendar} label="Travel date">
              {editing ? <input type="date" value={b.travel_date ?? ''} onChange={e => setB({ ...b, travel_date: e.target.value || null })} className="input" /> : formatDate(b.travel_date)}
            </InfoCard>
            <InfoCard icon={Clock} label="Deadline">
              {editing ? <input type="datetime-local" value={b.booking_deadline ? b.booking_deadline.slice(0, 16) : ''} onChange={e => setB({ ...b, booking_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} className="input" /> : formatDateTime(b.booking_deadline)}
            </InfoCard>
            <InfoCard icon={Wallet} label="Cost">
              {editing ? (
                <div className="flex gap-1">
                  <input type="number" placeholder="Est." value={b.estimated_cost || ''} onChange={e => setB({ ...b, estimated_cost: Number(e.target.value) })} className="input flex-1" />
                  <input type="number" placeholder="Actual" value={b.actual_cost || ''} onChange={e => setB({ ...b, actual_cost: Number(e.target.value) })} className="input flex-1" />
                </div>
              ) : (
                <div><span className="font-semibold">{currencyFmt(Number(b.actual_cost) || Number(b.estimated_cost) || Number(b.cost) || 0, b.currency)}</span>{b.actual_cost ? <span className="text-[10px] text-stone-500 ml-1">actual</span> : <span className="text-[10px] text-stone-500 ml-1">est.</span>}</div>
              )}
            </InfoCard>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-teal-950 flex items-center gap-1.5"><User className="w-4 h-4" /> Coordinator</div>
              {user?.id === b.created_by && (
                <select value={b.assigned_coordinator ?? ''} onChange={e => reassign(e.target.value)} className="text-xs bg-stone-100 border border-stone-200 rounded-lg px-2 py-1">
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-300 text-teal-950 flex items-center justify-center text-sm font-bold">{memberName(b.assigned_coordinator, members).charAt(0).toUpperCase()}</div>
              <div className="text-sm font-medium text-teal-950">{memberName(b.assigned_coordinator, members)}</div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-teal-950 mb-2">Update status</div>
            <div className="flex flex-wrap gap-1.5">
              {BOOKING_STATUS_KEYS.map(s => (
                <button key={s} onClick={() => changeStatus(s)} disabled={b.status === s} className={`text-xs px-2.5 py-1 rounded-full border transition ${b.status === s ? `${STATUS_META[s].color} font-semibold` : 'bg-white border-stone-200 text-stone-600 hover:border-teal-300'}`}>
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
            {!isCoordinator && <div className="text-[11px] text-stone-500 mt-2">Anyone can log updates; the coordinator typically drives status changes.</div>}
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-teal-950">Travelers ({participants.length})</div>
            </div>
            <div className="grid md:grid-cols-2 gap-1.5">
              {members.map(m => {
                const inc = participants.some(p => p.user_id === m.user_id);
                return (
                  <button key={m.user_id} onClick={() => toggleParticipant(m.user_id)} className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition ${inc ? 'bg-teal-50 border-teal-200' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>
                    <input type="checkbox" checked={inc} onChange={() => {}} className="w-4 h-4 accent-teal-900 pointer-events-none" />
                    <div className="w-7 h-7 rounded-full bg-amber-300 text-teal-950 flex items-center justify-center text-xs font-bold">{(m.profile.full_name || '?').charAt(0).toUpperCase()}</div>
                    <span className="text-teal-950 truncate flex-1 text-left">{m.profile.full_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-teal-950 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Linked expense</div>
              {!b.linked_expense_id && <button onClick={linkExpense} className="text-xs bg-teal-900 text-stone-50 hover:bg-teal-800 px-2.5 py-1 rounded-lg">Create linked expense</button>}
            </div>
            {b.linked_expense_id ? (
              <div className="text-sm text-teal-950 inline-flex items-center gap-2"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-xs font-medium">Linked</span><span className="font-mono text-xs text-stone-500">{b.linked_expense_id.slice(0, 8)}</span></div>
            ) : <div className="text-sm text-stone-500">No expense linked yet.</div>}
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-teal-950 flex items-center gap-1.5 mb-2"><Paperclip className="w-4 h-4" /> Attachments</div>
            <div className="flex gap-2">
              <input value={attachUrl} onChange={e => setAttachUrl(e.target.value)} placeholder="Paste confirmation URL..." className="input flex-1" />
              <button onClick={addAttachment} className="inline-flex items-center gap-1 bg-stone-100 hover:bg-stone-200 text-teal-900 px-3 py-2 rounded-lg text-sm"><Upload className="w-4 h-4" /> Add</button>
            </div>
            {(b.attachments || []).length > 0 && (
              <ul className="mt-2 space-y-1">
                {(b.attachments || []).map(url => (
                  <li key={url} className="flex items-center justify-between gap-2 text-xs bg-stone-50 border border-stone-200 rounded px-2 py-1.5">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-800 hover:underline truncate flex-1 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />{url}</a>
                    <button onClick={() => removeAttachment(url)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            {editing && (
              <div className="mt-3 grid md:grid-cols-2 gap-2">
                <input value={b.booking_reference} onChange={e => setB({ ...b, booking_reference: e.target.value })} placeholder="Booking reference / PNR" className="input" />
                <input value={b.external_booking_url} onChange={e => setB({ ...b, external_booking_url: e.target.value })} placeholder="External booking URL" className="input" />
              </div>
            )}
            {!editing && (b.booking_reference || b.external_booking_url) && (
              <div className="mt-2 text-xs text-stone-600">
                {b.booking_reference && <div>Ref: <span className="font-mono text-teal-950">{b.booking_reference}</span></div>}
                {b.external_booking_url && <a href={b.external_booking_url} target="_blank" rel="noopener noreferrer" className="text-teal-800 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />External link</a>}
              </div>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-teal-950 flex items-center gap-1.5 mb-2"><MessageSquare className="w-4 h-4" /> Updates & timeline</div>
            <div className="flex gap-2 mb-3">
              <input value={updateMsg} onChange={e => setUpdateMsg(e.target.value)} placeholder="Add a progress note..." className="input flex-1" />
              <button onClick={addUpdate} disabled={!updateMsg.trim()} className="bg-teal-900 text-stone-50 hover:bg-teal-800 disabled:opacity-50 px-3 py-2 rounded-lg text-sm">Log</button>
            </div>
            {logs.length === 0 && <div className="text-xs text-stone-500">No updates yet.</div>}
            <ul className="space-y-2">
              {logs.map(l => (
                <li key={l.id} className="text-sm border-l-2 border-teal-200 pl-3 py-1">
                  <div className="text-teal-950">{l.message}</div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> {memberName(l.performed_by, members)} · {timeAgo(l.created_at)}</div>
                </li>
              ))}
            </ul>
          </div>

          {editing && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <label className="text-sm font-semibold text-teal-950 block mb-1">Notes</label>
              <textarea value={b.notes} onChange={e => setB({ ...b, notes: e.target.value })} rows={2} className="input" />
            </div>
          )}
        </div>

        <style>{`.input{width:100%;padding:.5rem .75rem;border:1px solid #d6d3d1;border-radius:.5rem;font-size:.875rem;background:white}`}</style>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3">
      <div className="text-[11px] uppercase tracking-wide text-stone-500 flex items-center gap-1 mb-1"><Icon className="w-3 h-3" />{label}</div>
      <div className="text-sm text-teal-950 font-medium">{children}</div>
    </div>
  );
}
